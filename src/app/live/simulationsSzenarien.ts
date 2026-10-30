/**
 * Beispiel-Gespräche für die öffentliche Live-Demo (/live), wenn gerade kein echter Anruf
 * läuft - rein clientseitig abgespielt (siehe SimulierterAnruf.tsx), schreibt nirgends in die
 * Datenbank und hat keinerlei Einfluss auf echte Anrufe. Die KI heißt in dieser Demo "Lisa" -
 * rein für die Simulation, nicht der Name, den der echte Sprachassistent nutzt (voicePrompt.ts).
 * Verschiedene erfundene Anrufer und Situationen (Neukunde, Rückfahrt, Sofortfahrt, Angehöriger
 * ruft an), damit die Demo nicht wirkt wie derselbe Anruf in Dauerschleife. Die Begrüßung läuft
 * vor dem ersten Gesprächs-Schnipsel bereits ab (wie bei einem echten Anruf) und wird hier nicht
 * wiederholt gezeigt - die Zeilen beginnen direkt mit dem eigentlichen Anliegen.
 */
export type SimulationsZeile = { sprecher: "ki" | "anrufer"; text: string };

export type SimulationsSzenario = {
  /** Name, der vor den Anrufer-Zeilen im Transkript steht - "Anrufer", wenn der Name im
   * Gespräch nie genannt wird (z. B. ruft jemand für einen Angehörigen an). */
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
    anruferName: "Anrufer",
    linien: [
      { sprecher: "anrufer", text: "Guten Tag, ich brauche eine Fahrt zur Dialyse für meinen Vater, Herbert Thormann." },
      { sprecher: "ki", text: "Mache ich gerne. Wo soll die Abholung sein?" },
      { sprecher: "anrufer", text: "Lindenweg vier in Musterstadt." },
      { sprecher: "ki", text: "Sitzend, oder braucht er den Rollstuhl?" },
      { sprecher: "anrufer", text: "Rollstuhl, bitte." },
      { sprecher: "ki", text: "Wann soll es losgehen?" },
      { sprecher: "anrufer", text: "Heute um vierzehn Uhr." },
      { sprecher: "ki", text: "Heute um vierzehn Uhr, Lindenweg vier zum Dialysezentrum Musterstadt, mit Rollstuhl, für Herbert Thormann. Passt das?" },
      { sprecher: "anrufer", text: "Ja, passt." },
      { sprecher: "ki", text: "Ein Fahrer ist in etwa zwanzig Minuten da. Gute Besserung, Herr Thormann." },
    ],
    fahrgast: "Herbert Thormann",
    transport: "Rollstuhl",
    abholung: "Lindenweg 4",
    ziel: "Dialysezentrum Musterstadt",
    uhrzeit: "heute 14:00",
    fahrzeug: "DEMO-200",
  },
  {
    anruferName: "Ingrid Wagner",
    linien: [
      { sprecher: "anrufer", text: "Hallo, hier ist Ingrid Wagner. Ich möchte wieder abgeholt werden." },
      { sprecher: "ki", text: "Hallo Frau Wagner. Also Rückfahrt vom Klinikum Musterstadt nach Hause in die Burgstraße, richtig?" },
      { sprecher: "anrufer", text: "Genau." },
      { sprecher: "ki", text: "Sitzend wie immer?" },
      { sprecher: "anrufer", text: "Ja." },
      { sprecher: "ki", text: "Wann sind Sie fertig?" },
      { sprecher: "anrufer", text: "In etwa einer halben Stunde." },
      { sprecher: "ki", text: "In dreißig Minuten vom Klinikum Musterstadt zur Burgstraße, sitzend. Passt das?" },
      { sprecher: "anrufer", text: "Ja, passt." },
      { sprecher: "ki", text: "Ein Fahrer ist in etwa fünfundzwanzig Minuten am Haupteingang. Bis gleich, Frau Wagner." },
    ],
    fahrgast: "Ingrid Wagner",
    transport: "Sitzend",
    abholung: "Klinikum Musterstadt",
    ziel: "Burgstraße 25",
    uhrzeit: "in 30 Minuten",
    fahrzeug: "DEMO-100",
  },
  {
    anruferName: "Klaus Meyer",
    linien: [
      { sprecher: "anrufer", text: "Guten Tag, ich bin fertig in der Praxis am Markt und brauche eine Fahrt nach Hause." },
      { sprecher: "ki", text: "Kein Problem. Wie ist Ihr Name?" },
      { sprecher: "anrufer", text: "Klaus Meyer." },
      { sprecher: "ki", text: "Und wohin soll es gehen, Herr Meyer?" },
      { sprecher: "anrufer", text: "Lindenweg vier." },
      { sprecher: "ki", text: "Können Sie laufen, oder brauchen Sie Hilfe beim Einsteigen?" },
      { sprecher: "anrufer", text: "Ich schaffe das allein." },
      { sprecher: "ki", text: "Sofort von der Praxis am Markt zum Lindenweg vier, sitzend. Passt das?" },
      { sprecher: "anrufer", text: "Ja, passt." },
      { sprecher: "ki", text: "Ein Fahrer ist in etwa fünfzehn Minuten da. Gute Besserung, Herr Meyer." },
    ],
    fahrgast: "Klaus Meyer",
    transport: "Sitzend",
    abholung: "Praxis am Markt",
    ziel: "Lindenweg 4",
    uhrzeit: "sofort",
    fahrzeug: "DEMO-100",
  },
  {
    anruferName: "Anrufer",
    linien: [
      { sprecher: "anrufer", text: "Ich rufe für meinen Vater an, er braucht einen Liegendtransport nach seiner Operation." },
      { sprecher: "ki", text: "Das bekommen wir hin. Wie heißt Ihr Vater?" },
      { sprecher: "anrufer", text: "Said Yilmaz." },
      { sprecher: "ki", text: "Vom Klinikum Musterstadt, nehme ich an?" },
      { sprecher: "anrufer", text: "Ja, genau." },
      { sprecher: "ki", text: "Und wohin soll es gehen?" },
      { sprecher: "anrufer", text: "Ins Pflegeheim Sonnenhof." },
      { sprecher: "ki", text: "Wann ist er abholbereit?" },
      { sprecher: "anrufer", text: "Heute gegen sechzehn Uhr." },
      { sprecher: "ki", text: "Heute um sechzehn Uhr, Liegendtransport vom Klinikum Musterstadt zum Pflegeheim Sonnenhof, für Said Yilmaz. Passt das?" },
      { sprecher: "anrufer", text: "Ja, passt." },
      { sprecher: "ki", text: "Ein Fahrer ist in etwa fünfunddreißig Minuten da. Gute Besserung für Ihren Vater." },
    ],
    fahrgast: "Said Yilmaz",
    transport: "Liegend",
    abholung: "Klinikum Musterstadt",
    ziel: "Pflegeheim Sonnenhof",
    uhrzeit: "heute 16:00",
    fahrzeug: "DEMO-400",
  },
];
