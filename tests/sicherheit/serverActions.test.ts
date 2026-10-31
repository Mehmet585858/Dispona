import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Maßnahme M-02 (Punkt 4): Jede exportierte Server Action beginnt mit einer Rollenprüfung.
 * Prüfbericht S1-001/S2-001/S3-003/R3-6: "wer eingeloggt ist, darf fast alles" entstand, weil
 * einzelne Actions nur requireSession() oder gar nichts aufriefen. Dieser Test liest jede
 * "use server"-Datei und verlangt in jeder exportierten Funktion einen der rollenbezogenen Aufrufe.
 * Neue Actions ohne Prüfung lassen den Test rot werden.
 */
const WURZEL = path.resolve(import.meta.dirname, "../../src/app");

/** Bewusst öffentliche Dateien – jede mit Begründung. */
const OEFFENTLICH_ERLAUBT = new Set([
  // Anmeldung/Registrierung passieren naturgemäß ohne Sitzung.
  "(auth)/anmeldung/actions.ts",
  "(auth)/registrieren/actions.ts",
  // Öffentliche Live-Demo, fest auf DEMO_TENANT_ID (Maßnahme M-24 bearbeitet den Transkript-Teil).
  "live/actions.ts",
]);

const ROLLENPRUEFUNG = /\b(requireBueroSession|requireAdminSession|requireFahrerSession|adminSession)\(\)/;

function serverActionDateien(ordner: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(ordner)) {
    const voll = path.join(ordner, eintrag);
    if (statSync(voll).isDirectory()) {
      gefunden.push(...serverActionDateien(voll));
    } else if (/\.tsx?$/.test(eintrag)) {
      const inhalt = readFileSync(voll, "utf8");
      if (/^\s*["']use server["'];?/m.test(inhalt.split("\n").slice(0, 3).join("\n"))) gefunden.push(voll);
    }
  }
  return gefunden;
}

/** Zerlegt eine Datei in ihre exportierten Funktionen (Name + Rumpf bis zur nächsten exportierten Funktion). */
export function exportierteFunktionen(inhalt: string): { name: string; rumpf: string }[] {
  const muster = /export\s+async\s+function\s+([A-Za-zÄÖÜäöüß0-9_]+)\s*\(/g;
  const treffer = [...inhalt.matchAll(muster)];
  return treffer.map((t, index) => {
    const start = t.index ?? 0;
    const ende = index + 1 < treffer.length ? (treffer[index + 1].index ?? inhalt.length) : inhalt.length;
    return { name: t[1], rumpf: inhalt.slice(start, ende) };
  });
}

describe("M-02: Rollenprüfung in jeder Server Action", () => {
  const dateien = serverActionDateien(WURZEL);

  it("findet die Action-Dateien (Selbsttest des Scanners)", () => {
    expect(dateien.length).toBeGreaterThanOrEqual(10);
  });

  for (const datei of dateien) {
    const relativ = path.relative(WURZEL, datei).split(path.sep).join("/");
    if (OEFFENTLICH_ERLAUBT.has(relativ)) continue;
    const inhalt = readFileSync(datei, "utf8");

    it(`${relativ}: jede exportierte Funktion ruft eine Rollenprüfung auf`, () => {
      const funktionen = exportierteFunktionen(inhalt);
      expect(funktionen.length).toBeGreaterThan(0);
      const ohnePruefung = funktionen.filter((f) => !ROLLENPRUEFUNG.test(f.rumpf)).map((f) => f.name);
      expect(ohnePruefung, `ohne Rollenprüfung: ${ohnePruefung.join(", ")}`).toEqual([]);
    });

    it(`${relativ}: nutzt nicht mehr das rollenlose requireSession()`, () => {
      expect(inhalt).not.toMatch(/\brequireSession\(\)/);
    });
  }

  it("Fahrer-App-Actions prüfen die Rolle FAHRER, nicht nur die Sitzung", () => {
    const inhalt = readFileSync(path.join(WURZEL, "fahrer/actions.ts"), "utf8");
    for (const f of exportierteFunktionen(inhalt)) {
      expect(f.rumpf, f.name).toMatch(/requireFahrerSession\(\)/);
    }
  });
});
