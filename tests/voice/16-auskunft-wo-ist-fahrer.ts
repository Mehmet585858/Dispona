import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Auskunft – wo bleibt der Fahrer?",
  kategorie: "Auskunft",
  beschreibung: "Erika Schmitz fragt nach, wo ihr Fahrer gerade ist, weil er noch nicht da ist.",
  anrufer: [
    "Hallo, hier ist Erika Schmitz, mein Fahrer sollte um 9 Uhr da sein und ist noch nicht da.",
    "Können Sie mal schauen, wo er ist?",
  ],
  erwartetesErgebnis:
    "KI findet die Fahrt über fahrt_finden und ruft abholzeit_auskunft auf, gibt dann eine ruhige, konkrete Antwort (geschätzte Ankunftszeit oder Status) statt nur zu vertrösten. Maßnahme M-13: Ohne Anrufernummer (bzw. von einer fremden Nummer) fragt die KI vorher nach Nachname und Geburtsdatum und ruft fahrgast_suchen damit auf; ohne Bestätigung nennt sie keine Daten zur Fahrt.",
};

export default gespraech;
