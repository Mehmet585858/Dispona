/**
 * Minimaler Ausschnitt aus RFC 5545 für Serienfahrten (docs/09-bauplan.md Phase 8): nur
 * wöchentliche Regeln mit Wochentagen, z. B. "FREQ=WEEKLY;BYDAY=MO,WE,FR". Reine Funktionen,
 * Datumsangaben als JJJJ-MM-TT-Strings (wie in week.ts).
 */
// Wochentag eines Kalendertags hängt nicht von der Zeitzone ab (reines Kalenderdatum), deshalb
// hier bewusst mit UTC-Methoden auf Datums-Strings gerechnet statt über echte Zeitpunkte
// (wie week.ts es für Uhrzeiten tut) – vermeidet Verschiebungen durch die Server-Zeitzone.

export const WOCHENTAGE = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"] as const;
export type Wochentag = (typeof WOCHENTAGE)[number];

export const WOCHENTAG_LABEL: Record<Wochentag, string> = {
  MO: "Montag",
  DI: "Dienstag",
  MI: "Mittwoch",
  DO: "Donnerstag",
  FR: "Freitag",
  SA: "Samstag",
  SO: "Sonntag",
};

const RFC_CODE: Record<Wochentag, string> = { MO: "MO", DI: "TU", MI: "WE", DO: "TH", FR: "FR", SA: "SA", SO: "SU" };
const VON_RFC_CODE = Object.fromEntries(Object.entries(RFC_CODE).map(([de, rfc]) => [rfc, de])) as Record<string, Wochentag>;

/** `["MO","MI","FR"]` → `"FREQ=WEEKLY;BYDAY=MO,WE,FR"` */
export function rruleAusWochentagen(wochentage: Wochentag[]): string {
  const sortiert = WOCHENTAGE.filter((w) => wochentage.includes(w));
  return `FREQ=WEEKLY;BYDAY=${sortiert.map((w) => RFC_CODE[w]).join(",")}`;
}

/** `"FREQ=WEEKLY;BYDAY=MO,WE,FR"` → `["MO","MI","FR"]` */
export function wochentageAusRrule(rrule: string): Wochentag[] {
  const treffer = /BYDAY=([A-Z,]+)/.exec(rrule);
  if (!treffer) return [];
  return treffer[1]
    .split(",")
    .map((code) => VON_RFC_CODE[code])
    .filter((w): w is Wochentag => w !== undefined);
}

const JS_WOCHENTAG: Wochentag[] = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"]; // Date.getDay() 0=So

function alsUtcTage(isoDatum: string): Date {
  const [jahr, monat, tag] = isoDatum.split("-").map(Number);
  return new Date(Date.UTC(jahr, monat - 1, tag));
}

function isoVonUtcTagen(datum: Date): string {
  return `${datum.getUTCFullYear()}-${String(datum.getUTCMonth() + 1).padStart(2, "0")}-${String(datum.getUTCDate()).padStart(2, "0")}`;
}

/** Alle Termine (JJJJ-MM-TT) der Regel zwischen `vonDatum` und `bisDatum`, beide inklusive. */
export function terminePlanen(rrule: string, vonDatum: string, bisDatum: string): string[] {
  const wochentage = wochentageAusRrule(rrule);
  if (wochentage.length === 0) return [];

  const termine: string[] = [];
  const tag = alsUtcTage(vonDatum);
  const ende = alsUtcTage(bisDatum);
  while (tag.getTime() <= ende.getTime()) {
    if (wochentage.includes(JS_WOCHENTAG[tag.getUTCDay()])) {
      termine.push(isoVonUtcTagen(tag));
    }
    tag.setUTCDate(tag.getUTCDate() + 1);
  }
  return termine;
}
