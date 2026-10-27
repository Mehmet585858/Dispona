import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Praxis ruft für einen Patienten an (Rückfahrt von der Dialyse)",
  kategorie: "Praxis/Klinik ruft an",
  anrufernummer: "+492401555000",
  beschreibung: "Eine Arzthelferin bestellt im Namen des Dialysezentrums eine Rückfahrt für einen Patienten.",
  anrufer: [
    "Guten Tag, hier ist das Dialysezentrum Aachen, wir rufen für einen Patienten an.",
    "Es geht um Herrn Peter Fischer.",
    "Seine Behandlung ist heute um 16 Uhr fertig, bitte Abholung von hier zu seiner Wohnung.",
    "Er sitzt im Rollstuhl.",
    "Die Rückrufnummer ist unsere Praxisnummer, die, mit der ich gerade anrufe.",
    "Ja, das passt.",
  ],
  erwartetesErgebnis:
    "KI erfasst, dass der Anrufer (Praxis) nicht der Fahrgast ist: Fahrgast bleibt Peter Fischer, Rückrufnummer ist die Praxisnummer. Abholort ist das Dialysezentrum, Zielort die Wohnung des Fahrgasts.",
};

export default gespraech;
