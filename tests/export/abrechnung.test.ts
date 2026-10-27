import { describe, expect, it } from "vitest";
import {
  EXPORT_SPALTEN_LABEL,
  exportZeilenBauen,
  spaltenReihenfolgeBereinigen,
  STANDARD_SPALTENREIHENFOLGE,
  type FahrtFuerExport,
} from "@/core/export/abrechnung";

function basisFahrt(overrides: Partial<FahrtFuerExport> = {}): FahrtFuerExport {
  return {
    passenger: { firstName: "Erika", lastName: "Schmitz", birthDate: new Date("1945-03-12"), insurer: "AOK" },
    pickupAt: new Date("2026-06-15T09:00:00+02:00"),
    completedAt: new Date("2026-06-15T09:35:00+02:00"),
    pickupPlace: { street: "Hauptstraße 1", zip: "52062", city: "Aachen" },
    dropoffPlace: { street: "Klinikweg 2", zip: "52066", city: "Aachen" },
    transportType: "ROLLSTUHL",
    distanceKm: 12.3,
    vehiclePlate: "AC-MK 101",
    fahrerName: "Fatih Fahrer",
    prescription: "JA",
    approval: "NICHT_NOETIG",
    seriesId: null,
    assistanceNotes: "Hilfe bis zur Wohnung",
    problems: [],
    ...overrides,
  };
}

describe("spaltenReihenfolgeBereinigen", () => {
  it("übernimmt eine gültige gespeicherte Reihenfolge unverändert (alle 16 Spalten vorhanden)", () => {
    const umgedreht = [...STANDARD_SPALTENREIHENFOLGE].reverse();
    expect(spaltenReihenfolgeBereinigen(umgedreht)).toEqual(umgedreht);
  });

  it("ergänzt fehlende Spalten hinten an", () => {
    const ergebnis = spaltenReihenfolgeBereinigen(["datum", "fahrgastName"]);
    expect(ergebnis[0]).toBe("datum");
    expect(ergebnis[1]).toBe("fahrgastName");
    expect(ergebnis).toHaveLength(STANDARD_SPALTENREIHENFOLGE.length);
  });

  it("verwirft unbekannte Einträge und liefert bei null den Standard", () => {
    expect(spaltenReihenfolgeBereinigen(["nichtVorhanden", "datum"])).toEqual(
      expect.arrayContaining(["datum"]),
    );
    expect(spaltenReihenfolgeBereinigen(null)).toEqual(STANDARD_SPALTENREIHENFOLGE);
  });
});

describe("exportZeilenBauen", () => {
  it("baut Kopf- und Datenzeile in der angegebenen Spaltenreihenfolge", () => {
    const { kopf, zeilen } = exportZeilenBauen([basisFahrt()], ["datum", "fahrgastName", "gefahreneKm"]);
    expect(kopf).toEqual([
      EXPORT_SPALTEN_LABEL.datum,
      EXPORT_SPALTEN_LABEL.fahrgastName,
      EXPORT_SPALTEN_LABEL.gefahreneKm,
    ]);
    expect(zeilen).toEqual([["2026-06-15", "Erika Schmitz", "12,3"]]);
  });

  it("formatiert Adressen, Uhrzeiten und Beförderungsart", () => {
    const { zeilen } = exportZeilenBauen(
      [basisFahrt()],
      ["abholzeit", "ankunft", "abholadresse", "befoerderungsart"],
    );
    expect(zeilen[0]).toEqual(["09:00", "09:35", "Hauptstraße 1, 52062 Aachen", "Rollstuhl"]);
  });

  it("zeigt Serie als Ja/Nein und fasst Hinweise mit Problemen zusammen", () => {
    const { zeilen } = exportZeilenBauen(
      [basisFahrt({ seriesId: "serie1", problems: ["ADRESSE_UNSICHER"] })],
      ["serie", "hinweise"],
    );
    expect(zeilen[0]).toEqual(["Ja", "Hilfe bis zur Wohnung; ADRESSE_UNSICHER"]);
  });

  it("lässt fehlende Angaben (Ankunft, km, Fahrzeug) als leere Zellen", () => {
    const { zeilen } = exportZeilenBauen(
      [basisFahrt({ completedAt: null, distanceKm: null, vehiclePlate: null, fahrerName: null })],
      ["ankunft", "gefahreneKm", "fahrzeug", "fahrer"],
    );
    expect(zeilen[0]).toEqual(["", "", "", ""]);
  });
});
