/**
 * Texte der Schicht- und Besatzungslogik (du-los, sachlich – docs/DESIGN-GUIDE.md Abschnitt 8).
 * Sie erscheinen als Fehlermeldung im Schichtplan, als Ablehnungsgrund bei einer Zuweisung und als
 * Grund des Automodus. Nie Fahrgastdaten – nur Fahrzeug, Uhrzeit und Namen des Personals.
 */
export const BESATZUNG_TEXTE = {
  etikettLiegendOk: "Liegend möglich (2 Personen)",
  etikettLiegendFehlt: "Liegend: 2. Person fehlt",
  etikettTreppeZwei: "Treppe: mit 2 Personen",
  etikettTreppeScalamobil: "Treppe: mit Scalamobil",
  etikettScalamobilOhneEinweisung: "Scalamobil: Fahrer ohne Einweisung",
  etikettNurEbenerdig: "nur ebenerdig",

  liegendOhneBeifahrer: "Liegend-Fahrt braucht 2 Personen. In dieser Schicht ist kein Beifahrer eingetragen.",
  treppeScalamobilOhneEinweisung:
    "Tragestuhl-Fahrt mit Treppe: Das Scalamobil ist an Bord, aber der Fahrer hat keine Einweisung. Beifahrer eintragen oder einen eingewiesenen Fahrer einplanen.",
  treppeOhneTragestuhl:
    "Tragestuhl-Fahrt mit Treppe braucht zu zweit ein Fahrzeug mit Tragestuhl. Alternativ ein Scalamobil an Bord mit eingewiesenem Fahrer.",
  treppeOhneBesatzung:
    "Tragestuhl-Fahrt mit Treppe braucht 2 Personen oder ein Scalamobil mit eingewiesenem Fahrer. In dieser Schicht ist beides nicht eingetragen.",
} as const;

export const SCHICHTPLAN_TEXTE = {
  fahrerFehlt: "Bitte einen Fahrer auswählen.",
  zeitUngueltig: "Beginn und Ende als Uhrzeit angeben (HH:MM).",
  zeitGleich: "Beginn und Ende sind gleich.",
  fahrerGleichBeifahrer: "Fahrer und Beifahrer können nicht dieselbe Person sein.",
  personUnbekannt: "Fahrer nicht gefunden.",
  fahrzeugUnbekannt: "Fahrzeug nicht gefunden.",
  deaktiviert: (name: string) => `${name} ist deaktiviert und kann nicht eingeplant werden.`,
  ueberschneidungEntwurf: (a: number, b: number) => `Schicht ${a} und ${b} überschneiden sich zeitlich.`,
  fahrzeugBelegt: (plate: string, tag: string, von: string, bis: string) =>
    `${plate} ist am ${tag} schon von ${von} bis ${bis} eingeplant.`,
  personBelegt: (name: string, tag: string, plate: string, von: string, bis: string) =>
    `${name} fährt am ${tag} schon ${plate} (${von}–${bis}).`,
  scalamobilKeins: "Im Betrieb ist kein Scalamobil eingetragen. Die Anzahl steht in den Einstellungen.",
  scalamobilBelegt: (tag: string, anzahl: number, belegt: string) =>
    anzahl === 1
      ? `Das Scalamobil ist am ${tag} schon auf ${belegt}. Es gibt nur eines.`
      : `Am ${tag} sind schon alle ${anzahl} Scalamobile eingeplant (${belegt}).`,
  scalamobilFahrzeug: "Ein Scalamobil passt nur in ein Fahrzeug mit Tragestuhl oder Rollstuhlplatz.",
  mitSchichtNummer: (nummer: number, text: string) => `Schicht ${nummer}: ${text}`,

  scalamobilAnzahlUngueltig: "Anzahl der Scalamobile zwischen 0 und 20 angeben.",
  scalamobilZuWenig: (tag: string, anzahl: number) =>
    `Am ${tag} sind ${anzahl} Scalamobile gleichzeitig eingeplant. Erst den Schichtplan anpassen, dann die Anzahl senken.`,
  einweisungNochGebraucht: (zeiten: string) =>
    `Die Einweisung wird noch gebraucht: Fahrten mit Treppe sind schon über das Scalamobil eingeplant (${zeiten}). Erst diese Fahrten umplanen.`,

  vergangenerTag: "Tag liegt in der Vergangenheit.",
  laufendeSchicht: (von: string, bis: string) => `Laufende Schicht ${von}–${bis} bleibt unverändert.`,

  /** Vermerk an Fahrten, die nach einer Schichtänderung kein Fahrzeug mehr haben (Problem-Liste). */
  hinweisSchichtGeaendert: "Schicht geändert – neues Fahrzeug nötig",
  /** Vermerk, wenn ein deaktivierter Beifahrer aus einer Schicht genommen wurde. */
  hinweisBeifahrerDeaktiviert: "Beifahrer deaktiviert – neues Fahrzeug nötig",
} as const;
