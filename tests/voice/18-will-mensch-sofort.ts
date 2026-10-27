import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Anrufer will sofort einen Menschen sprechen",
  kategorie: "Anrufer will Menschen",
  anrufernummer: "+491709990010",
  beschreibung: "Der Anrufer lehnt die KI direkt zu Beginn ab.",
  anrufer: ["Nein, ich will nicht mit einem Computer sprechen, geben Sie mir einen echten Menschen."],
  erwartetesErgebnis:
    "KI ruft sofort an_mensch_weiterleiten auf, ohne vorher nach Buchungsdetails zu fragen oder den Wunsch zu hinterfragen.",
};

export default gespraech;
