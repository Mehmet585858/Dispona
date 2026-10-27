import { describe, expect, it } from "vitest";
import { rruleAusWochentagen, terminePlanen, wochentageAusRrule } from "@/core/shifts/rrule";

describe("rruleAusWochentagen / wochentageAusRrule", () => {
  it("baut eine RRULE aus Wochentagen, sortiert nach Wochenbeginn", () => {
    expect(rruleAusWochentagen(["FR", "MO", "MI"])).toBe("FREQ=WEEKLY;BYDAY=MO,WE,FR");
  });

  it("liest Wochentage aus einer RRULE zurück", () => {
    expect(wochentageAusRrule("FREQ=WEEKLY;BYDAY=MO,WE,FR")).toEqual(["MO", "MI", "FR"]);
  });

  it("gibt eine leere Liste ohne BYDAY zurück", () => {
    expect(wochentageAusRrule("FREQ=WEEKLY")).toEqual([]);
  });
});

describe("terminePlanen", () => {
  it("findet alle Mo/Mi/Fr-Termine in einem Zeitraum", () => {
    // 2026-06-15 ist ein Montag
    const rrule = rruleAusWochentagen(["MO", "MI", "FR"]);
    const termine = terminePlanen(rrule, "2026-06-15", "2026-06-21");
    expect(termine).toEqual(["2026-06-15", "2026-06-17", "2026-06-19"]);
  });

  it("gibt eine leere Liste zurück, wenn vonDatum nach bisDatum liegt", () => {
    const rrule = rruleAusWochentagen(["MO"]);
    expect(terminePlanen(rrule, "2026-06-20", "2026-06-15")).toEqual([]);
  });

  it("funktioniert über einen Monatswechsel hinweg", () => {
    const rrule = rruleAusWochentagen(["SO"]);
    expect(terminePlanen(rrule, "2026-05-30", "2026-06-02")).toEqual(["2026-05-31"]);
  });
});
