"use server";

import { withTenant } from "@/lib/db";
import { requireBueroSession } from "@/lib/session";
import { berlinerMitternacht, datumIso, wochenStart } from "@/core/shifts/week";
import { kennzahlenBerechnen } from "@/core/auswertung/kennzahlen";

export async function kennzahlenLaden(montagIso?: string) {
  const { tenantId } = await requireBueroSession();
  const db = withTenant(tenantId);

  const montag = montagIso ? berlinerMitternacht(montagIso) : wochenStart(new Date());
  const sonntagEnde = new Date(montag);
  sonntagEnde.setDate(sonntagEnde.getDate() + 7);

  const anrufeRoh = await db.call.findMany({
    where: { startedAt: { gte: montag, lt: sonntagEnde } },
    select: { id: true, outcome: true },
  });

  const erfassteCallIds = anrufeRoh.filter((a) => a.outcome === "FAHRT_ERFASST").map((a) => a.id);
  const fahrtenDerErfasstenAnrufe = await db.ride.findMany({
    where: { callId: { in: erfassteCallIds } },
    select: { callId: true, problems: true },
  });
  const hatProblemeProCall = new Map<string, boolean>();
  for (const fahrt of fahrtenDerErfasstenAnrufe) {
    if (!fahrt.callId) continue;
    hatProblemeProCall.set(fahrt.callId, (hatProblemeProCall.get(fahrt.callId) ?? false) || fahrt.problems.length > 0);
  }

  const vorschlaegeRoh = await db.suggestion.findMany({
    where: { decidedAt: { gte: montag, lt: sonntagEnde } },
    select: { decision: true },
  });

  const disponierteFahrtenRoh = await db.ride.findMany({
    where: { pickupAt: { gte: montag, lt: sonntagEnde }, vehicleId: { not: null } },
    select: { dispatchMode: true },
  });

  const erledigteMitTermin = await db.ride.findMany({
    where: { pickupAt: { gte: montag, lt: sonntagEnde }, status: "ERLEDIGT", appointmentAt: { not: null } },
    select: { completedAt: true, appointmentAt: true },
  });

  const kennzahlen = kennzahlenBerechnen({
    anrufe: anrufeRoh,
    erfassteFahrtenHabenProbleme: erfassteCallIds.map((id) => hatProblemeProCall.get(id) ?? false),
    entschiedeneVorschlaege: vorschlaegeRoh,
    disponierteFahrten: disponierteFahrtenRoh,
    fahrtenMitTermin: erledigteMitTermin
      .filter((f) => f.completedAt !== null)
      .map((f) => ({ puenktlich: f.completedAt! <= f.appointmentAt! })),
  });

  return { montagIso: datumIso(montag), kennzahlen };
}
