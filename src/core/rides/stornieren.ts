/** Eine Fahrt stornieren und, falls schon ein Fahrer zugewiesen ist, ihn benachrichtigen. */
import { withTenant } from "@/lib/db";
import { pushAnFahrer } from "@/core/notify/push";
import { abgebrocheneFahrtText, stornierteFahrtText } from "@/core/notify/texte";
import { fahrtStatusAendern } from "./status";
import { istLaufend } from "./stornierbar";


/** Problemcode einer vom Büro abgebrochenen, laufenden Fahrt. */
export const PROBLEM_FAHRT_ABGEBROCHEN = "FAHRT_ABGEBROCHEN";

export class FahrtLaeuftBereitsError extends Error {
  constructor() {
    super("Die Fahrt läuft bereits – stornieren ist nicht mehr möglich. Stattdessen „Fahrt abbrechen“.");
  }
}

function uhrzeitBerlin(datum: Date): string {
  return datum.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
}

export async function fahrtStornieren(tenantId: string, rideId: string, optionen?: { userId?: string }) {
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({ where: { id: rideId }, select: { pickupAt: true, driverId: true, status: true } });
  if (!fahrt) throw new Error("Fahrt nicht gefunden.");
  // Maßnahme M-19: eine laufende Fahrt verschwindet nicht still vom Handy des Fahrers.
  if (istLaufend(fahrt.status)) throw new FahrtLaeuftBereitsError();

  await fahrtStatusAendern(tenantId, rideId, "STORNIERT", { userId: optionen?.userId });

  if (fahrt.driverId) {
    const text = stornierteFahrtText(uhrzeitBerlin(fahrt.pickupAt));
    await pushAnFahrer(tenantId, fahrt.driverId, { title: "Fahrt entfällt", body: text, url: "/fahrer" });
    await db.notification.create({
      data: { tenantId, channel: "PUSH", toRef: fahrt.driverId, rideId, kind: "STORNO" },
    });
  }
}

/**
 * Eine LAUFENDE Fahrt abbrechen (Maßnahme M-19, docs/13 R3-3) – nur das Büro, mit Rückfrage in der
 * Oberfläche. Die Fahrt geht auf PROBLEM mit Vermerk FAHRT_ABGEBROCHEN (landet in "Braucht Sie";
 * dort entscheidet der Disponent, wie es weitergeht), der Fahrer bekommt eine eigene Meldung statt
 * "Fahrt entfällt". Annahme: kein eigener Status, weil die Spezifikation keinen vorsieht.
 */
export async function fahrtAbbrechen(tenantId: string, rideId: string, optionen: { userId?: string }) {
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({ where: { id: rideId }, select: { pickupAt: true, driverId: true, status: true } });
  if (!fahrt) throw new Error("Fahrt nicht gefunden.");
  if (!istLaufend(fahrt.status)) {
    throw new Error("Die Fahrt ist nicht unterwegs – vor der Abholung bitte stornieren.");
  }

  await db.$transaction(async (tx) => {
    await fahrtStatusAendern(tenantId, rideId, "PROBLEM", { userId: optionen.userId, tx });
    await tx.ride.update({ where: { id: rideId }, data: { problems: { push: PROBLEM_FAHRT_ABGEBROCHEN } } });
  });

  if (fahrt.driverId) {
    const text = abgebrocheneFahrtText(uhrzeitBerlin(fahrt.pickupAt));
    await pushAnFahrer(tenantId, fahrt.driverId, { title: "Fahrt abgebrochen", body: text, url: "/fahrer" });
    await db.notification.create({
      data: { tenantId, channel: "PUSH", toRef: fahrt.driverId, rideId, kind: "ABBRUCH" },
    });
  }
}
