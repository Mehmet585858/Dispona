"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db";
import { requireBueroSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  fahrerEinladenSchema,
  schichtMusterSchema,
  technischeFahrerEmail,
  type FahrerEinladenEingabe,
  type SchichtMusterEingabe,
} from "@/core/drivers/validation";
import { berlinerMitternacht, mitUhrzeit, wochenTage } from "@/core/shifts/week";

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

export async function schichtenFuerWoche(montagIso: string) {
  const { tenantId } = await requireBueroSession();
  const montag = berlinerMitternacht(montagIso);
  const sonntagEnde = new Date(montag);
  sonntagEnde.setDate(sonntagEnde.getDate() + 7);
  return withTenant(tenantId).shift.findMany({
    where: { start: { gte: montag, lt: sonntagEnde } },
    include: { vehicle: { select: { plate: true } } },
    orderBy: { start: "asc" },
  });
}

export async function fahrerEinladen(
  eingabe: FahrerEinladenEingabe,
): Promise<{ email: string }> {
  const { tenantId } = await requireBueroSession();
  const daten = fahrerEinladenSchema.parse(eingabe);
  const email = technischeFahrerEmail(daten.phone);
  const db = withTenant(tenantId);

  const user = await db.user.create({
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
  await db.driver.create({ data: { tenantId, userId: user.id } });
  revalidatePath("/dispo/fahrer");
  return { email };
}

export async function schichtMusterAnlegen(eingabe: SchichtMusterEingabe, montagIso: string) {
  const { tenantId } = await requireBueroSession();
  const daten = schichtMusterSchema.parse(eingabe);
  const tage = wochenTage(berlinerMitternacht(montagIso));
  const db = withTenant(tenantId);

  for (const wochentagIndex of daten.wochentage) {
    const tag = tage[wochentagIndex];
    const start = mitUhrzeit(tag, daten.start);
    const end = mitUhrzeit(tag, daten.end);

    // Keine doppelte Schicht anlegen, wenn für diesen Fahrer an dem Tag schon eine
    // überlappende Schicht existiert (z. B. weil "Für diese Woche anlegen" zweimal
    // angeklickt wurde).
    const ueberlappend = await db.shift.findFirst({
      where: { driverId: daten.driverId, start: { lt: end }, end: { gt: start } },
      select: { id: true },
    });
    if (ueberlappend) continue;

    await db.shift.create({
      data: { tenantId, driverId: daten.driverId, vehicleId: daten.vehicleId, start, end },
    });
  }
  revalidatePath("/dispo/fahrer");
}

export async function schichtLöschen(id: string) {
  const { tenantId } = await requireBueroSession();
  await withTenant(tenantId).shift.delete({ where: { id } });
  revalidatePath("/dispo/fahrer");
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
    const user = await db.user.create({
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
    await db.driver.create({ data: { tenantId, userId: user.id } });
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
