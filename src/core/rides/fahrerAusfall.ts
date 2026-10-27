/**
 * Ein Fahrer fällt aus ("Ich falle aus" in der Fahrer-App): Schicht als ausgefallen markieren,
 * noch nicht begonnene Fahrten (DISPONIERT) neu vorschlagen, laufende Fahrten (UNTERWEGS/AN_BORD)
 * nur als Problem markieren, da sie sich nicht automatisch umplanen lassen
 * (docs/05-disposition.md "Neuplanung").
 */
import { withTenant } from "@/lib/db";
import { vorschlagBerechnenUndSpeichern } from "@/core/disposition/vorschlagSpeichern";
import { fahrtStatusAendern } from "./status";

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
    await db.ride.update({ where: { id: fahrt.id }, data: { problems: { push: "Fahrer fällt aus" } } });

    if (fahrt.status === "DISPONIERT") {
      await fahrtStatusAendern(tenantId, fahrt.id, "ERFASST", { userId });
      await vorschlagBerechnenUndSpeichern(tenantId, fahrt.id, userId);
      neuVorgeschlagen += 1;
    }
  }

  return { betroffen: betroffeneFahrten.length, neuVorgeschlagen };
}
