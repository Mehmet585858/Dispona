"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db";
import { requireAdminSession, requireBueroSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fahrerEinladenSchema, technischeFahrerEmail, type FahrerEinladenEingabe } from "@/core/drivers/validation";
import { fahrerDeaktivieren as fahrerDeaktivierenKern } from "@/core/drivers/deaktivieren";
import { scalamobilEinweisungSetzen } from "@/core/shifts/schichtplanSpeichern";

export async function fahrerLaden() {
  const { tenantId } = await requireBueroSession();
  return withTenant(tenantId).driver.findMany({
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });
}

export async function fahrzeugeFuerAuswahl() {
  const { tenantId } = await requireBueroSession();
  return withTenant(tenantId).vehicle.findMany({
    where: { active: true },
    orderBy: { plate: "asc" },
    select: { id: true, plate: true, wheelchairSpots: true, carryChair: true, stretcher: true },
  });
}

export async function fahrerEinladen(
  eingabe: FahrerEinladenEingabe,
): Promise<{ email: string }> {
  const { tenantId } = await requireBueroSession();
  const daten = fahrerEinladenSchema.parse(eingabe);
  const email = technischeFahrerEmail(daten.phone);
  const db = withTenant(tenantId);

  // Maßnahme M-23 Punkt 3 (S4-009): Nutzer und Fahrerprofil gemeinsam oder gar nicht – vorher blieb
  // bei einem Fehler zwischen beiden Schritten ein Nutzer ohne Fahrerprofil zurück.
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id: randomUUID(),
        tenantId,
        email,
        name: daten.name,
        phone: daten.phone,
        role: "FAHRER",
        emailVerified: true,
      },
    });
    // Aushilfen nutzen dasselbe Modell – der Einmal-Link-Login funktioniert damit unverändert.
    await tx.driver.create({ data: { tenantId, userId: user.id, istAushilfe: daten.istAushilfe } });
  });
  revalidatePath("/dispo/fahrer");
  revalidatePath("/dispo/schichtplan");
  return { email };
}

/** Als Aushilfe kennzeichnen oder nicht (Personalliste). */
export async function aushilfeSetzen(driverId: string, istAushilfe: boolean) {
  const { tenantId } = await requireBueroSession();
  await withTenant(tenantId).driver.update({ where: { id: driverId }, data: { istAushilfe: istAushilfe === true } });
  revalidatePath("/dispo/fahrer");
  revalidatePath("/dispo/schichtplan");
}

/**
 * Scalamobil-Einweisung setzen oder entfernen. Entfernen wird abgelehnt (mit Meldung), solange
 * dieser Person Fahrten mit Treppe zugewiesen sind, die nur über das Scalamobil gehen.
 */
export async function einweisungSetzen(driverId: string, wert: boolean): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const { tenantId, userId } = await requireBueroSession();
  const ergebnis = await scalamobilEinweisungSetzen(tenantId, driverId, wert === true, userId);
  revalidatePath("/dispo/fahrer");
  revalidatePath("/dispo/schichtplan");
  return ergebnis;
}

export async function fahrerImportieren(
  zeilen: Record<string, string>[],
): Promise<{ ok: number; fehler: string[] }> {
  const { tenantId } = await requireBueroSession();
  const db = withTenant(tenantId);
  const fehler: string[] = [];
  let ok = 0;
  for (const [index, zeile] of zeilen.entries()) {
    const ergebnis = fahrerEinladenSchema.safeParse(zeile);
    if (!ergebnis.success) {
      fehler.push(`Zeile ${index + 2}: ${ergebnis.error.issues[0]?.message ?? "ungültig"}`);
      continue;
    }
    const email = technischeFahrerEmail(ergebnis.data.phone);
    const vorhanden = await db.user.findFirst({ where: { email } });
    if (vorhanden) {
      fehler.push(`Zeile ${index + 2}: Handynummer schon vorhanden`);
      continue;
    }
    // Maßnahme M-23 Punkt 3: Nutzer und Fahrerprofil gemeinsam oder gar nicht.
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: randomUUID(),
          tenantId,
          email,
          name: ergebnis.data.name,
          phone: ergebnis.data.phone,
          role: "FAHRER",
          emailVerified: true,
        },
      });
      await tx.driver.create({ data: { tenantId, userId: user.id } });
    });
    ok += 1;
  }
  revalidatePath("/dispo/fahrer");
  return { ok, fehler };
}

/**
 * Angemeldete Geräte (Sitzungen) eines Fahrers (docs/08-datenschutz-sicherheit.md "Admin kann
 * Geräte abmelden"). better-auths eigene list/revoke-Endpunkte setzen die Sitzung des Aufrufers
 * selbst voraus, nicht die eines anderen Nutzers – deshalb hier direkt über prisma.session
 * (eigene Tabelle von better-auth, nicht über withTenant), mit eigener Mandantenprüfung.
 */
export async function fahrerGeraeteLaden(driverId: string) {
  const { tenantId } = await requireBueroSession();
  const fahrer = await withTenant(tenantId).driver.findUnique({ where: { id: driverId }, select: { userId: true } });
  if (!fahrer) throw new Error("Fahrer nicht gefunden.");
  return prisma.session.findMany({
    where: { userId: fahrer.userId },
    select: { id: true, createdAt: true, updatedAt: true, userAgent: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function fahrerGeraetAbmelden(driverId: string, sessionId: string) {
  const { tenantId, userId, role } = await requireBueroSession();
  if (role !== "ADMIN") {
    throw new Error("Nur Admins dürfen Geräte abmelden.");
  }
  const fahrer = await withTenant(tenantId).driver.findUnique({ where: { id: driverId }, select: { userId: true } });
  if (!fahrer) throw new Error("Fahrer nicht gefunden.");

  await prisma.session.deleteMany({ where: { id: sessionId, userId: fahrer.userId } });
  await withTenant(tenantId).auditLog.create({
    data: { tenantId, userId, action: "driver.geraet_abgemeldet", entity: "Driver", entityId: driverId },
  });
  revalidatePath("/dispo/fahrer");
}

/**
 * Fahrer deaktivieren (Offboarding, Maßnahme M-12): nur ADMIN. Löscht Sitzungen und Push-Abos,
 * beendet die laufende Schicht, markiert kommende Schichten als ausgefallen und lässt offene
 * Fahrten neu vorschlagen – siehe src/core/drivers/deaktivieren.ts.
 */
export async function fahrerDeaktivieren(driverId: string) {
  const { tenantId, userId } = await requireAdminSession();
  const ergebnis = await fahrerDeaktivierenKern(tenantId, driverId, userId);
  revalidatePath("/dispo/fahrer");
  revalidatePath("/dispo/schichtplan");
  revalidatePath("/dispo");
  return ergebnis;
}
