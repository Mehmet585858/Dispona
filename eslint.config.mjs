import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Maßnahme M-09 (Prüfbericht S2-009): kein console.log/info/debug in der App außerhalb von
  // src/lib/logging.ts – dort ist der einzige, auf die Entwicklung begrenzte Logger. warn/error
  // bleiben für Betriebsfehler erlaubt (nur IDs, nie Fahrgastdaten – CLAUDE.md).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/logging.ts", "src/generated/**"],
    rules: { "no-console": ["error", { allow: ["warn", "error"] }] },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
