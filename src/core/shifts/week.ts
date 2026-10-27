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

/** Wandelt ein "JJJJ-MM-TT"-Datum in Mitternacht (Berliner Zeit) dieses Tages um. */
export function berlinerMitternacht(isoDatum: string): Date {
  const [jahr, monat, tag] = isoDatum.split("-").map(Number);
  return ausBerlinerZeit(jahr, monat, tag, 0, 0);
}

/** Verschiebt ein "JJJJ-MM-TT"-Datum um ganze Tage (kalendersicher, auch über DST-Wechsel hinweg). */
export function tagVerschieben(isoDatum: string, tageVersatz: number): string {
  const [jahr, monat, tag] = isoDatum.split("-").map(Number);
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

/** Setzt eine Uhrzeit (HH:MM, Berliner Zeit) auf den Kalendertag von `datum`. */
export function mitUhrzeit(datum: Date, uhrzeitHhMm: string): Date {
  const t = teileInBerlin(datum);
  const [stunde, minute] = uhrzeitHhMm.split(":").map(Number);
  return ausBerlinerZeit(t.jahr, t.monat, t.tag, stunde || 0, minute || 0);
}
