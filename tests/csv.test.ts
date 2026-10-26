import { describe, expect, it } from "vitest";
import { spaltenVorschlagen, zeilenZuordnen, type ImportFeld } from "@/lib/csv";

const FAHRZEUG_FELDER: ImportFeld[] = [
  { schlüssel: "plate", label: "Kennzeichen", pflicht: true },
  { schlüssel: "seats", label: "Sitzplätze", pflicht: true },
  { schlüssel: "wheelchairSpots", label: "Rollstuhlplätze", pflicht: false },
  { schlüssel: "carryChair", label: "Tragestuhl (ja/nein)", pflicht: false },
  { schlüssel: "stretcher", label: "Liegend (ja/nein)", pflicht: false },
];

describe("spaltenVorschlagen", () => {
  it("ordnet ähnliche Spaltennamen nicht dem falschen Feld zu (Plätze vs. Rollstuhlplätze)", () => {
    const zuordnung = spaltenVorschlagen(FAHRZEUG_FELDER, [
      "Kennzeichen",
      "Plaetze",
      "Rollstuhlplaetze",
      "Tragestuhl",
      "Liegend",
    ]);
    expect(zuordnung.seats).toBe("Plaetze");
    expect(zuordnung.wheelchairSpots).toBe("Rollstuhlplaetze");
  });

  it("findet exakte Treffer unabhängig von Groß-/Kleinschreibung und Umlauten", () => {
    const zuordnung = spaltenVorschlagen(FAHRZEUG_FELDER, ["kennzeichen", "SITZPLAETZE"]);
    expect(zuordnung.plate).toBe("kennzeichen");
    expect(zuordnung.seats).toBe("SITZPLAETZE");
  });

  it("ordnet jede Spalte höchstens einem Feld zu", () => {
    const zuordnung = spaltenVorschlagen(FAHRZEUG_FELDER, ["Kennzeichen"]);
    const werte = Object.values(zuordnung);
    expect(new Set(werte).size).toBe(werte.length);
  });

  it("lässt Felder ohne passende Spalte leer, statt eine falsche zu raten", () => {
    const zuordnung = spaltenVorschlagen(FAHRZEUG_FELDER, ["Kennzeichen", "Sonstiges"]);
    expect(zuordnung.seats).toBeUndefined();
  });
});

describe("zeilenZuordnen", () => {
  it("überträgt Werte von der Quellspalte auf den Feldschlüssel und trimmt sie", () => {
    const ergebnis = zeilenZuordnen(
      [{ Kennzeichen: " AC-MK 101 ", Plaetze: "4" }],
      { plate: "Kennzeichen", seats: "Plaetze" },
    );
    expect(ergebnis).toEqual([{ plate: "AC-MK 101", seats: "4" }]);
  });
});
