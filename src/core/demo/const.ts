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
  { firstName: "Hans-Peter", lastName: "Ludwig" },
  { firstName: "Monika", lastName: "Vollmer" },
  { firstName: "Fatma", lastName: "Aydın" },
  { firstName: "Günther", lastName: "Horn" },
  { firstName: "Elfriede", lastName: "Richter" },
  { firstName: "Karl-Heinz", lastName: "Wolff" },
  { firstName: "Christa", lastName: "Albers" },
  { firstName: "Manfred", lastName: "Dietrich" },
  { firstName: "Irmgard", lastName: "Lorenz" },
  { firstName: "Hüseyin", lastName: "Şahin" },
  { firstName: "Erna", lastName: "Mertens" },
  { firstName: "Siegfried", lastName: "Brückner" },
  { firstName: "Hildegard", lastName: "Siebert" },
  { firstName: "Reinhold", lastName: "Kunz" },
  { firstName: "Waltraud", lastName: "Ahrens" },
  { firstName: "Emine", lastName: "Arslan" },
  { firstName: "Horst", lastName: "Peters" },
  { firstName: "Annelie", lastName: "Hartmann" },
  { firstName: "Wolfgang", lastName: "Jung" },
  { firstName: "Ruth", lastName: "Baumann" },
  { firstName: "Günter", lastName: "Krause" },
  { firstName: "Edith", lastName: "Sommer" },
  { firstName: "Alfred", lastName: "Pohl" },
  { firstName: "Liesel", lastName: "Graf" },
  { firstName: "Mustafa", lastName: "Kaya" },
  { firstName: "Gertrud", lastName: "Engel" },
  { firstName: "Heinrich", lastName: "Busch" },
  { firstName: "Ilse", lastName: "Seidel" },
  { firstName: "Erwin", lastName: "Kraus" },
  { firstName: "Hannelore", lastName: "Beck" },
  { firstName: "Zeynep", lastName: "Çelik" },
  { firstName: "Otto", lastName: "Hahn" },
  { firstName: "Traudel", lastName: "Martin" },
] as const;
