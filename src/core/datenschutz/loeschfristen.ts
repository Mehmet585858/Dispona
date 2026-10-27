/**
 * Löschfristen (docs/08-datenschutz-sicherheit.md): Audio nach `audioRetentionDays`, Fahrten und
 * Transkripte nach `dataRetentionDays`, GPS-Punkte nach einem festen Standard von 90 Tagen (die
 * schon berechnete `Ride.distanceKm` bleibt dabei erhalten – "dann nur noch km je Fahrt"). Läuft
 * nachts über src/app/api/cron/loeschfristen/route.ts, ein Mandant nach dem anderen.
 */
import { withTenant } from "@/lib/db";

const GPS_RETENTION_TAGE = 90;

function vorTagen(tage: number): Date {
  const datum = new Date();
  datum.setDate(datum.getDate() - tage);
  return datum;
}

export async function loeschfristenDurchsetzen(tenantId: string) {
  const db = withTenant(tenantId);
  const settings = await db.tenantSettings.findUnique({
    where: { tenantId },
    select: { audioRetentionDays: true, dataRetentionDays: true },
  });
  if (!settings) return { audioGeloescht: 0, fahrtenGeloescht: 0, transkripteGeloescht: 0, gpsGeloescht: 0 };

  const audioGeloescht = await db.call.updateMany({
    where: { startedAt: { lt: vorTagen(settings.audioRetentionDays) }, audioUrl: { not: null } },
    data: { audioUrl: null },
  });

  const transkripteGeloescht = await db.call.updateMany({
    where: { startedAt: { lt: vorTagen(settings.dataRetentionDays) }, transcript: { not: null } },
    data: { transcript: null },
  });

  const alteFahrten = await db.ride.findMany({
    where: { pickupAt: { lt: vorTagen(settings.dataRetentionDays) } },
    select: { id: true },
  });
  const alteFahrtIds = alteFahrten.map((f) => f.id);
  if (alteFahrtIds.length > 0) {
    await db.rideStatusEvent.deleteMany({ where: { rideId: { in: alteFahrtIds } } });
    await db.suggestion.deleteMany({ where: { rideId: { in: alteFahrtIds } } });
    await db.ride.deleteMany({ where: { id: { in: alteFahrtIds } } });
  }

  const gpsGeloescht = await db.vehicleLocation.deleteMany({
    where: { at: { lt: vorTagen(GPS_RETENTION_TAGE) } },
  });

  return {
    audioGeloescht: audioGeloescht.count,
    fahrtenGeloescht: alteFahrtIds.length,
    transkripteGeloescht: transkripteGeloescht.count,
    gpsGeloescht: gpsGeloescht.count,
  };
}
