import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Pool-Größe für die lokale Entwicklungsdatenbank (npx prisma dev): groß genug für
    // mehrere gleichzeitige Abfragen auf einer Seite (z. B. Promise.all mit 5+ Abfragen),
    // sonst "Connection terminated unexpectedly" bei paralleler Last.
    max: 15,
    idleTimeoutMillis: 30_000,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
