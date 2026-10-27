import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Normaler Fall – Tragestuhl mit Begleitperson",
  kategorie: "normaler Fall",
  anrufernummer: "+491709990003",
  beschreibung: "Neuer Fahrgast braucht einen Tragestuhl und eine Begleitperson fährt mit.",
  anrufer: [
    "Hallo, mein Vater Josef Weber braucht eine Fahrt, geboren 1938.",
    "Er kann nicht mehr laufen, wir brauchen einen Tragestuhl.",
    "Ich fahre als Begleitung mit.",
    "Es geht zum Pflegeheim Am Wald, am Montag um 8 Uhr, von der Praxis Dr. Keller aus.",
    "DAK ist die Kasse, Transportschein liegt vor, Genehmigung ist nicht nötig.",
    "Ja, das stimmt so.",
  ],
  erwartetesErgebnis:
    "fahrt_anlegen mit transportType TRAGESTUHL und companion true. Anrufer (Angehöriger) bleibt als Rückrufnummer, Fahrgast ist der Vater.",
};

export default gespraech;
