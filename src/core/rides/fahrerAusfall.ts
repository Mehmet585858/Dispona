/**
 * Ein Fahrer fällt aus ("Ich falle aus" in der Fahrer-App): Schicht als ausgefallen markieren,
 * noch nicht begonnene Fahrten (DISPONIERT) neu vorschlagen, laufende Fahrten (UNTERWEGS/AN_BORD)
 * nur als Problem markieren, da sie sich nicht automatisch umplanen lassen
 * (docs/05-disposition.md "Neuplanung").
 */
import { withTenant } from "@/lib/db";
import { vorschlagBerechnenUndSpeichern } from "@/core/disposition/vorschlagSpeichern";
import { fahrtEntzogenMelden } from "@/core/disposition/zuweisen";
import { fahrtStatusAendern } from "./status";

/** Problemvermerk nach "Ich falle aus"; wird bei erfolgreicher Neubesetzung entfernt (M-20). */
export const FAHRER_FAELLT_AUS = "Fahrer fällt aus";

/**
 * Gibt eine zugewiesene, noch nicht begonnene Fahrt (DISPONIERT) frei – genau wie bei "Ich falle
 * aus": Hinweis in die Problemliste (erscheint beim Disponenten), Fahrzeug und Fahrer lösen, zurück
 * auf ERFASST und neu vorschlagen. Genutzt von "Ich falle aus" und vom Schichtplan (Schicht
 * geändert oder gelöscht, Beifahrer deaktiviert). Mit `fahrerBenachrichtigen` bekommt der bisherige
 * Fahrer die übliche Push "Fahrt entzogen" (nur Uhrzeit). Gibt false zurück, wenn die Fahrt nicht
 * (mehr) DISPONIERT ist – dann bleibt sie unverändert.
 */
export async function disponierteFahrtFreigeben(
  tenantId: string,
  rideId: string,
  hinweis: string,
  optionen: { userId?: string; fahrerBenachrichtigen?: boolean } = {},
): Promise<boolean> {
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({ where: { id: rideId }, select: { status: true, driverId: true, pickupAt: true } });
  if (!fahrt || fahrt.status !== "DISPONIERT") return false;

  // Reihenfolge wegen Trigger Ride_disponiert_mit_fahrer (M-72): erst DISPONIERT verlassen, dann
  // Fahrzeug und Fahrer lösen.
  await fahrtStatusAendern(tenantId, rideId, "PROBLEM", { userId: optionen.userId });
  const aktuell = await db.ride.findUnique({ where: { id: rideId }, select: { problems: true } });
  const problems = [...new Set([...(aktuell?.problems ?? []), hinweis])];
  // Maßnahme M-20 (docs/13 R2-5): Fahrzeug und Fahrer von der Fahrt nehmen (wie
  // fahrzeugZuweisungAufheben). Vorher klebte die Fahrt am Wagen des ausgefallenen Fahrers, der
  // Konfliktcheck hielt das Fahrzeug für belegt und der Fahrer sah die Fahrt weiter.
  await db.ride.update({
    where: { id: rideId },
    data: { problems, vehicleId: null, driverId: null, driverAckAt: null, dispatchMode: null },
  });
  await fahrtStatusAendern(tenantId, rideId, "ERFASST", { userId: optionen.userId });
  await vorschlagBerechnenUndSpeichern(tenantId, rideId, optionen.userId);
  if (optionen.fahrerBenachrichtigen && fahrt.driverId) {
    await fahrtEntzogenMelden(tenantId, fahrt.driverId, rideId, fahrt.pickupAt);
  }
  return true;
}

export async function fahrerFaelltAusKern(
  tenantId: string,
  driverId: string,
  von: Date,
  bis: Date,
  userId?: string,
): Promise<{ betroffen: number; neuVorgeschlagen: number }> {
  const db = withTenant(tenantId);

  await db.shift.updateMany({
    where: { driverId, start: { lt: bis }, end: { gte: von } },
    data: { unavailable: true },
  });

  const betroffeneFahrten = await db.ride.findMany({
    where: { driverId, pickupAt: { gte: von, lt: bis }, status: { in: ["DISPONIERT", "UNTERWEGS", "AN_BORD"] } },
    select: { id: true, status: true },
  });

  let neuVorgeschlagen = 0;
  for (const fahrt of betroffeneFahrten) {
    if (fahrt.status === "DISPONIERT") {
      if (await disponierteFahrtFreigeben(tenantId, fahrt.id, FAHRER_FAELLT_AUS, { userId })) neuVorgeschlagen += 1;
    } else {
      // Laufende Fahrt (UNTERWEGS/AN_BORD): Fahrzeug bleibt eingetragen – es ist tatsächlich dort
      // unterwegs; das Büro entscheidet (Annahme, docs/05 "Neuplanung" schweigt dazu).
      await fahrtStatusAendern(tenantId, fahrt.id, "PROBLEM", { userId });
      const aktuell = await db.ride.findUnique({ where: { id: fahrt.id }, select: { problems: true } });
      const problems = [...new Set([...(aktuell?.problems ?? []), FAHRER_FAELLT_AUS])];
      await db.ride.update({ where: { id: fahrt.id }, data: { problems } });
    }
  }

  return { betroffen: betroffeneFahrten.length, neuVorgeschlagen };
}
