// Zeitfenster-Prüfungen in Berliner Zeit, für Eskalation (docs/02-architektur.md) und
// Automodus (docs/05-disposition.md: "nur nachts und am Wochenende").
const WOCHENTAG_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Nachts = vor 6 oder ab 22 Uhr (Berliner Zeit). Nutzt formatToParts() statt toLocaleString():
 * Letzteres hängt je nach Locale/ICU-Daten ein "Uhr" an ("03 Uhr"), was Number(...) zu NaN macht.
 */
export function istNachtsInBerlin(datum: Date): boolean {
  const teile = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(datum);
  const stunde = Number(teile.find((t) => t.type === "hour")?.value) % 24;
  return stunde < 6 || stunde >= 22;
}

/** Samstag oder Sonntag (Berliner Zeit). */
export function istWochenendeInBerlin(datum: Date): boolean {
  const wochentag = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", weekday: "short" }).format(datum);
  const index = WOCHENTAG_EN.indexOf(wochentag);
  return index === 5 || index === 6;
}
