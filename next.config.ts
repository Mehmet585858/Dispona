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
  // HTTPS erzwingen und ein paar Standard-Schutzheader setzen (docs/08-datenschutz-sicherheit.md
  // "Verschlüsselung: HTTPS überall"). HSTS wirkt nur, wenn der Browser die Seite schon einmal
  // über HTTPS gesehen hat – im lokalen http-Betrieb harmlos und ohne Effekt.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
