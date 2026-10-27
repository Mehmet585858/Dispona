import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Angehöriger kennt die Krankenkasse des Vaters nicht genau",
  kategorie: "Angehörige ruft an",
  anrufernummer: "+491709990005",
  beschreibung: "Sohn ruft für seinen Vater an, weiß Krankenkasse und Genehmigungsstatus nicht sicher.",
  anrufer: [
    "Hallo, ich brauche eine Fahrt für meinen Vater, Hans Müller.",
    "Geburtsdatum weiß ich nicht genau, so um 1946 rum, das müsste in Ihrem System stehen.",
    "Es geht zur Dialyse Baesweiler, Donnerstag 7 Uhr.",
    "Welche Kasse er hat, weiß ich ehrlich gesagt nicht genau.",
    "Ob eine Genehmigung vorliegt, weiß ich auch nicht.",
    "Das ist schon in Ordnung so.",
  ],
  erwartetesErgebnis:
    "KI versucht zuerst fahrgast_suchen mit Nachname Müller, findet den bestehenden Fahrgast Hans Müller und übernimmt dessen hinterlegte Daten, statt mit unvollständigen neuen Angaben einen zweiten Datensatz anzulegen. approval/prescription UNKLAR, wenn der Anrufer es nicht weiß.",
};

export default gespraech;
