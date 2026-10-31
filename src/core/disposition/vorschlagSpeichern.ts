/** Berechnet die Fahrzeugvorschläge für eine erfasste Fahrt und speichert sie (docs/05-disposition.md). */
import { withTenant } from "@/lib/db";
import { berlinerMitternacht, datumIso } from "@/core/shifts/week";
import { fahrtStatusAendern } from "@/core/rides/status";
import { routingProvider } from "@/providers/routing";
import { vorschlaegeBerechnen, type GeplanteFahrt } from "./vorschlagen";

export async function vorschlagBerechnenUndSpeichern(tenantId: string, rideId: string, userId?: string) {
  const db = withTenant(tenantId);
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { paket: true } });
  // Lite hat keinen Fahrzeugvorschlag und keine automatische Einplanung (DISPO-SPEZ.md Abschnitt 2) –
  // die Fahrt bleibt bei ERFASST, der Disponent markiert sie manuell als "Angenommen".
  if (tenant?.paket === "LITE") return;

  const fahrt = await db.ride.findUnique({
    where: { id: rideId },
    include: { pickupPlace: true, dropoffPlace: true },
  });
  if (!fahrt) return;

  const settings = await db.tenantSettings.findUnique({ where: { tenantId } });
  const depot = settings?.depotAddress as { lat: number; lng: number } | null;
  if (!depot) return; // Einrichtung noch nicht abgeschlossen – kein Betriebshof hinterlegt

  const tagStart = berlinerMitternacht(datumIso(fahrt.pickupAt));
  const tagEnde = new Date(tagStart);
  tagEnde.setDate(tagEnde.getDate() + 1);

  const fahrzeuge = await db.vehicle.findMany({ where: { active: true } });
  const schichten = await db.shift.findMany({ where: { start: { lt: tagEnde }, end: { gte: tagStart } } });
  const tagesplanFahrten = await db.ride.findMany({
    where: {
      pickupAt: { gte: tagStart, lt: tagEnde },
      vehicleId: { not: null },
      id: { not: rideId },
      status: { notIn: ["STORNIERT"] },
    },
    include: { pickupPlace: true, dropoffPlace: true },
  });

  const tagesplan: GeplanteFahrt[] = tagesplanFahrten.map((r) => ({
    vehicleId: r.vehicleId!,
    pickupAt: r.pickupAt,
    appointmentAt: r.appointmentAt,
    pickupOrt: { lat: r.pickupPlace.lat, lng: r.pickupPlace.lng },
    dropoffOrt: { lat: r.dropoffPlace.lat, lng: r.dropoffPlace.lng },
    transportType: r.transportType,
  }));

  const { vorschlaege, keinKandidat } = await vorschlaegeBerechnen({
    fahrt: {
      transportType: fahrt.transportType,
      companion: fahrt.companion,
      pickupAt: fahrt.pickupAt,
      appointmentAt: fahrt.appointmentAt,
      pickupOrt: { lat: fahrt.pickupPlace.lat, lng: fahrt.pickupPlace.lng },
      dropoffOrt: { lat: fahrt.dropoffPlace.lat, lng: fahrt.dropoffPlace.lng },
    },
    fahrzeuge,
    schichten,
    tagesplan,
    depot,
    routing: routingProvider,
  });

  if (vorschlaege.length > 0) {
    await db.suggestion.create({
      data: {
        tenantId,
        rideId,
        options: vorschlaege.map((v) => ({
          vehicleId: v.vehicleId,
          plate: v.plate,
          etaMin: v.etaMin,
          onTime: !v.zuSpaet,
          score: Math.round(v.score * 10) / 10,
          reason: v.begruendung,
        })),
        decision: "OFFEN",
      },
    });
    // Maßnahme M-20 (docs/13 R2-6): ein Vorschlag erledigt ein früheres KEIN_FAHRZEUG.
    if (fahrt.problems.includes("KEIN_FAHRZEUG")) {
      await db.ride.update({ where: { id: rideId }, data: { problems: fahrt.problems.filter((p) => p !== "KEIN_FAHRZEUG") } });
    }
    await fahrtStatusAendern(tenantId, rideId, "VORGESCHLAGEN", { userId });
  } else if (keinKandidat && !fahrt.problems.includes("KEIN_FAHRZEUG")) {
    // Nur einmal eintragen – vorher wuchs die Liste bei jeder Neuberechnung um einen Eintrag.
    await db.ride.update({ where: { id: rideId }, data: { problems: { push: "KEIN_FAHRZEUG" } } });
  }
}
