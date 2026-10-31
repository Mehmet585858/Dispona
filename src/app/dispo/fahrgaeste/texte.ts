/** Oberflächentexte der Fahrgast-Verwaltung (du-los, sachlich – docs/DESIGN-GUIDE.md Abschnitt 8). */
export const FAHRGAST_TEXTE = {
  /** Maßnahme M-22: Serien beim Fahrgast. */
  serienTitel: "Serienfahrten",
  keineSerie: "Keine laufende Serie.",
  serieZeile: (wochentage: string, abholzeit: string, bis: string) => `${wochentage} · ${abholzeit} Uhr · bis ${bis}`,
  pause: (von: string, bis: string) => `Pause ${von} bis ${bis}`,
  beendenAb: "Beenden ab",
  beenden: "Serie beenden",
  beendenBestaetigen: "Wirklich beenden? Geplante Fahrten ab diesem Tag werden storniert.",
  pauseVon: "Pause von",
  pauseBis: "Pause bis",
  pausieren: "Pause eintragen",
  neueAbholzeit: "Neue Abholzeit",
  neuesEnde: "Neues Enddatum",
  aendern: "Änderung übernehmen",
  erledigt: (storniert: number) => `Gespeichert. ${storniert} geplante Fahrten storniert, Fahrer benachrichtigt.`,
  geaendert: (geaendert: number, storniert: number, neu: number) =>
    `Gespeichert. ${geaendert} Fahrten angepasst, ${storniert} storniert, ${neu} neu angelegt.`,
  fehler: (grund: string) => `Nicht gespeichert: ${grund}`,
};
