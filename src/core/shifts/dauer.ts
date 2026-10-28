/**
 * Geschätzte Fahrtdauer für die Breite der Zeitstrahl-Balken (DISPO-SPEZ.md Abschnitt 3.3).
 * Grobe Schätzung aus Luftlinie statt Routen-Dienst (kein API-Aufruf bei jedem Seitenaufruf/
 * Refresh nötig) – reicht für die Breite eines Balkens, nicht für Navigation.
 */
import { entfernungKm } from "@/lib/geo";
import type { LatLng } from "@/lib/geo";

const DURCHSCHNITT_KMH = 32;
const LADEZEIT_MINUTEN: Record<string, number> = {
  LIEGEND: 15,
  TRAGESTUHL: 10,
  ROLLSTUHL: 8,
  SITZEND: 5,
};

export function fahrtDauerMinuten(
  transportType: string,
  pickupOrt: LatLng,
  dropoffOrt: LatLng,
): number {
  const fahrtMinuten = (entfernungKm(pickupOrt, dropoffOrt) / DURCHSCHNITT_KMH) * 60;
  const ladezeit = LADEZEIT_MINUTEN[transportType] ?? 10;
  return Math.max(10, Math.round(fahrtMinuten + ladezeit));
}

export function geplantesEnde(pickupAt: Date, transportType: string, pickupOrt: LatLng, dropoffOrt: LatLng): Date {
  const minuten = fahrtDauerMinuten(transportType, pickupOrt, dropoffOrt);
  return new Date(pickupAt.getTime() + minuten * 60_000);
}
