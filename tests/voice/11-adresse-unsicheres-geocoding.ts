import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Adresse unklar – Geocoding unsicher, muss bestätigt werden",
  kategorie: "Adresse unklar",
  anrufernummer: "+491709990007",
  beschreibung: "Eine unbekannte, ungewöhnlich formulierte Adresse liefert ein unsicheres ort_suchen-Ergebnis.",
  anrufer: [
    "Hier ist Ingrid Schulz, ich brauche morgen eine Fahrt um 14 Uhr.",
    "Abholung bei mir zu Hause, das kennen Sie.",
    "Ziel ist... na dieses neue Ärztehaus am Europaplatz, ich weiß die genaue Adresse nicht.",
    "Ja, das klingt richtig, die Klinik am Europaplatz.",
    "Sitzend, Transportschein liegt vor. Ja, passt.",
  ],
  erwartetesErgebnis:
    "ort_suchen liefert ein unsicheres Ergebnis (sicher: false oder eine Formulierung, die danach klingt) – die KI liest die gefundene Adresse vor und lässt sie ausdrücklich bestätigen, bevor sie fahrt_anlegen aufruft.",
};

export default gespraech;
