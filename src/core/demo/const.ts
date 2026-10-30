/** Fester Mandant für die öffentliche Live-Demo auf der Marketing-Seite (dispona.de#demo ->
 * app.dispona.de/live). Bewusst eine feste ID statt einer Datenbank-Suche: diese Konstante ist
 * die einzige Stelle, die jemals Daten über eine Mandantengrenze hinweg ohne Login zugänglich
 * macht (src/app/live/actions.ts) – sie darf nie durch Nutzereingabe ersetzbar sein. */
export const DEMO_TENANT_ID = "demo-tenant";

/** Fester, erfundener Fahrgast-Stamm für simulierte Anrufe (src/core/demo/betriebSimulieren.ts),
 * einmal angelegt von seedDemoTenant.ts. demoZuruecksetzen.ts löscht einen Fahrgast, sobald er
 * keine Fahrt mehr hat (Privatsphäre für echte Anrufer!) - diese Namen gehören aber niemandem
 * Echten, deshalb hier als gemeinsame Liste, damit betriebSimulieren.ts einen fehlenden Eintrag
 * bei Bedarf selbst nachlegen kann, statt von einem erneuten seedDemoTenant()-Lauf abzuhängen. */
export const DEMO_PASSAGIER_ROSTER = [
  { firstName: "Herbert", lastName: "Thormann" },
  { firstName: "Ingrid", lastName: "Wagner" },
  { firstName: "Klaus", lastName: "Meyer" },
  { firstName: "Said", lastName: "Yilmaz" },
  { firstName: "Renate", lastName: "Hoffmann" },
  { firstName: "Jürgen", lastName: "Albrecht" },
  { firstName: "Margarete", lastName: "Schulz" },
  { firstName: "Dieter", lastName: "Krüger" },
  { firstName: "Ayşe", lastName: "Demir" },
  { firstName: "Helga", lastName: "Neumann" },
  { firstName: "Werner", lastName: "Schmidt" },
  { firstName: "Brigitte", lastName: "Lang" },
  { firstName: "Mehmet", lastName: "Koç" },
  { firstName: "Ursula", lastName: "Fischer" },
  { firstName: "Rolf", lastName: "Zimmermann" },
  { firstName: "Gisela", lastName: "Braun" },
] as const;
