/**
 * Setzt die öffentliche Live-Demo (src/core/demo/const.ts) regelmäßig zurück: löscht Fahrten,
 * Anrufe und die dabei live angelegten Fahrgäste, sobald sie älter als DEMO_AUFRAEUM_STUNDEN sind.
 * Bewusst eigenständig statt über die allgemeinen Löschfristen
 * (src/core/datenschutz/loeschfristen.ts, dort Tage/Wochen statt Stunden): hier kommen echte
 * Namen und Rückrufnummern echter Interessenten zusammen (keine Testdaten!), die so kurz wie
 * sinnvoll aufbewahrt werden sollen, außerdem soll die öffentliche Live-Seite nicht mit alten
 * Testanrufen vollaufen. Läuft stündlich über src/app/api/cron/demoZuruecksetzen/route.ts.
 */
import { withTenant } from "@/lib/db";
import { DEMO_TENANT_ID } from "./const";

const DEMO_AUFRAEUM_STUNDEN = 3;

export async function demoZuruecksetzen(tenantId: string = DEMO_TENANT_ID) {
  const db = withTenant(tenantId);
  const grenze = new Date(Date.now() - DEMO_AUFRAEUM_STUNDEN * 60 * 60_000);

  const alteFahrten = await db.ride.findMany({
    where: { createdAt: { lt: grenze } },
    select: { id: true, passengerId: true },
  });
  const fahrtIds = alteFahrten.map((f) => f.id);
  const fahrgastIds = [...new Set(alteFahrten.map((f) => f.passengerId))];

  if (fahrtIds.length > 0) {
    await db.rideStatusEvent.deleteMany({ where: { rideId: { in: fahrtIds } } });
    await db.suggestion.deleteMany({ where: { rideId: { in: fahrtIds } } });
    await db.notification.deleteMany({ where: { rideId: { in: fahrtIds } } });
    await db.ride.deleteMany({ where: { id: { in: fahrtIds } } });
  }

  // Nur Fahrgäste löschen, die jetzt (nach dem Löschen oben) keine Fahrt mehr haben.
  let fahrgaesteGeloescht = 0;
  for (const fahrgastId of fahrgastIds) {
    const nochVorhanden = await db.ride.count({ where: { passengerId: fahrgastId } });
    if (nochVorhanden === 0) {
      await db.passenger.delete({ where: { id: fahrgastId } }).catch(() => {});
      fahrgaesteGeloescht += 1;
    }
  }

  // "rides: { none: {} }" statt einfach nach startedAt zu löschen: verhindert einen
  // Fremdschlüssel-Fehler, falls eine noch nicht gelöschte Fahrt auf diesen Anruf zeigt.
  const alteAnrufe = await db.call.deleteMany({
    where: { startedAt: { lt: grenze }, rides: { none: {} } },
  });

  return { fahrtenGeloescht: fahrtIds.length, fahrgaesteGeloescht, anrufeGeloescht: alteAnrufe.count };
}
