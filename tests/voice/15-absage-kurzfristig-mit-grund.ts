import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Absage – kurzfristig, mit Grund",
  kategorie: "Absage",
  beschreibung: "Ein Angehöriger sagt eine Fahrt kurzfristig wegen Krankenhausaufenthalt ab.",
  anrufer: [
    "Guten Tag, ich rufe für meinen Vater Hans Müller an, seine Fahrt heute muss entfallen.",
    "Er liegt gerade im Krankenhaus, das war ein Notfall heute Nacht.",
    "Die Fahrt war für heute Nachmittag zur Dialyse geplant.",
    "Ja, bitte streichen Sie die.",
  ],
  erwartetesErgebnis:
    "fahrt_stornieren wird mit der korrekten Fahrt aufgerufen; die KI gibt keine medizinischen Kommentare zum Krankenhausaufenthalt ab und bleibt sachlich bei der Terminabsage. Maßnahme M-13: Ohne Anrufernummer (bzw. von einer fremden Nummer) fragt die KI vorher nach Nachname und Geburtsdatum und ruft fahrgast_suchen damit auf; ohne Bestätigung nennt sie keine Daten zur Fahrt.",
};

export default gespraech;
