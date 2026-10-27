import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Normaler Fall – neuer Fahrgast",
  kategorie: "normaler Fall",
  anrufernummer: "+491709990001",
  beschreibung: "Ein bisher unbekannter Anrufer bestellt eine Fahrt für sich selbst.",
  anrufer: [
    "Hallo, ich brauche eine Krankenfahrt, Sie kennen mich noch nicht.",
    "Mein Name ist Werner Krause, geboren am 3. März 1950.",
    "Ich möchte zur Praxis Dr. Meier, übermorgen um 9 Uhr.",
    "Abgeholt werden soll ich von zu Hause, Hauptstraße 12 in Baesweiler.",
    "Ich bin bei der AOK versichert.",
    "Ich kann normal sitzen.",
    "Transportschein habe ich noch nicht, weiß ich noch nicht genau.",
    "Keine Genehmigung nötig, ist eine einmalige Fahrt. Ja, das passt so.",
  ],
  erwartetesErgebnis:
    "fahrgast_suchen findet niemanden, KI erfasst Name/Geburtsdatum/Krankenkasse per Sprache, ruft ort_suchen für die Adresse auf, fasst zusammen und legt mit fahrt_anlegen einen neuen Fahrgast plus Fahrt an (prescription UNKLAR).",
};

export default gespraech;
