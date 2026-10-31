/** Oberflächentexte der Fahrerverwaltung (du-los, sachlich – docs/DESIGN-GUIDE.md Abschnitt 8). */
export const FAHRER_TEXTE = {
  einladungGesendet: "Fahrer angelegt. Der Anmelde-Link wurde per SMS an die Handynummer gesendet.",
  einladungOhneLink: (grund: string) =>
    `Fahrer angelegt, aber der Anmelde-Link konnte nicht gesendet werden: ${grund} Der Link lässt sich auf der Anmeldeseite erneut anfordern.`,
  einladungFehler: "Konnte nicht angelegt werden. Handynummer schon vergeben?",
  deaktivieren: "Deaktivieren",
  deaktivierenBestaetigen: "Wirklich deaktivieren? Geräte werden abgemeldet, offene Fahrten neu geplant.",
  deaktiviert: "Deaktiviert",
  deaktivierenFehler: "Konnte nicht deaktiviert werden.",
};
