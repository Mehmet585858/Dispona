/**
 * Ein Fahrer fällt aus ("Ich falle aus" in der Fahrer-App): Schicht als ausgefallen markieren,
 * noch nicht begonnene Fahrten (DISPONIERT) neu vorschlagen, laufende Fahrten (UNTERWEGS/AN_BORD)
 * nur als Problem markieren, da sie sich nicht automatisch umplanen lassen
 * (docs/05-disposition.md "Neuplanung").
 */
import { withTenant } from "@/lib/db";
import { vorschlagBerechnenUndSpeichern } from "@/core/disposition/vorschlagSpeichern";
import { fahrtStatusAendern } from "./status";

/** Problemvermerk nach "Ich falle aus"; wird bei erfolgreicher Neubesetzung entfernt (M-20). */
export const FAHRER_FAELLT_AUS = "Fahrer fällt aus";

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
    await fahrtStatusAendern(tenantId, fahrt.id, "PROBLEM", { userId });
    const aktuell = await db.ride.findUnique({ where: { id: fahrt.id }, select: { problems: true } });
    const problems = [...new Set([...(aktuell?.problems ?? []), FAHRER_FAELLT_AUS])];

    if (fahrt.status === "DISPONIERT") {
      // Maßnahme M-20 (docs/13 R2-5): Fahrzeug und Fahrer von der Fahrt nehmen (wie
      // fahrzeugZuweisungAufheben). Vorher klebte die Fahrt am Wagen des ausgefallenen Fahrers, der
      // Konfliktcheck hielt das Fahrzeug für belegt und der Fahrer sah die Fahrt weiter.
      await db.ride.update({
        where: { id: fahrt.id },
        data: { problems, vehicleId: null, driverId: null, driverAckAt: null, dispatchMode: null },
      });
      await fahrtStatusAendern(tenantId, fahrt.id, "ERFASST", { userId });
      await vorschlagBerechnenUndSpeichern(tenantId, fahrt.id, userId);
      neuVorgeschlagen += 1;
    } else {
      // Laufende Fahrt (UNTERWEGS/AN_BORD): Fahrzeug bleibt eingetragen – es ist tatsächlich dort
      // unterwegs; das Büro entscheidet (Annahme, docs/05 "Neuplanung" schweigt dazu).
      await db.ride.update({ where: { id: fahrt.id }, data: { problems } });
    }
  }

  return { betroffen: betroffeneFahrten.length, neuVorgeschlagen };
}
