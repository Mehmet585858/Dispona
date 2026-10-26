import { describe, expect, it } from "vitest";
import { entfernungKm } from "@/lib/geo";
import {
  fahrtPruefen,
  hatGueltigeGenehmigung,
  imEinsatzgebiet,
  istDoppelbuchung,
} from "@/core/rides/pruefungen";

const AACHEN = { lat: 50.7753, lng: 6.0839 };
const KOELN = { lat: 50.9375, lng: 6.9603 }; // ca. 55 km entfernt

describe("entfernungKm / imEinsatzgebiet", () => {
  it("berechnet eine plausible Entfernung Aachen–Köln", () => {
    const km = entfernungKm(AACHEN, KOELN);
    expect(km).toBeGreaterThan(55);
    expect(km).toBeLessThan(75);
  });

  it("erkennt einen Ort außerhalb des Einsatzgebiets", () => {
    expect(imEinsatzgebiet(KOELN, AACHEN, 30)).toBe(false);
    expect(imEinsatzgebiet(AACHEN, AACHEN, 30)).toBe(true);
  });
});

describe("istDoppelbuchung", () => {
  it("erkennt eine Abholzeit innerhalb von 60 Minuten als Doppelbuchung", () => {
    const bestehende = [new Date("2026-10-26T09:00:00Z")];
    expect(istDoppelbuchung(bestehende, new Date("2026-10-26T09:45:00Z"))).toBe(true);
    expect(istDoppelbuchung(bestehende, new Date("2026-10-26T11:00:00Z"))).toBe(false);
  });
});

describe("hatGueltigeGenehmigung", () => {
  it("prüft, ob das Fahrtdatum im Gültigkeitszeitraum liegt", () => {
    const genehmigungen = [
      { validFrom: new Date("2026-01-01"), validUntil: new Date("2026-12-31") },
    ];
    expect(hatGueltigeGenehmigung(genehmigungen, new Date("2026-06-15"))).toBe(true);
    expect(hatGueltigeGenehmigung(genehmigungen, new Date("2027-01-15"))).toBe(false);
  });
});

describe("fahrtPruefen", () => {
  it("meldet keine Probleme bei einer unauffälligen Fahrt", () => {
    const probleme = fahrtPruefen({
      pickupOrt: AACHEN,
      pickupAt: new Date("2026-10-26T09:00:00Z"),
      bestehendeAbholzeitenDesFahrgasts: [],
      approval: "NICHT_NOETIG",
      genehmigungen: [],
      serviceAreaCenter: AACHEN,
      serviceAreaKm: 30,
    });
    expect(probleme).toEqual([]);
  });

  it("sammelt mehrere Probleme gleichzeitig", () => {
    const probleme = fahrtPruefen({
      pickupOrt: KOELN,
      pickupAt: new Date("2026-10-26T09:00:00Z"),
      bestehendeAbholzeitenDesFahrgasts: [new Date("2026-10-26T09:30:00Z")],
      approval: "JA",
      genehmigungen: [],
      serviceAreaCenter: AACHEN,
      serviceAreaKm: 30,
      adresseUnsicher: true,
    });
    expect(probleme).toEqual(
      expect.arrayContaining(["DOPPELBUCHUNG", "AUSSERHALB_EINSATZGEBIET", "GENEHMIGUNG_FEHLT", "ADRESSE_UNSICHER"]),
    );
  });
});
