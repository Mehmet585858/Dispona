/** Neue Oberflächentexte der Fahrer-App (du-los, sachlich – docs/DESIGN-GUIDE.md Abschnitt 8). */
export const FAHRER_APP_TEXTE = {
  meinSchichtplan: "Mein Schichtplan",
  naechsteWochen: "Die nächsten 4 Wochen. Änderungen macht das Büro.",
  keineSchichten: "In den nächsten 4 Wochen sind keine Schichten eingetragen.",
  alsFahrer: "Fahrer",
  alsBeifahrer: "Beifahrer",
  mit: (name: string) => `mit ${name}`,
  allein: "allein",
  scalamobil: "Scalamobil an Bord",
  faelltAus: "Ausfall gemeldet",
  folgetag: "Folgetag",
  heuteBeifahrer: (plate: string, von: string, bis: string, fahrer: string | null) =>
    `Heute als Beifahrer auf ${plate} (${von}–${bis})${fahrer ? ` mit ${fahrer}` : ""}. Die Fahrten stehen beim Fahrer.`,
};
