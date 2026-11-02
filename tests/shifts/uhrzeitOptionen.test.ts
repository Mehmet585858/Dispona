import { describe, expect, it } from "vitest";
import { uhrzeitOptionen } from "@/app/dispo/schichtplan/anzeige";

/** Beginn/Ende im Schichtplan: immer 24-Stunden-Format in Viertelstunden, nie „AM/PM“. */
describe("uhrzeitOptionen", () => {
  it("liefert 00:00 bis 23:45 in Viertelstunden", () => {
    const liste = uhrzeitOptionen();
    expect(liste).toHaveLength(96);
    expect(liste[0]).toBe("00:00");
    expect(liste).toContain("06:00");
    expect(liste).toContain("14:00");
    expect(liste).toContain("22:30");
    expect(liste.at(-1)).toBe("23:45");
  });

  it("behält eine vorhandene Zeit außerhalb des Rasters und sortiert sie ein", () => {
    const liste = uhrzeitOptionen("06:10");
    expect(liste).toHaveLength(97);
    expect(liste.indexOf("06:10")).toBe(liste.indexOf("06:00") + 1);
  });

  it("fügt nichts doppelt oder Ungültiges hinzu", () => {
    expect(uhrzeitOptionen("06:00")).toHaveLength(96);
    expect(uhrzeitOptionen("")).toHaveLength(96);
    expect(uhrzeitOptionen("6 Uhr")).toHaveLength(96);
  });
});
