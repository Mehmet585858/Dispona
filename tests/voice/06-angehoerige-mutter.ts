import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Angehörige ruft für ihre Mutter an",
  kategorie: "Angehörige ruft an",
  anrufernummer: "+491709990004",
  beschreibung: "Die Tochter bestellt eine Fahrt für ihre Mutter, nennt deren Daten und ihre eigene Rückrufnummer.",
  anrufer: [
    "Guten Tag, ich rufe für meine Mutter an, Gertrud Koch.",
    "Sie ist geboren am 20.05.1940.",
    "Meine Nummer ist diese hier, falls Sie zurückrufen müssen.",
    "Sie braucht eine Fahrt zur Praxis Dr. Berg, Mittwoch um 10:30 Uhr, von ihrer Wohnung.",
    "Sie kann sitzen, aber sie ist etwas wackelig auf den Beinen, bitte Hilfe bis zur Tür.",
    "TK ist ihre Kasse. Ja, so ist es richtig.",
  ],
  erwartetesErgebnis:
    "fahrt_anlegen wird mit den Daten der Mutter (Gertrud Koch) als Fahrgast angelegt, nicht mit den Daten der Anruferin. assistanceNotes enthält den Hinweis zur Hilfe bis zur Tür.",
};

export default gespraech;
