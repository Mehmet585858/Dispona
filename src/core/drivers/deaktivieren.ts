/**
 * Fahrer deaktivieren – Offboarding (Maßnahme M-12, docs/13 R3-4). Vorher gab es keine
 * Möglichkeit, einen gekündigten Fahrer zu sperren: seine 30-Tage-Sitzung behielt vollen Zugriff
 * auf Fahrten, Status, GPS und Push, bis der Admin jede Geräte-Sitzung einzeln fand.
 *
 * Deaktivieren heißt: Driver.active = false, alle Sitzungen und Push-Abos weg, laufende Schicht
 * beendet, kommende Schichten als ausgefallen markiert, noch nicht begonnene Fahrten neu
 * vorgeschlagen (wie "Ich falle aus"). Jede Fahrer-Action prüft active (eigenerFahrer in
 * src/app/fahrer/actions.ts), der Anmelde-Link wird für deaktivierte Konten nicht mehr versendet.
 */
import { withTenant } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { fahrerFaelltAusKern } from "@/core/rides/fahrerAusfall";

const EIN_JAHR_MS = 365 * 24 * 60 * 60_000;

export async function fahrerDeaktivieren(tenantId: string, driverId: string, userId?: string) {
  const db = withTenant(tenantId);
  const fahrer = await db.driver.findUnique({ where: { id: driverId }, select: { id: true, userId: true, active: true } });
  if (!fahrer) throw new Error("Fahrer nicht gefunden.");
  const jetzt = new Date();

  await db.driver.update({ where: { id: driverId }, data: { active: false, deactivatedAt: jetzt } });

  // Sitzungen gehören better-auth (keine tenantId-Spalte); die Zugehörigkeit ist über die
  // mandantengefilterte Driver-Zeile oben bewiesen.
  const sitzungen = await prisma.session.deleteMany({ where: { userId: fahrer.userId } });
  const pushAbos = await db.pushSubscription.deleteMany({ where: { driverId } });

  await db.shift.updateMany({
    where: { driverId, startedAt: { not: null }, endedAt: null },
    data: { endedAt: jetzt },
  });
  const umplanung = await fahrerFaelltAusKern(tenantId, driverId, jetzt, new Date(jetzt.getTime() + EIN_JAHR_MS), userId);

  await db.auditLog.create({
    data: { tenantId, userId, action: "driver.deaktiviert", entity: "Driver", entityId: driverId },
  });

  return { sitzungenGeloescht: sitzungen.count, pushAbosGeloescht: pushAbos.count, ...umplanung };
}
