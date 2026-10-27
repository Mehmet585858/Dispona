/**
 * Form eines Testgesprächs (docs/09-bauplan.md Phase 6, "20 Testgespräche"). Jede Datei unter
 * tests/voice/ exportiert eines davon. Zum Durchspielen die Anrufer-Zeilen der Reihe nach bei
 * "npm run voice:sim" eintippen und mit dem erwarteten Ergebnis vergleichen – ein Sprachmodell
 * lässt sich nicht deterministisch automatisiert prüfen, deshalb keine Assertions, sondern eine
 * Checkliste für den manuellen Testlauf.
 */
export type Testgespraech = {
  titel: string;
  kategorie:
    | "normaler Fall"
    | "Angehörige ruft an"
    | "Praxis/Klinik ruft an"
    | "Adresse unklar"
    | "Notfall"
    | "Absage"
    | "Auskunft"
    | "Anrufer will Menschen"
    | "Dialekt/undeutliche Zahlen";
  beschreibung: string;
  anrufernummer?: string;
  anrufer: string[];
  erwartetesErgebnis: string;
};
