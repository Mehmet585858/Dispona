/**
 * Gesetzliche Feiertage in Nordrhein-Westfalen (docs/09-bauplan.md Phase 8: "Feiertage NRW als
 * Hinweis" bei Serienfahrten). Reine Funktionen, Datumsangaben als JJJJ-MM-TT-Strings, reines
 * Kalenderdatum ohne Zeitzonenbezug (wie src/core/shifts/rrule.ts).
 */

/** Ostersonntag (gregorianisch) nach dem Verfahren von Meeus/Jones/Butcher. */
export function osterSonntag(jahr: number): { monat: number; tag: number } {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const summe = h + l - 7 * m + 114;
  return { monat: Math.floor(summe / 31), tag: (summe % 31) + 1 };
}

function isoDatum(jahr: number, monat: number, tag: number): string {
  return `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}

function plusTage(jahr: number, monat: number, tag: number, versatz: number): string {
  const datum = new Date(Date.UTC(jahr, monat - 1, tag));
  datum.setUTCDate(datum.getUTCDate() + versatz);
  return isoDatum(datum.getUTCFullYear(), datum.getUTCMonth() + 1, datum.getUTCDate());
}

/** Alle gesetzlichen Feiertage in NRW eines Jahres, als `{ datum: "JJJJ-MM-TT", name }`. */
export function feiertageNrw(jahr: number): { datum: string; name: string }[] {
  const ostern = osterSonntag(jahr);
  return [
    { datum: isoDatum(jahr, 1, 1), name: "Neujahr" },
    { datum: plusTage(jahr, ostern.monat, ostern.tag, -2), name: "Karfreitag" },
    { datum: plusTage(jahr, ostern.monat, ostern.tag, 1), name: "Ostermontag" },
    { datum: isoDatum(jahr, 5, 1), name: "Tag der Arbeit" },
    { datum: plusTage(jahr, ostern.monat, ostern.tag, 39), name: "Christi Himmelfahrt" },
    { datum: plusTage(jahr, ostern.monat, ostern.tag, 50), name: "Pfingstmontag" },
    { datum: plusTage(jahr, ostern.monat, ostern.tag, 60), name: "Fronleichnam" },
    { datum: isoDatum(jahr, 10, 3), name: "Tag der Deutschen Einheit" },
    { datum: isoDatum(jahr, 11, 1), name: "Allerheiligen" },
    { datum: isoDatum(jahr, 12, 25), name: "1. Weihnachtstag" },
    { datum: isoDatum(jahr, 12, 26), name: "2. Weihnachtstag" },
  ];
}

/** Name des Feiertags an `isoDatum` (NRW) oder `null`, wenn es keiner ist. */
export function istFeiertagNrw(isoDatum: string): string | null {
  const jahr = Number(isoDatum.slice(0, 4));
  const treffer = feiertageNrw(jahr).find((f) => f.datum === isoDatum);
  return treffer?.name ?? null;
}
