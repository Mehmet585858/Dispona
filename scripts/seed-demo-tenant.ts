/**
 * Legt den dauerhaften Demo-Mandanten für die öffentliche Live-Demo an (marketing Seite ->
 * app.dispona.de/live). Dünner CLI-Wrapper um src/core/demo/seedDemoTenant.ts - die eigentliche
 * Logik liegt dort, damit sie auch ein einmaliger Cron-Aufruf nutzen kann (siehe dort für den
 * Hintergrund).
 *
 * Aufruf (mit der echten DATABASE_URL, z. B. aus Vercel/Neon):
 *   $env:DATABASE_URL = "postgres://...neon.tech/neondb?sslmode=require"
 *   npx tsx scripts/seed-demo-tenant.ts
 *
 * Die Vapi-Telefonnummer für die Demo ist noch nicht bekannt (muss erst bei Vapi eingerichtet
 * werden) - dieses Skript legt die PhoneNumber-Zeile nur an, wenn DEMO_VAPI_NUMMER gesetzt ist:
 *   $env:DEMO_VAPI_NUMMER = "+49..."; npx tsx scripts/seed-demo-tenant.ts
 */
import { seedDemoTenant } from "../src/core/demo/seedDemoTenant";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL fehlt. Bitte vor dem Aufruf setzen (siehe Kommentar oben im Script).");
}

seedDemoTenant()
  .then((ergebnis) => {
    console.log("Fertig:", ergebnis);
    console.log("Live-Ansicht (sobald die App läuft): /live");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
