import { describe, expect, it } from "vitest";
import { berlinerMitternacht, datumIso, mitUhrzeit, tagVerschieben } from "@/core/shifts/week";

/**
 * Maßnahme M-46 Punkt 4 (Prüfbericht S2-020): Die Zeithilfen haben ungültige Werte still umgedeutet –
 * "2026-02-30" wurde der 2. März, "2026-13-45" der 14.02.2027, "halb acht" 00:00 Uhr, "25:00" der
 * Folgetag 01:00, "0630" ein Termin Wochen später; "morgen" endete in einem rohen "Invalid time value".
 * Jetzt: klarer Fehler statt Raten.
 */
describe("Zeitangaben werden nicht mehr umgedeutet (M-46, S2-020)", () => {
  const tag = berlinerMitternacht("2026-11-03");

  it.each(["2026-02-30", "2026-13-45", "2026-00-10", "2025-02-29", "03.11.2026", "morgen", "", "2026-1-5"])(
    "M-46: berlinerMitternacht(%j) wirft einen klaren Fehler",
    (wert) => {
      expect(() => berlinerMitternacht(wert)).toThrow(/Ungültiges Datum/);
    },
  );

  it.each(["halb acht", "6.30", "0630", "25:00", "24:00", "07:60", "", "6:30 Uhr", "7"])(
    "M-46: mitUhrzeit(tag, %j) wirft einen klaren Fehler",
    (wert) => {
      expect(() => mitUhrzeit(tag, wert)).toThrow(/Ungültige Uhrzeit/);
    },
  );

  it("M-46: tagVerschieben lehnt ungültige Daten ebenfalls ab", () => {
    expect(() => tagVerschieben("2026-02-30", 1)).toThrow(/Ungültiges Datum/);
  });

  it("M-46: gültige Werte bleiben unverändert – auch Schaltjahr, Monatsende und einstellige Stunde", () => {
    expect(datumIso(berlinerMitternacht("2028-02-29"))).toBe("2028-02-29");
    expect(datumIso(berlinerMitternacht("2026-12-31"))).toBe("2026-12-31");
    expect(mitUhrzeit(tag, "06:30").toISOString()).toBe("2026-11-03T05:30:00.000Z");
    expect(mitUhrzeit(tag, "6:30").toISOString()).toBe("2026-11-03T05:30:00.000Z");
    expect(mitUhrzeit(tag, "23:59").toISOString()).toBe("2026-11-03T22:59:00.000Z");
    expect(tagVerschieben("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("M-46: die Fehlermeldung enthält den Eingabewert nicht (kann ein Geburtsdatum sein, Fehler landen in Sentry)", () => {
    expect(() => berlinerMitternacht("1941-02-30")).toThrow(expect.objectContaining({ message: expect.not.stringContaining("1941") }));
  });
});
