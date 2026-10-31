"use server";

import { revalidatePath } from "next/cache";
import { referenzenPruefen, withTenant } from "@/lib/db";
import { requireBueroSession } from "@/lib/session";
import {
  fahrgastSchema,
  genehmigungSchema,
  telefonListeAusText,
  type FahrgastEingabe,
  type GenehmigungEingabe,
} from "@/core/passengers/validation";
import { fahrgastAnonymisieren, fahrgastExportieren } from "@/core/passengers/loeschung";
import { telefonNormalisieren } from "@/core/passengers/suche";

export async function fahrgaesteLaden(suche?: string) {
  const { tenantId } = await requireBueroSession();
  const db = withTenant(tenantId);
  const text = suche?.trim();
  // Prüfbericht S2-013: Nummern liegen normalisiert vor – die Eingabe "0171 …" muss den
  // Schlüssel "+49171…" treffen (und umgekehrt KI-Fahrgäste finden).
  const telefonSchluessel = text ? telefonNormalisieren(text) : "";
  return db.passenger.findMany({
    where: text
      ? {
          OR: [
            { firstName: { contains: text, mode: "insensitive" } },
            { lastName: { contains: text, mode: "insensitive" } },
            { phones: { hasSome: [text, ...(telefonSchluessel ? [telefonSchluessel] : [])] } },
          ],
        }
      : undefined,
    include: { approvals: true },
    orderBy: { lastName: "asc" },
    take: 100,
  });
}

export async function fahrgastSpeichern(id: string | null, eingabe: FahrgastEingabe) {
  const { tenantId, userId } = await requireBueroSession();
  const geprüft = fahrgastSchema.parse(eingabe);
  const daten = {
    firstName: geprüft.firstName,
    lastName: geprüft.lastName,
    birthDate: geprüft.birthDate ? new Date(geprüft.birthDate) : null,
    phones: telefonListeAusText(geprüft.phones),
    insurer: geprüft.insurer || null,
    notes: geprüft.notes || null,
  };
  const db = withTenant(tenantId);
  let passengerId = id;
  if (id) {
    await db.passenger.update({ where: { id }, data: daten });
  } else {
    const neu = await db.passenger.create({ data: { ...daten, tenantId } });
    passengerId = neu.id;
  }
  await db.auditLog.create({
    data: {
      tenantId,
      userId,
      action: id ? "passenger.geaendert" : "passenger.angelegt",
      entity: "Passenger",
      entityId: passengerId!,
    },
  });
  revalidatePath("/dispo/fahrgaeste");
}

/** Protokolliert das Ansehen eines einzelnen Fahrgastdatensatzes (docs/08-datenschutz-sicherheit.md). */
export async function fahrgastAngesehen(passengerId: string) {
  const { tenantId, userId } = await requireBueroSession();
  await withTenant(tenantId).auditLog.create({
    data: { tenantId, userId, action: "passenger.angesehen", entity: "Passenger", entityId: passengerId },
  });
}

export async function genehmigungSpeichern(passengerId: string, eingabe: GenehmigungEingabe) {
  const { tenantId } = await requireBueroSession();
  const geprüft = genehmigungSchema.parse(eingabe);
  // Prüfbericht S2-008: der Fahrgast muss zu diesem Mandanten gehören.
  await referenzenPruefen(tenantId, { passenger: [passengerId] });
  await withTenant(tenantId).approval.create({
    data: {
      tenantId,
      passengerId,
      validFrom: new Date(geprüft.validFrom),
      validUntil: new Date(geprüft.validUntil),
      maxRides: geprüft.maxRides ? Number(geprüft.maxRides) : null,
      reference: geprüft.reference || null,
    },
  });
  revalidatePath("/dispo/fahrgaeste");
}

export async function genehmigungLöschen(id: string) {
  const { tenantId } = await requireBueroSession();
  await withTenant(tenantId).approval.delete({ where: { id } });
  revalidatePath("/dispo/fahrgaeste");
}

export async function fahrgaesteImportieren(
  zeilen: Record<string, string>[],
): Promise<{ ok: number; fehler: string[] }> {
  const { tenantId } = await requireBueroSession();
  const db = withTenant(tenantId);
  const fehler: string[] = [];
  let ok = 0;
  for (const [index, zeile] of zeilen.entries()) {
    const ergebnis = fahrgastSchema.safeParse(zeile);
    if (!ergebnis.success) {
      fehler.push(`Zeile ${index + 2}: ${ergebnis.error.issues[0]?.message ?? "ungültig"}`);
      continue;
    }
    await db.passenger.create({
      data: {
        tenantId,
        firstName: ergebnis.data.firstName,
        lastName: ergebnis.data.lastName,
        birthDate: ergebnis.data.birthDate ? new Date(ergebnis.data.birthDate) : null,
        phones: telefonListeAusText(ergebnis.data.phones),
        insurer: ergebnis.data.insurer || null,
      },
    });
    ok += 1;
  }
  revalidatePath("/dispo/fahrgaeste");
  return { ok, fehler };
}

/**
 * Auskunftsrecht (Art. 15 DSGVO): alle Daten eines Fahrgastes als JSON – Stammdaten, Genehmigungen,
 * Fahrten, verknüpfte Anrufe mit Transkript. Nur ADMIN (docs/08-datenschutz-sicherheit.md).
 */
export async function fahrgastExportLaden(passengerId: string) {
  const { tenantId, userId, role } = await requireBueroSession();
  if (role !== "ADMIN") throw new Error("Nur Admins dürfen Fahrgastdaten exportieren.");
  const daten = await fahrgastExportieren(tenantId, passengerId);
  await withTenant(tenantId).auditLog.create({
    data: { tenantId, userId, action: "passenger.export", entity: "Passenger", entityId: passengerId },
  });
  return daten;
}

/**
 * Löschung (Art. 17 DSGVO): persönliche Daten werden anonymisiert statt die Zeile hart zu
 * löschen – erledigte Fahrten bleiben sonst ohne gültige Fremdschlüssel für die Abrechnung
 * stehen (Ride.passengerId ist nicht optional). Noch nicht begonnene Fahrten werden storniert,
 * eine laufende Serie endet sofort. Nur ADMIN.
 */
export async function fahrgastLoeschen(passengerId: string) {
  const { tenantId, userId, role } = await requireBueroSession();
  if (role !== "ADMIN") throw new Error("Nur Admins dürfen einen Fahrgast löschen.");
  await fahrgastAnonymisieren(tenantId, passengerId, userId);
  await withTenant(tenantId).auditLog.create({
    data: { tenantId, userId, action: "passenger.geloescht", entity: "Passenger", entityId: passengerId },
  });
  revalidatePath("/dispo/fahrgaeste");
}
