// Alle Datums-/Uhrzeit-Berechnungen laufen über die Zeitzone Europe/Berlin,
// unabhängig davon, in welcher Zeitzone der Server selbst läuft (docs/02-architektur.md:
// "Uhrzeiten intern in UTC speichern, in der Oberfläche in Europe/Berlin anzeigen").

const ZEITZONE = "Europe/Berlin";
const WOCHENTAG_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const WOCHENTAG_LABEL = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
] as const;

export const WOCHENTAG_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

type BerlinTeile = {
  jahr: number;
  monat: number;
  tag: number;
  stunde: number;
  minute: number;
  wochentagIndex: number; // 0 = Montag … 6 = Sonntag
};

function teileInBerlin(datum: Date): BerlinTeile {
  const teile = new Intl.DateTimeFormat("en-US", {
    timeZone: ZEITZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(datum);
  const wert = (typ: string) => teile.find((t) => t.type === typ)?.value ?? "";
  return {
    jahr: Number(wert("year")),
    monat: Number(wert("month")),
    tag: Number(wert("day")),
    stunde: Number(wert("hour")) % 24,
    minute: Number(wert("minute")),
    wochentagIndex: WOCHENTAG_EN.indexOf(wert("weekday")),
  };
}

/** Baut aus Berliner Wanduhrzeit (Jahr, Monat, Tag, Stunde, Minute) den passenden UTC-Zeitpunkt, DST-sicher. */
function ausBerlinerZeit(jahr: number, monat: number, tag: number, stunde: number, minute: number): Date {
  const schätzung = new Date(Date.UTC(jahr, monat - 1, tag, stunde, minute));
  const beobachtet = teileInBerlin(schätzung);
  const sollUtc = Date.UTC(jahr, monat - 1, tag, stunde, minute);
  const beobachtetUtc = Date.UTC(
    beobachtet.jahr,
    beobachtet.monat - 1,
    beobachtet.tag,
    beobachtet.stunde,
    beobachtet.minute,
  );
  return new Date(schätzung.getTime() + (sollUtc - beobachtetUtc));
}

/** Montag 00:00 (Berliner Zeit) der Woche, in der `datum` liegt. */
export function wochenStart(datum: Date): Date {
  const teile = teileInBerlin(datum);
  const montagAlsTage = new Date(Date.UTC(teile.jahr, teile.monat - 1, teile.tag));
  montagAlsTage.setUTCDate(montagAlsTage.getUTCDate() - teile.wochentagIndex);
  return ausBerlinerZeit(
    montagAlsTage.getUTCFullYear(),
    montagAlsTage.getUTCMonth() + 1,
    montagAlsTage.getUTCDate(),
    0,
    0,
  );
}

/** Die 7 Tage ab `montag` (00:00 Berliner Zeit, Montag bis Sonntag). */
export function wochenTage(montag: Date): Date[] {
  const teile = teileInBerlin(montag);
  return Array.from({ length: 7 }, (_, index) => {
    const tag = new Date(Date.UTC(teile.jahr, teile.monat - 1, teile.tag));
    tag.setUTCDate(tag.getUTCDate() + index);
    return ausBerlinerZeit(tag.getUTCFullYear(), tag.getUTCMonth() + 1, tag.getUTCDate(), 0, 0);
  });
}

/** Datum als "JJJJ-MM-TT" in Berliner Zeit. */
export function datumIso(datum: Date): string {
  const t = teileInBerlin(datum);
  return `${t.jahr}-${String(t.monat).padStart(2, "0")}-${String(t.tag).padStart(2, "0")}`;
}

/**
 * Maßnahme M-46 Punkt 4 (Prüfbericht S2-020): ungültige Datums-/Uhrzeitangaben werden nicht mehr
 * still umgedeutet ("2026-02-30" → 2. März, "halb acht" → 00:00), sondern abgelehnt. Die Meldung
 * enthält den Eingabewert bewusst nicht – es kann ein Geburtsdatum sein, und Fehler landen in Sentry.
 */
export class UngueltigeZeitangabe extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = "UngueltigeZeitangabe";
  }
}

