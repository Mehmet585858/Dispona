/**
 * Beispiel-Gespräche für die öffentliche Live-Demo (/live), wenn gerade kein echter Anruf
 * läuft - rein clientseitig abgespielt (siehe SimulierterAnruf.tsx), schreibt nirgends in die
 * Datenbank und hat keinerlei Einfluss auf echte Anrufe. Verschiedene erfundene Anrufer, damit
 * die Demo nicht wirkt wie derselbe Anruf in Dauerschleife.
 */
export type SimulationsZeile = { sprecher: "ki" | "anrufer"; text: string };

export type SimulationsSzenario = {
  anruferName: string;
  linien: SimulationsZeile[];
  fahrgast: string;
  transport: string;
  abholung: string;
  ziel: string;
  uhrzeit: string;
  fahrzeug: string;
};

export const SIMULATIONS_SZENARIEN: SimulationsSzenario[] = [
  {
    anruferName: "Petra Keller",
    linien: [
      { sprecher: "ki", text: "Willkommen bei Mediway Krankenfahrdienst, hier spricht Dispona. Wie kann ich helfen?" },
      { sprecher: "anrufer", text: "Hallo, ich brauche für meine Mutter eine Fahrt zur Dialyse, immer dienstags und donnerstags." },
      { sprecher: "ki", text: "Gerne. Wie heißt Ihre Mutter, und von welcher Adresse soll sie abgeholt werden?" },
      { sprecher: "anrufer", text: "Petra Keller, Musterstraße 12. Zum Dialysezentrum, immer um 13 Uhr, sie sitzt im Rollstuhl." },
      { sprecher: "ki", text: "Verstanden, Rollstuhltransport dienstags und donnerstags, Abholung 12:15 Uhr für den 13-Uhr-Termin. Ich plane das jetzt ein." },
    ],
    fahrgast: "Petra Keller",
    transport: "Rollstuhl",
    abholung: "Musterstraße 12",
    ziel: "Dialysezentrum Musterstadt",
    uhrzeit: "heute 13:00",
    fahrzeug: "DEMO-200",
  },
  {
    anruferName: "Thomas Berg",
    linien: [
      { sprecher: "ki", text: "Willkommen bei Mediway Krankenfahrdienst, hier spricht Dispona. Wie kann ich helfen?" },
      { sprecher: "anrufer", text: "Guten Tag, ich werde morgen aus dem Klinikum entlassen und brauche eine Fahrt nach Hause." },
      { sprecher: "ki", text: "Das richten wir ein. Wie ist Ihr Name, und zu welcher Uhrzeit ist die Entlassung geplant?" },
      { sprecher: "anrufer", text: "Thomas Berg, die Station sagt, gegen 11 Uhr bin ich fertig. Ich kann noch laufen, brauche aber Hilfe beim Einsteigen." },
      { sprecher: "ki", text: "Alles klar, Thomas Berg, Abholung morgen 11:00 Uhr am Klinikum, sitzend mit Unterstützung. Ich plane die Fahrt jetzt ein." },
    ],
    fahrgast: "Thomas Berg",
    transport: "Sitzend",
    abholung: "Klinikum Musterstadt",
    ziel: "Musterstraße 12",
    uhrzeit: "morgen 11:00",
    fahrzeug: "DEMO-100",
  },
  {
    anruferName: "Ingrid Wagner",
    linien: [
      { sprecher: "ki", text: "Willkommen bei Mediway Krankenfahrdienst, hier spricht Dispona. Wie kann ich helfen?" },
      { sprecher: "anrufer", text: "Ich rufe für meinen Vater an, der braucht einen Liegendtransport nach seiner OP, heute Nachmittag." },
      { sprecher: "ki", text: "Das tut mir leid zu hören, das bekommen wir hin. Wie heißt Ihr Vater, und wohin soll die Fahrt gehen?" },
      { sprecher: "anrufer", text: "Herr Wagner, vom Klinikum zurück ins Pflegeheim Sonnenhof. So gegen 16 Uhr wäre er abholbereit." },
      { sprecher: "ki", text: "Verstanden, Liegendtransport für Herrn Wagner, Abholung 16:00 Uhr am Klinikum zum Pflegeheim Sonnenhof. Ich plane das jetzt ein." },
    ],
    fahrgast: "Herr Wagner",
    transport: "Liegend",
    abholung: "Klinikum Musterstadt",
    ziel: "Pflegeheim Sonnenhof",
    uhrzeit: "heute 16:00",
    fahrzeug: "DEMO-400",
  },
  {
    anruferName: "Klaus Meyer",
    linien: [
      { sprecher: "ki", text: "Willkommen bei Mediway Krankenfahrdienst, hier spricht Dispona. Wie kann ich helfen?" },
      { sprecher: "anrufer", text: "Hallo, ich brauche eine Fahrt zur Physiotherapie, mit Tragestuhl bitte, die Treppe zu Hause schaffe ich nicht allein." },
      { sprecher: "ki", text: "Kein Problem. Wie ist Ihr Name, und für wann soll die Fahrt sein?" },
      { sprecher: "anrufer", text: "Klaus Meyer, Termin ist morgen um 9 Uhr in der Praxis am Markt." },
      { sprecher: "ki", text: "Alles klar, Klaus Meyer, Tragestuhl, Abholung morgen 8:30 Uhr für den 9-Uhr-Termin in der Praxis am Markt. Ich plane das jetzt ein." },
    ],
    fahrgast: "Klaus Meyer",
    transport: "Tragestuhl",
    abholung: "Lindenweg 4",
    ziel: "Praxis am Markt",
    uhrzeit: "morgen 09:00",
    fahrzeug: "DEMO-300",
  },
];
