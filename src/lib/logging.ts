/**
 * Einzige Stelle, an der die App console.log benutzen darf (Maßnahme M-09, Prüfbericht S2-009).
 * Die ESLint-Regel no-console (eslint.config.mjs) meldet console.log/info/debug überall sonst
 * unter src/. Regeln für Log-Inhalte (CLAUDE.md): nur IDs, nie Fahrgastname, Rufnummer, Adresse
 * oder Nachrichtentext. console.warn/console.error bleiben für echte Betriebsfehler erlaubt –
 * auch dort nur IDs.
 */

/** Schreibt nur in der lokalen Entwicklung (NODE_ENV=development) – nie im Test, nie in Produktion. */
export function entwicklungsLog(meldung: string): void {
  if (process.env.NODE_ENV === "development") {
    console.log(`[Entwicklung] ${meldung}`);
  }
}
