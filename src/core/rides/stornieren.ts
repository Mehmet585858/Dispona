/** Eine Fahrt stornieren und, falls schon ein Fahrer zugewiesen ist, ihn benachrichtigen. */
import { withTenant } from "@/lib/db";
import { pushAnFahrer } from "@/core/notify/push";
import { stornierteFahrtText } from "@/core/notify/texte";
import { fahrtStatusAendern } from "./status";

function uhrzeitBerlin(datum: Date): string {
  return datum.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
}

export async function fahrtStornieren(tenantId: string, rideId: string, optionen?: { userId?: string }) {
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({ where: { id: rideId }, select: { pickupAt: true, driverId: true } });
  if (!fahrt) throw new Error("Fahrt nicht gefunden.");

  await fahrtStatusAendern(tenantId, rideId, "STORNIERT", { userId: optionen?.userId });

  if (fahrt.driverId) {
    const text = stornierteFahrtText(uhrzeitBerlin(fahrt.pickupAt));
    await pushAnFahrer(tenantId, fahrt.driverId, { title: "Fahrt entfällt", body: text, url: "/fahrer" });
    await db.notification.create({
      data: { tenantId, channel: "PUSH", toRef: fahrt.driverId, rideId, kind: "STORNO" },
    });
  }
}
