import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bearerErlaubt, geheimnisGleich } from "@/lib/geheimnis";

/**
 * Maßnahme M-14 Punkt 3 (Prüfbericht S4-007): Cron- und Webhook-Geheimnisse wurden mit `===`
 * verglichen – die Laufzeit verrät, ab welchem Zeichen ein geratenes Geheimnis abweicht.
 */
describe("Geheimnisvergleich (M-14, S4-007)", () => {
  it("M-14: geheimnisGleich vergleicht korrekt, auch bei unterschiedlicher Länge und ohne Wert", () => {
    expect(geheimnisGleich("abc123", "abc123")).toBe(true);
    expect(geheimnisGleich("abc124", "abc123")).toBe(false);
    expect(geheimnisGleich("abc", "abc123")).toBe(false);
    expect(geheimnisGleich(null, "abc123")).toBe(false);
    expect(geheimnisGleich("abc123", undefined)).toBe(false);
    expect(geheimnisGleich("", "")).toBe(false);
  });

  it("M-14: bearerErlaubt liest den Authorization-Header", () => {
    const anfrage = (wert?: string) => new Request("http://x.test", { headers: wert ? { authorization: wert } : {} });
    expect(bearerErlaubt(anfrage("Bearer geheim"), "geheim")).toBe(true);
    expect(bearerErlaubt(anfrage("Bearer falsch"), "geheim")).toBe(false);
    expect(bearerErlaubt(anfrage(), "geheim")).toBe(false);
    expect(bearerErlaubt(anfrage("Bearer geheim"), undefined)).toBe(false);
  });

  it("M-14: keine Cron-Route und kein Webhook vergleicht ein Geheimnis mehr mit === oder !==", () => {
    const cronOrdner = path.resolve(process.cwd(), "src/app/api/cron");
    const dateien = readdirSync(cronOrdner).map((d) => path.join(cronOrdner, d, "route.ts"));
    dateien.push(path.resolve(process.cwd(), "src/providers/voice/vapi.ts"));
    const verstoesse = dateien.filter((datei) => /(===|!==)\s*(`Bearer|secret\b)/.test(readFileSync(datei, "utf8")));
    expect(verstoesse).toEqual([]);
  });
});
