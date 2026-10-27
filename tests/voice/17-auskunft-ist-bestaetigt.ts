import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Auskunft – ist die Fahrt schon bestätigt?",
  kategorie: "Auskunft",
  anrufernummer: "+491709990002",
  beschreibung: "Anna Bergmann (aus Testgespräch 04) fragt tags darauf nach, ob ihre Fahrt schon fest eingeplant ist.",
  anrufer: [
    "Guten Tag, Anna Bergmann hier, ich wollte fragen, ob meine Fahrt für morgen schon bestätigt ist.",
  ],
  erwartetesErgebnis:
    "KI findet die Fahrt über fahrt_finden und beantwortet die Frage über abholzeit_auskunft mit einer ehrlichen Antwort (fest eingeplant mit Uhrzeit, oder noch nicht – je nach Status), nennt keine Uhrzeit, wenn die Fahrt noch nicht disponiert ist.",
};

export default gespraech;
