import { describe, expect, it } from "vitest";
import { adresseZerlegen, ortAbgleichen, ortKandidatenWhere } from "@/core/places/suche";

/** Maßnahme M-06 / Prüfbericht S1-003: Teiltreffer dürfen nie "sicher" sein. */
const ORTE = [
  { id: "p1", label: "Wohnung Testmann", street: "Hauptstraße 12", zip: "52499", city: "Baesweiler" },
  { id: "p2", label: "Dialysezentrum Aachen", street: "Kirchstraße 5", zip: "52062", city: "Aachen" },
  { id: "p3", label: "Praxis Dr. Weber", street: "Hauptstr. 1", zip: "52080", city: "Aachen" },
];

describe("adresseZerlegen", () => {
  it("trennt Straße, Hausnummer, PLZ und Ort", () => {
    expect(adresseZerlegen("Hauptstraße 12, 52499 Baesweiler")).toMatchObject({ strasse: "Hauptstraße", hausnummer: "12", plz: "52499", ort: "Baesweiler" });
    expect(adresseZerlegen("Hauptstraße 12a")).toMatchObject({ strasse: "Hauptstraße", hausnummer: "12a", plz: "", ort: "" });
    expect(adresseZerlegen("Aachen")).toMatchObject({ strasse: "", hausnummer: "", frei: "Aachen" });
  });
});

describe("ortAbgleichen (M-06, S1-003)", () => {
  it("S1-003: 'Hauptstraße 1' trifft NICHT 'Hauptstraße 12' als sicher", () => {
    const ergebnis = ortAbgleichen(ORTE, "Hauptstraße 1");
    expect(ergebnis.art).not.toBe("sicher");
    // Es gibt eine echte "Hauptstr. 1" (ohne Ortsangabe im Text) – nur als unsicherer Vorschlag.
    expect(ergebnis).toMatchObject({ art: "unsicher", orte: [expect.objectContaining({ id: "p3" })] });
  });

  it("S1-003: ein bloßer Ortsname ('Aachen') ist kein Treffer", () => {
    expect(ortAbgleichen(ORTE, "Aachen")).toEqual({ art: "keiner" });
  });

  it("Straße + Hausnummer ohne PLZ/Ort → unsicher, mit passender PLZ oder passendem Ort → sicher", () => {
    expect(ortAbgleichen(ORTE, "Hauptstraße 12")).toMatchObject({ art: "unsicher", orte: [expect.objectContaining({ id: "p1" })] });
    expect(ortAbgleichen(ORTE, "Hauptstraße 12, 52499 Baesweiler")).toMatchObject({ art: "sicher", ort: expect.objectContaining({ id: "p1" }) });
    expect(ortAbgleichen(ORTE, "Hauptstr. 12, Baesweiler")).toMatchObject({ art: "sicher", ort: expect.objectContaining({ id: "p1" }) });
    expect(ortAbgleichen(ORTE, "Hauptstraße 12, 52062 Aachen")).toMatchObject({ art: "unsicher" });
  });

  it("exakter Ortsname ist sicher, ähnlicher nur unsicher", () => {
    expect(ortAbgleichen(ORTE, "Dialysezentrum Aachen")).toMatchObject({ art: "sicher", ort: expect.objectContaining({ id: "p2" }) });
    expect(ortAbgleichen(ORTE, "Dialysezentrum Achen")).toMatchObject({ art: "unsicher", orte: [expect.objectContaining({ id: "p2" })] });
  });

  it("ortKandidatenWhere sucht Straße und Name, nicht den Ort allein", () => {
    const where = ortKandidatenWhere("Hauptstraße 1");
    expect(where.OR[0]).toEqual({ street: { contains: "Haupt", mode: "insensitive" } });
    expect(JSON.stringify(where)).not.toContain("city");
  });
});
