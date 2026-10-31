/**
 * Setzt die öffentliche Live-Demo (src/core/demo/const.ts) regelmäßig zurück: löscht bereits
 * stattgefundene Fahrten, Anrufe und die dabei angelegten Fahrgäste, sobald sie älter als
 * DEMO_AUFRAEUM_STUNDEN sind - damit die Seite nicht mit altem Betrieb vollläuft, und falls die
 * Demo-Telefonnummer einmal live geht, auch echte Namen/Rückrufnummern echter Interessenten nicht
 * unbegrenzt liegen bleiben. Bewusst eigenständig statt über die allgemeinen Löschfristen
 * (src/core/datenschutz/loeschfristen.ts, dort Tage/Wochen statt Stunden). Läuft stündlich über
 * src/app/api/cron/demoZuruecksetzen/route.ts - der laufende Betrieb (betriebSimulieren.ts) legt
 * danach einfach wieder neue Fahrten nach, der Tag wirkt dadurch nie dauerhaft leer.
 */
import { withTenant } from "@/lib/db";

const DEMO_AUFRAEUM_STUNDEN = 3;

/**
 * Maßnahme M-01 (Punkt 4): kein Standardwert für den Mandanten mehr – wer löscht, nennt den
 * Mandanten ausdrücklich (der Cron übergibt DEMO_TENANT_ID). Ein versehentlicher Aufruf ohne
 * Argument ist damit ein Typfehler statt einer stillen Löschung.
 */
export async function demoZuruecksetzen(tenantId: string) {
  const db = withTenant(tenantId);
  const grenze = new Date(Date.now() - DEMO_AUFRAEUM_STUNDEN * 60 * 60_000);

  // pickupAt < jetzt zusätzlich zu createdAt < grenze: seedDemoTenant.ts/betriebSimulieren.ts
  // legen jetzt oft viele Fahrten auf einmal an, mit Abholzeiten über den ganzen Tag verteilt
  // (auch Stunden in der Zukunft) - ohne diese Bedingung würde eine erst für später heute
  // eingeplante Fahrt schon gelöscht, bevor sie überhaupt stattgefunden hat.
  const alteFahrten = await db.ride.findMany({
    where: { createdAt: { lt: grenze }, pickupAt: { lt: new Date() } },
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

  const positionenGeloescht = await vehicleLocationsAufraeumen(db, grenze);

  return {
    fahrtenGeloescht: fahrtIds.length,
    fahrgaesteGeloescht,
    anrufeGeloescht: alteAnrufe.count,
    positionenGeloescht,
  };
}

/** VehicleLocation hat keine rideId-Beziehung und hängt dadurch an keinem Fahrt-Lebenszyklus - im
 * Gegensatz zu RideStatusEvent/Suggestion/Notification oben wird hier nie etwas gelöscht, obwohl
 * positionenAktualisieren() (betriebSimulieren.ts) für jedes aktive Fahrzeug jede Minute eine neue
 * Zeile anlegt. Ohne diese Aufräumung wächst die Tabelle seit Produktionsstart unbegrenzt weiter.
 * Die jeweils neueste Zeile pro Fahrzeug bleibt immer erhalten (auch wenn sie älter als die Grenze
 * ist), sonst würde ein lange geparktes, nie neu positioniertes Fahrzeug seine einzige bekannte
 * Position verlieren. */
async function vehicleLocationsAufraeumen(db: ReturnType<typeof withTenant>, grenze: Date): Promise<number> {
  const fahrzeuge = await db.vehicle.findMany({ select: { id: true } });
  let geloescht = 0;
  for (const fahrzeug of fahrzeuge) {
    const neueste = await db.vehicleLocation.findFirst({
      where: { vehicleId: fahrzeug.id },
      orderBy: { at: "desc" },
      select: { id: true },
    });
    const { count } = await db.vehicleLocation.deleteMany({
      where: { vehicleId: fahrzeug.id, at: { lt: grenze }, id: neueste ? { not: neueste.id } : undefined },
    });
    geloescht += count;
  }
  return geloescht;
}
