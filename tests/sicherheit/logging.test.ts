import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Maßnahme M-09 (Prüfbericht S2-009): console.log ist nur in src/lib/logging.ts erlaubt; die
 * ESLint-Regel no-console sichert das ab. Dieser Test prüft beides – den Quelltext direkt und
 * dass die Regel in der Lint-Konfiguration wirklich greift.
 */
const SRC = path.resolve(import.meta.dirname, "../../src");

function tsDateien(ordner: string): string[] {
  const liste: string[] = [];
  for (const eintrag of readdirSync(ordner)) {
    const voll = path.join(ordner, eintrag);
    if (statSync(voll).isDirectory()) {
      if (eintrag !== "generated") liste.push(...tsDateien(voll));
    } else if (/\.tsx?$/.test(eintrag)) liste.push(voll);
  }
  return liste;
}

describe("M-09: kein console.log außerhalb src/lib/logging.ts", () => {
  it("M-09: der Quelltext enthält console.log/info/debug nur im Logger", () => {
    const treffer = tsDateien(SRC)
      .filter((d) => path.relative(SRC, d) !== path.join("lib", "logging.ts"))
      .filter((d) => /\bconsole\.(log|info|debug)\(/.test(readFileSync(d, "utf8")))
      .map((d) => path.relative(SRC, d));
    expect(treffer).toEqual([]);
  });

  it("M-09: ESLint meldet ein console.log in einer App-Datei als Fehler (Regel greift)", () => {
    const projekt = path.resolve(import.meta.dirname, "../..");
    let ausgabe = "";
    try {
      ausgabe = execFileSync(
        "node",
        ["node_modules/eslint/bin/eslint.js", "--stdin", "--stdin-filename", "src/core/pruef_logging_probe.ts", "--format", "json"],
        { cwd: projekt, input: "export function probe(id: string) {\n  console.log(id);\n}\n", encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
      ).toString();
    } catch (fehler) {
      // eslint beendet mit Exit-Code 1, sobald es Fehler meldet – genau der erwartete Fall.
      ausgabe = String((fehler as { stdout?: string | Buffer }).stdout ?? "");
    }
    const ergebnis = JSON.parse(ausgabe) as { messages: { ruleId: string | null }[] }[];
    expect(ergebnis[0]?.messages.some((m) => m.ruleId === "no-console")).toBe(true);
  }, 60_000);
});
