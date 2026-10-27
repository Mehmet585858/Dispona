import { describe, expect, it } from "vitest";
import { feiertageNrw, istFeiertagNrw, osterSonntag } from "@/core/shifts/feiertageNrw";

describe("osterSonntag", () => {
  it("berechnet bekannte Ostersonntage korrekt", () => {
    expect(osterSonntag(2024)).toEqual({ monat: 3, tag: 31 });
    expect(osterSonntag(2025)).toEqual({ monat: 4, tag: 20 });
    expect(osterSonntag(2026)).toEqual({ monat: 4, tag: 5 });
    expect(osterSonntag(2027)).toEqual({ monat: 3, tag: 28 });
  });
});

describe("feiertageNrw", () => {
  it("enthält alle 11 gesetzlichen Feiertage für 2026, inkl. Fronleichnam und Allerheiligen", () => {
    const feiertage = feiertageNrw(2026);
    expect(feiertage).toHaveLength(11);
    expect(feiertage.map((f) => f.name)).toContain("Fronleichnam");
    expect(feiertage.map((f) => f.name)).toContain("Allerheiligen");
    expect(feiertage.find((f) => f.name === "Karfreitag")?.datum).toBe("2026-04-03");
    expect(feiertage.find((f) => f.name === "Ostermontag")?.datum).toBe("2026-04-06");
    expect(feiertage.find((f) => f.name === "Christi Himmelfahrt")?.datum).toBe("2026-05-14");
    expect(feiertage.find((f) => f.name === "Pfingstmontag")?.datum).toBe("2026-05-25");
    expect(feiertage.find((f) => f.name === "Fronleichnam")?.datum).toBe("2026-06-04");
  });
});

describe("istFeiertagNrw", () => {
  it("erkennt Neujahr als Feiertag", () => {
    expect(istFeiertagNrw("2026-01-01")).toBe("Neujahr");
  });
  it("gibt null an einem normalen Werktag zurück", () => {
    expect(istFeiertagNrw("2026-06-15")).toBeNull();
  });
});
