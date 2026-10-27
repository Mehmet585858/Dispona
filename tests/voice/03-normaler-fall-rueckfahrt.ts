import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Normaler Fall – klare Hin- und Rückfahrt",
  kategorie: "normaler Fall",
  beschreibung: "Erika Schmitz braucht Hin- und Rückfahrt mit genauer Uhrzeit für beides.",
  anrufer: [
    "Hier ist Erika Schmitz. Ich brauche Freitag eine Fahrt zum Uniklinikum.",
    "Termin ist um 14 Uhr, Abholung bitte eine Stunde vorher.",
    "Rückfahrt steht auch schon fest, um 16:30 Uhr.",
    "Sitzend reicht, Transportschein liegt vor. Ja, passt.",
  ],
  erwartetesErgebnis:
    "fahrt_anlegen wird einmal mit rueckfahrt=true und rueckfahrtzeit 16:30 aufgerufen, nicht als zwei getrennte Anrufe. Beide Fahrten (Hin/Rück) werden angelegt.",
};

export default gespraech;