const DATUM_ISO_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Uhrzeit H:MM oder HH:MM, 00:00–23:59. Die KI-Werkzeuge verlangen strenger HH:MM (validation.ts). */
const UHRZEIT_FORMAT = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function datumTeile(isoDatum: string): [number, number, number] | null {
  const treffer = DATUM_ISO_FORMAT.exec(isoDatum);
  if (!treffer) return null;
  const [jahr, monat, tag] = [Number(treffer[1]), Number(treffer[2]), Number(treffer[3])];
  // Kalendertag wirklich vorhanden? Date.UTC rollt 30.02. in den März – dann passt der Rückweg nicht.
  const probe = new Date(Date.UTC(jahr, monat - 1, tag));
  if (probe.getUTCFullYear() !== jahr || probe.getUTCMonth() !== monat - 1 || probe.getUTCDate() !== tag) return null;
  return [jahr, monat, tag];
}

/** true, wenn `wert` ein echter Kalendertag im Format JJJJ-MM-TT ist. */
export function istDatumIso(wert: string): boolean {
  return datumTeile(wert) !== null;
}

function datumTeileOderFehler(isoDatum: string): [number, number, number] {
  const teile = datumTeile(isoDatum);
  if (!teile) throw new UngueltigeZeitangabe("Ungültiges Datum (erwartet JJJJ-MM-TT, ein echter Kalendertag).");
  return teile;
}

/** Wandelt ein "JJJJ-MM-TT"-Datum in Mitternacht (Berliner Zeit) dieses Tages um. Wirft bei ungültigem Datum. */
export function berlinerMitternacht(isoDatum: string): Date {
  const [jahr, monat, tag] = datumTeileOderFehler(isoDatum);
  return ausBerlinerZeit(jahr, monat, tag, 0, 0);
}

/** Verschiebt ein "JJJJ-MM-TT"-Datum um ganze Tage (kalendersicher, auch über DST-Wechsel hinweg). */
export function tagVerschieben(isoDatum: string, tageVersatz: number): string {
  const [jahr, monat, tag] = datumTeileOderFehler(isoDatum);
  const alsTage = new Date(Date.UTC(jahr, monat - 1, tag));
  alsTage.setUTCDate(alsTage.getUTCDate() + tageVersatz);
  return datumIso(
    ausBerlinerZeit(alsTage.getUTCFullYear(), alsTage.getUTCMonth() + 1, alsTage.getUTCDate(), 12, 0),
  );
}

/** Verschiebt ein "JJJJ-MM-TT"-Datum um ganze Wochen. */
export function montagVerschieben(isoDatum: string, wochenVersatz: number): string {
  return tagVerschieben(isoDatum, wochenVersatz * 7);
}

/** Minuten seit Mitternacht (Berliner Zeit) des Tages, an dem `datum` liegt. */
export function minutenSeitMitternacht(datum: Date): number {
  const t = teileInBerlin(datum);
  return t.stunde * 60 + t.minute;
}

/** Setzt eine Uhrzeit (HH:MM, Berliner Zeit) auf den Kalendertag von `datum`. Wirft bei ungültiger Uhrzeit. */
export function mitUhrzeit(datum: Date, uhrzeitHhMm: string): Date {
  const treffer = UHRZEIT_FORMAT.exec(uhrzeitHhMm);
  if (!treffer) throw new UngueltigeZeitangabe("Ungültige Uhrzeit (erwartet HH:MM, 00:00 bis 23:59).");
  const t = teileInBerlin(datum);
  return ausBerlinerZeit(t.jahr, t.monat, t.tag, Number(treffer[1]), Number(treffer[2]));
}

/** Uhrzeit als "HH:MM" in Berliner Zeit. */
export function uhrzeitBerlin(datum: Date): string {
  const t = teileInBerlin(datum);
  return `${String(t.stunde).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

/** Wochentag in Berliner Zeit, 0 = Montag … 6 = Sonntag (Index für WOCHENTAG_LABEL). */
export function wochentagBerlin(datum: Date): number {
  return teileInBerlin(datum).wochentagIndex;
}
