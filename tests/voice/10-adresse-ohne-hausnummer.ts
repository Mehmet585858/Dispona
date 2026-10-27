import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Adresse unklar – keine Hausnummer genannt",
  kategorie: "Adresse unklar",
  anrufernummer: "+491709990006",
  beschreibung: "Anrufer nennt zunächst nur eine Straße ohne Hausnummer.",
  anrufer: [
    "Ich bin Klaus Hoffmann, brauche eine Fahrt übermorgen um 9 Uhr.",
    "Abholung ist in der Hauptstraße in Baesweiler.",
    "Ach, Hausnummer 45, Entschuldigung.",
    "Ziel ist die Praxis Dr. Meier.",
    "Sitzend, Transportschein liegt vor. Ja, richtig so.",
  ],
  erwartetesErgebnis:
    "KI fragt nach der fehlenden Hausnummer nach, bevor sie ort_suchen mit der vollständigen Adresse aufruft, statt mit einer unvollständigen Adresse weiterzumachen.",
};

export default gespraech;
