"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db";
import { requireSession } from "@/lib/session";
import {
  fahrgastSchema,
  genehmigungSchema,
  telefonListeAusText,
  type FahrgastEingabe,
  type GenehmigungEingabe,
} from "@/core/passengers/validation";

export async function fahrgaesteLaden(suche?: string) {
  const { tenantId } = await requireSession();
  const db = withTenant(tenantId);
  const text = suche?.trim();
  return db.passenger.findMany({
    where: text
      ? {
          OR: [
            { firstName: { contains: text, mode: "insensitive" } },
            { lastName: { contains: text, mode: "insensitive" } },
            { phones: { has: text } },
          ],
        }
      : undefined,
    include: { approvals: true },
    orderBy: { lastName: "asc" },
    take: 100,
  });
}

export async function fahrgastSpeichern(id: string | null, eingabe: FahrgastEingabe) {
  const { tenantId } = await requireSession();
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
  if (id) {
    await db.passenger.update({ where: { id }, data: daten });
  } else {
    await db.passenger.create({ data: { ...daten, tenantId } });
  }
  revalidatePath("/dispo/fahrgaeste");
}

export async function genehmigungSpeichern(passengerId: string, eingabe: GenehmigungEingabe) {
  const { tenantId } = await requireSession();
  const geprüft = genehmigungSchema.parse(eingabe);
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
  const { tenantId } = await requireSession();
  await withTenant(tenantId).approval.delete({ where: { id } });
  revalidatePath("/dispo/fahrgaeste");
}

export async function fahrgaesteImportieren(
  zeilen: Record<string, string>[],
): Promise<{ ok: number; fehler: string[] }> {
  const { tenantId } = await requireSession();
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
