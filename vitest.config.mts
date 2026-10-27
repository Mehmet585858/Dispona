import { defineConfig } from "vitest/config";
import path from "node:path";
import "dotenv/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // Testdateien nacheinander UND im selben Worker statt parallel/isoliert: die lokale
    // Entwicklungsdatenbank (npx prisma dev) verträgt viele gleichzeitige Verbindungen
    // schlecht (siehe src/lib/prisma.ts). isolate:true (Standard) startet pro Testdatei
    // einen neuen Prozess mit einem neuen Verbindungs-Pool (globalThis.__prisma) – bei
    // vielen Testdateien hintereinander entstand und schloss sich laufend ein neuer Pool,
    // was immer wieder zu "Connection terminated unexpectedly" führte. isolate:false nutzt
    // für den ganzen Testlauf einen einzigen Pool.
    fileParallelism: false,
    isolate: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
