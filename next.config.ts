import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Next.js 16 "Cache Components" (Partial Prerendering) ist experimentell und hat bei uns
  // wiederholt Probleme verursacht: abgebrochene Prerender-Versuche haben die
  // Datenbankverbindung lahmgelegt ("Connection terminated unexpectedly"), dazu kamen
  // störende Entwicklungs-Fehlermeldungen auf fast jeder angemeldeten Seite. Da jede unserer
  // Seiten ohnehin erst die Anmeldung prüft, bringt uns die Funktion aktuell keinen Vorteil.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
