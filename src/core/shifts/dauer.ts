/**
 * Geschätzte Fahrtdauer für die Breite der Zeitstrahl-Balken (DISPO-SPEZ.md Abschnitt 3.3).
 * Grobe Schätzung aus Luftlinie statt Routen-Dienst (kein API-Aufruf bei jedem Seitenaufruf/
 * Refresh nötig) – reicht für die Breite eines Balkens, nicht für Navigation.
 */
import { entfernungKm } from "@/lib/geo";
import type { LatLng } from "@/lib/geo";
import { berlinerMitternacht, datumIso, mitUhrzeit, tagVerschieben } from "./week";

const DURCHSCHNITT_KMH = 32;
const LADEZEIT_MINUTEN: Record<string, number> = {
  LIEGEND: 15,
  TRAGESTUHL: 10,
  ROLLSTUHL: 8,
  SITZEND: 5,
};

/** Etwas langsamer als DURCHSCHNITT_KMH angenommen (eine Leerfahrt schließt oft auch Parken/
 * Rangieren am Start- und Zielort ein) und ohne Ladezeit (kein Fahrgast an Bord). Mindestens
 * ANFAHRT_MIN_MINUTEN, auch über eine sehr kurze Strecke - Rüstzeit am Fahrzeug braucht es immer. */
const ANFAHRT_KMH = 28;
const ANFAHRT_MIN_MINUTEN = 4;

/** Geschätzte Leerfahrt-Dauer von einem Standort (letzter Zielort oder Betriebshof) zu einer
 * Abholadresse - dieselbe Luftlinien-Schätzung wie fahrtDauerMinuten(), nur ohne Transportart-
 * abhängige Ladezeit, da hier noch niemand ein- oder aussteigt. */
export function anfahrtMinuten(von: LatLng, bis: LatLng): number {
  const minuten = (entfernungKm(von, bis) / ANFAHRT_KMH) * 60;
  return Math.max(ANFAHRT_MIN_MINUTEN, Math.round(minuten));
}

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

/**
 * Zeitraum einer Schicht aus Tag + Uhrzeiten (Maßnahme M-18, Prüfbericht S2-004). Liegt die Endzeit
 * vor (oder auf) der Startzeit, endet die Schicht am Folgetag – "22:00–06:00" ist eine Nachtschicht,
 * kein Fehler. Vorher wurde das Ende vor dem Beginn gespeichert; nachts fand das System dann nie
 * einen Fahrer im Dienst. Rechnet über week.ts (Berliner Zeit, sommerzeitfest).
 */
export function schichtZeitraum(tag: Date, startHhMm: string, endeHhMm: string): { start: Date; end: Date; folgetag: boolean } {
  const start = mitUhrzeit(tag, startHhMm);
  const folgetag = endeHhMm <= startHhMm;
  const endTag = folgetag ? berlinerMitternacht(tagVerschieben(datumIso(tag), 1)) : tag;
  return { start, end: mitUhrzeit(endTag, endeHhMm), folgetag };
}
