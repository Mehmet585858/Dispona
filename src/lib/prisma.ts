import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Kleiner, kurzlebiger Pool: die lokale Entwicklungsdatenbank (npx prisma dev)
    // trennt inaktive Verbindungen von sich aus, lange gehaltene Verbindungen führen
    // sonst zu "Server has closed the connection"-Fehlern.
    max: 5,
    idleTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
