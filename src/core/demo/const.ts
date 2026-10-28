/** Fester Mandant für die öffentliche Live-Demo auf der Marketing-Seite (dispona.de#demo ->
 * app.dispona.de/live). Bewusst eine feste ID statt einer Datenbank-Suche: diese Konstante ist
 * die einzige Stelle, die jemals Daten über eine Mandantengrenze hinweg ohne Login zugänglich
 * macht (src/app/live/actions.ts) – sie darf nie durch Nutzereingabe ersetzbar sein. */
export const DEMO_TENANT_ID = "demo-tenant";
