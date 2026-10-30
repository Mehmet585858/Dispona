/**
 * Beispiel-Gespräche für die öffentliche Live-Demo (/live), wenn gerade kein echter Anruf
 * läuft - rein clientseitig abgespielt (siehe SimulierterAnruf.tsx), schreibt nirgends in die
 * Datenbank und hat keinerlei Einfluss auf echte Anrufe. Die KI heißt in dieser Demo "Lisa" -
 * rein für die Simulation, nicht der Name, den der echte Sprachassistent nutzt (voicePrompt.ts).
 * Verschiedene erfundene Anrufer und Situationen (Neukunde, Rückfahrt, Sofortfahrt, Angehöriger
 * ruft an), damit die Demo nicht wirkt wie derselbe Anruf in Dauerschleife. Die Begrüßung läuft
 * vor dem ersten Gesprächs-Schnipsel bereits ab (wie bei einem echten Anruf) und wird hier nicht
 * wiederholt gezeigt - die Zeilen beginnen direkt mit dem eigentlichen Anliegen.
 *
 * offsetMinuten/dauerMinuten sind sowohl für die Platzierung im Zeitstrahl als auch für die im
 * Gespräch genannte Uhrzeit maßgeblich (immer relativ zu "jetzt" berechnet, siehe
 * SimulierterAnruf.tsx) - nie unabhängig voneinander, sonst sagt die KI z. B. "14 Uhr", während
 * tatsächlich 15 Uhr eingeplant wird. Ein Szenario, das eine konkrete Uhrzeit nennt (statt nur
 * einer relativen Dauer wie "in 15 Minuten"), schreibt dafür NIE eine feste Uhrzeit in den Text,
 * sondern den Platzhalter "{{ZEIT}}" - SimulierterAnruf.tsx ersetzt ihn durch "jetzt" +
 * offsetMinuten, einmal pro Gespräch berechnet, identisch zu der tatsächlich eingeplanten Zeit.
 * Wichtig: der letzte Satz von Lisa darf der Zeit nie widersprechen - eine Fahrt in mehreren
 * Stunden bekommt "ist eingeplant für {{ZEIT}} Uhr" statt einer Minuten-Ansage, die nur für eine
 * Fahrt in Kürze stimmt (siehe die kurzen Szenarien, die stattdessen bei relativen
 * Minuten-Angaben bleiben - die sind unabhängig von der absoluten Uhrzeit immer korrekt).
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
  offsetMinuten: number;
  dauerMinuten: number;
  /** Kennzeichen - muss zu einem der Demo-Fahrzeuge passen (seedDemoTenant.ts). */
  fahrzeug: string;
};

export const SIMULATIONS_SZENARIEN: SimulationsSzenario[] = [
  {
    anruferName: "Anrufer",
    linien: [
      { sprecher: "anrufer", text: "Guten Tag, ich brauche eine Fahrt zur Dialyse für meinen Vater, Herbert Thormann." },
      { sprecher: "ki", text: "Mache ich gerne. Wo soll die Abholung sein?" },
      { sprecher: "anrufer", text: "Lindenweg vier." },
      { sprecher: "ki", text: "Sitzend, oder braucht er den Rollstuhl?" },
      { sprecher: "anrufer", text: "Rollstuhl, bitte." },
      { sprecher: "ki", text: "Wann soll es losgehen?" },
      { sprecher: "anrufer", text: "Heute um {{ZEIT}} Uhr." },
      { sprecher: "ki", text: "Heute um {{ZEIT}} Uhr, Lindenweg vier zum Dialysezentrum Aachen, mit Rollstuhl, für Herbert Thormann. Passt das?" },
      { sprecher: "anrufer", text: "Ja, passt." },
      { sprecher: "ki", text: "Die Fahrt ist für {{ZEIT}} Uhr eingeplant. Gute Besserung, Herr Thormann." },
    ],
    fahrgast: "Herbert Thormann",
    transport: "Rollstuhl",
    abholung: "Lindenweg 4",
    ziel: "Dialysezentrum Aachen",
    offsetMinuten: 200,
    dauerMinuten: 35,
    fahrzeug: "AC-DEM 201",
  },
  {
    anruferName: "Ingrid Wagner",
    linien: [
      { sprecher: "anrufer", text: "Hallo, hier ist Ingrid Wagner. Ich möchte wieder abgeholt werden." },
      { sprecher: "ki", text: "Hallo Frau Wagner. Also Rückfahrt vom Klinikum Aachen-Mitte nach Hause in die Burgstraße, richtig?" },
      { sprecher: "anrufer", text: "Genau." },
      { sprecher: "ki", text: "Sitzend wie immer?" },
      { sprecher: "anrufer", text: "Ja." },
      { sprecher: "ki", text: "Wann sind Sie fertig?" },
      { sprecher: "anrufer", text: "In etwa einer halben Stunde." },
      { sprecher: "ki", text: "In dreißig Minuten vom Klinikum Aachen-Mitte zur Burgstraße, sitzend. Passt das?" },
      { sprecher: "anrufer", text: "Ja, passt." },
      { sprecher: "ki", text: "Ein Fahrer ist in etwa fünfundzwanzig Minuten am Haupteingang. Bis gleich, Frau Wagner." },
    ],
    fahrgast: "Ingrid Wagner",
    transport: "Sitzend",
    abholung: "Klinikum Aachen-Mitte",
    ziel: "Burgstraße 25",
    offsetMinuten: 28,
    dauerMinuten: 20,
    fahrzeug: "AC-DEM 101",
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
    offsetMinuten: 15,
    dauerMinuten: 20,
    fahrzeug: "AC-DEM 102",
  },
  {
    anruferName: "Anrufer",
    linien: [
      { sprecher: "anrufer", text: "Ich rufe für meinen Vater an, er braucht einen Liegendtransport nach seiner Operation." },
      { sprecher: "ki", text: "Das bekommen wir hin. Wie heißt Ihr Vater?" },
      { sprecher: "anrufer", text: "Said Yilmaz." },
      { sprecher: "ki", text: "Vom Klinikum Aachen-Mitte, nehme ich an?" },
      { sprecher: "anrufer", text: "Ja, genau." },
      { sprecher: "ki", text: "Und wohin soll es gehen?" },
      { sprecher: "anrufer", text: "Ins Pflegeheim Sonnenhof." },
      { sprecher: "ki", text: "Wann ist er abholbereit?" },
      { sprecher: "anrufer", text: "Heute gegen {{ZEIT}} Uhr." },
      { sprecher: "ki", text: "Heute um {{ZEIT}} Uhr, Liegendtransport vom Klinikum Aachen-Mitte zum Pflegeheim Sonnenhof, für Said Yilmaz. Passt das?" },
      { sprecher: "anrufer", text: "Ja, passt." },
      { sprecher: "ki", text: "Die Fahrt ist für {{ZEIT}} Uhr eingeplant. Gute Besserung für Ihren Vater." },
    ],
    fahrgast: "Said Yilmaz",
    transport: "Liegend",
    abholung: "Klinikum Aachen-Mitte",
    ziel: "Pflegeheim Sonnenhof",
    offsetMinuten: 330,
    dauerMinuten: 40,
    fahrzeug: "AC-DEM 401",
  },
];
