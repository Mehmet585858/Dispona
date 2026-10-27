import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Absage – bestehende Fahrt stornieren",
  kategorie: "Absage",
  beschreibung: "Erika Schmitz sagt ihre bereits gebuchte Fahrt von heute Nachmittag ab.",
  anrufer: [
    "Hier ist Erika Schmitz, ich muss meine Fahrt heute leider absagen.",
    "Die um 15:30 Uhr, zum Uniklinikum.",
    "Es geht mir heute einfach nicht gut genug.",
    "Ja, bitte stornieren Sie die.",
  ],
  erwartetesErgebnis:
    "KI ruft zuerst fahrt_finden (oder fahrgast_suchen + fahrt_finden) auf, um die richtige rideId zu bestimmen, bestätigt die Fahrt (Uhrzeit/Ziel) mit dem Anrufer und ruft erst danach fahrt_stornieren auf – storniert nicht blind die falsche oder eine beliebige Fahrt.",
};

export default gespraech;
