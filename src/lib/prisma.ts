import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var __prisma: PrismaClient | undefined;
}

// npx prisma dev (lokale Entwicklungsdatenbank) kappt gelegentlich eine Verbindung im
// Hintergrund, bevor der Pool das merkt – die nächste Abfrage auf dieser Verbindung schlägt
// dann mit genau diesen Meldungen fehl, obwohl die Datenbank selbst längst wieder erreichbar
// ist. Das betrifft nicht nur unsere eigenen Abfragen, sondern auch die von better-auth
// (Session, Verification), die denselben Client direkt nutzen – deshalb hier zentral und
// nicht erst in withTenant(): einmal automatisch erneut versuchen, statt dem Nutzer einen
// Serverfehler zu zeigen oder ihn ungewollt abzumelden.
function istVorruebergehenderVerbindungsfehler(fehler: unknown): boolean {
  const nachricht = fehler instanceof Error ? fehler.message : String(fehler);
  return (
    nachricht.includes("Connection terminated unexpectedly") ||
    nachricht.includes("Server has closed the connection") ||
    nachricht.includes("ECONNRESET") ||
    nachricht.includes("ETIMEDOUT")
  );
}

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Pool-Größe für die lokale Entwicklungsdatenbank (npx prisma dev): groß genug für
    // mehrere gleichzeitige Abfragen auf einer Seite (z. B. Promise.all mit 5+ Abfragen),
    // sonst "Connection terminated unexpectedly" bei paralleler Last.
    max: 15,
    // Kurz gehalten, damit wir Verbindungen erneuern, bevor npx prisma dev sie im
    // Hintergrund selbst stillschweigend schließt ("Server has closed the connection"
    // bei der nächsten Abfrage auf einer schon toten, aber noch im Pool liegenden
    // Verbindung – typisches Symptom bei dieser lokalen Entwicklungsdatenbank).
    idleTimeoutMillis: 8_000,
    // TCP-Keepalive, damit Verbindungen nicht durch Windows/die lokale Datenbank
    // unbemerkt im Leerlauf wegfallen.
    keepAlive: true,
    keepAliveInitialDelayMillis: 5_000,
  });
  const client = new PrismaClient({ adapter });
  return client.$extends({
    name: "wiederholungBeiVerbindungsabbruch",
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          try {
            return await query(args);
          } catch (fehler) {
            if (!istVorruebergehenderVerbindungsfehler(fehler)) throw fehler;
            await new Promise((resolve) => setTimeout(resolve, 150));
            return query(args);
          }
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
