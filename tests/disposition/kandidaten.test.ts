import { describe, expect, it } from "vitest";
import { erfuelltAusstattung, findeAktiveSchicht } from "@/core/disposition/kandidaten";

const FAHRZEUG_SITZEND = {
  id: "v1",
  seats: 4,
  wheelchairSpots: 0,
  carryChair: false,
  stretcher: false,
  active: true,
};

describe("erfuelltAusstattung", () => {
  it("ROLLSTUHL benötigt mindestens einen Rollstuhlplatz", () => {
    expect(erfuelltAusstattung("ROLLSTUHL", false, FAHRZEUG_SITZEND)).toBe(false);
    expect(erfuelltAusstattung("ROLLSTUHL", false, { ...FAHRZEUG_SITZEND, wheelchairSpots: 1 })).toBe(true);
  });

  it("TRAGESTUHL benötigt carryChair", () => {
    expect(erfuelltAusstattung("TRAGESTUHL", false, FAHRZEUG_SITZEND)).toBe(false);
    expect(erfuelltAusstattung("TRAGESTUHL", false, { ...FAHRZEUG_SITZEND, carryChair: true })).toBe(true);
  });

  it("LIEGEND benötigt stretcher", () => {
    expect(erfuelltAusstattung("LIEGEND", false, FAHRZEUG_SITZEND)).toBe(false);
    expect(erfuelltAusstattung("LIEGEND", false, { ...FAHRZEUG_SITZEND, stretcher: true })).toBe(true);
  });

  it("SITZEND mit Begleitperson braucht 2 Plätze", () => {
    expect(erfuelltAusstattung("SITZEND", true, { ...FAHRZEUG_SITZEND, seats: 1 })).toBe(false);
    expect(erfuelltAusstattung("SITZEND", true, { ...FAHRZEUG_SITZEND, seats: 2 })).toBe(true);
  });

  it("inaktive Fahrzeuge erfüllen nie die Ausstattung", () => {
    expect(erfuelltAusstattung("SITZEND", false, { ...FAHRZEUG_SITZEND, active: false })).toBe(false);
  });
});

describe("findeAktiveSchicht", () => {
  const basis = {
    vehicleId: "v1",
    driverId: "d1",
    start: new Date("2026-10-26T06:00:00+01:00"),
    end: new Date("2026-10-26T14:00:00+01:00"),
    onBreak: false,
    unavailable: false,
  };

  it("findet eine laufende Schicht zum Zeitpunkt", () => {
    const treffer = findeAktiveSchicht([basis], "v1", new Date("2026-10-26T09:00:00+01:00"));
    expect(treffer?.driverId).toBe("d1");
  });

  it("findet keine Schicht außerhalb des Zeitfensters", () => {
    expect(findeAktiveSchicht([basis], "v1", new Date("2026-10-26T05:00:00+01:00"))).toBeUndefined();
  });

  it("ignoriert eine Schicht in Pause", () => {
    expect(findeAktiveSchicht([{ ...basis, onBreak: true }], "v1", new Date("2026-10-26T09:00:00+01:00"))).toBeUndefined();
  });

  it("ignoriert eine als 'ausgefallen' markierte Schicht", () => {
    expect(
      findeAktiveSchicht([{ ...basis, unavailable: true }], "v1", new Date("2026-10-26T09:00:00+01:00")),
    ).toBeUndefined();
  });
});
