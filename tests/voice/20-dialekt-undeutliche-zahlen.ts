import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Dialekt und undeutliche Zahlenangaben",
  kategorie: "Dialekt/undeutliche Zahlen",
  anrufernummer: "+491709990012",
  beschreibung:
    "Umgangssprachliche Zeit- und Zahlenangaben, wie sie in echten Anrufen vorkommen (als Text-Variante simuliert, da kein echtes Audio).",
  anrufer: [
    "Jo, hier Nina Krämer, ich bräuchte morsche früh ne Fahrt.",
    "So um viertel vor acht rum, zur Praxis Dr. Keller.",
    "Von der Hauptstraße, die Hausnummer is zwoundzwanzig.",
    "Kann normal sitzen, Schein liegt vor. Jo, passt so.",
  ],
  erwartetesErgebnis:
    "KI übersetzt \"viertel vor acht\" korrekt zu 07:45 und \"zwoundzwanzig\" zu Hausnummer 22, fragt bei echter Unsicherheit lieber einmal nach, statt eine falsche Uhrzeit oder Hausnummer an fahrt_anlegen zu übergeben.",
};

export default gespraech;
