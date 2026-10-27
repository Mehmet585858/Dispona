import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Normaler Fall – Rollstuhlfahrt",
  kategorie: "normaler Fall",
  anrufernummer: "+491709990002",
  beschreibung: "Neuer Fahrgast sitzt dauerhaft im Rollstuhl, braucht ein passendes Fahrzeug.",
  anrufer: [
    "Guten Tag, ich rufe für mich selbst an, Anna Bergmann, geboren 12.07.1960.",
    "Ich bin im Rollstuhl, das bitte einplanen.",
    "Die Fahrt soll morgen um 11 Uhr zur Dialyse nach Aachen gehen, von meiner Wohnung aus.",
    "Barmer ist meine Kasse, Transportschein liegt vor.",
    "Keine Begleitperson nötig. Ja, so ist es richtig.",
  ],
  erwartetesErgebnis: "fahrt_anlegen wird mit transportType ROLLSTUHL aufgerufen, nicht SITZEND.",
};

export default gespraech;
