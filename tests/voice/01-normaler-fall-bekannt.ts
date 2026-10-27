import type { Testgespraech } from "@/core/voice/testgespraech";

const gespraech: Testgespraech = {
  titel: "Normaler Fall – bekannter Fahrgast",
  kategorie: "normaler Fall",
  beschreibung: "Erika Schmitz bestellt selbst eine Fahrt zur Dialyse, ihre Nummer ist bereits bekannt.",
  anrufer: [
    "Guten Tag, hier ist Erika Schmitz, ich brauche morgen eine Fahrt.",
    "Zur Dialyse nach Aachen, Termin ist um 10 Uhr.",
    "Von zu Hause aus, das ist bei Ihnen hinterlegt.",
    "Rückfahrt brauche ich auch, so gegen 13 Uhr.",
    "Ich kann sitzen, kein Rollstuhl nötig.",
    "Transportschein liegt vor, ja.",
    "Nein, keine Begleitperson. Das ist alles richtig.",
  ],
  erwartetesErgebnis:
    "KI findet Erika Schmitz über fahrgast_suchen (Anrufernummer), fasst die Angaben zusammen, lässt bestätigen und ruft danach fahrt_anlegen für Hin- und Rückfahrt auf. Keine Probleme gemeldet.",
};

export default gespraech;
