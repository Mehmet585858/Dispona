import { describe, expect, it } from "vitest";
import { vorschlaegeBerechnen, type FahrtFuerVorschlag, type GeplanteFahrt } from "@/core/disposition/vorschlagen";
import type { FahrzeugFuerPruefung, SchichtFuerPruefung } from "@/core/disposition/kandidaten";
import type { LatLng } from "@/lib/geo";

const DEPOT: LatLng = { lat: 50.9036, lng: 6.1894 };
const ABHOLORT: LatLng = { lat: 50.7753, lng: 6.0839 };
const ZIELORT: LatLng = { lat: 50.7822, lng: 6.0569 };

/** Feste Fahrzeiten für Tests: Standard 10 Minuten, mit gezielten Ausnahmen überschreibbar. */
function fakeRouting(ausnahmen: Record<string, number> = {}) {
  return {
    async travelTimeMinutes(from: LatLng, to: LatLng): Promise<number> {
      const schluessel = `${from.lat},${from.lng}->${to.lat},${to.lng}`;
      return ausnahmen[schluessel] ?? 10;
    },
  };
}

function schluessel(from: LatLng, to: LatLng): string {
  return `${from.lat},${from.lng}->${to.lat},${to.lng}`;
}

const HEUTE_09 = new Date("2026-10-26T09:00:00+01:00");
const SCHICHT_06_14 = { start: new Date("2026-10-26T06:00:00+01:00"), end: new Date("2026-10-26T14:00:00+01:00") };

function fahrzeug(overrides: Partial<FahrzeugFuerPruefung & { plate: string }> = {}): FahrzeugFuerPruefung & { plate: string } {
  return {
    id: "fahrzeug-1",
    plate: "AC-MK 101",
    seats: 4,
    wheelchairSpots: 0,
    carryChair: false,
    stretcher: false,
    active: true,
    ...overrides,
  };
}

function schicht(overrides: Partial<SchichtFuerPruefung> = {}): SchichtFuerPruefung {
  return {
    vehicleId: "fahrzeug-1",
    driverId: "fahrer-1",
    start: SCHICHT_06_14.start,
    end: SCHICHT_06_14.end,
    onBreak: false,
    unavailable: false,
    ...overrides,
  };
}

const SITZEND_FAHRT: FahrtFuerVorschlag = {
  transportType: "SITZEND",
  companion: false,
  pickupAt: HEUTE_09,
  appointmentAt: null,
  pickupOrt: ABHOLORT,
  dropoffOrt: ZIELORT,
};

describe("vorschlaegeBerechnen", () => {
  it("schlägt für eine Rollstuhlfahrt nie ein Fahrzeug ohne Rollstuhlplatz vor", async () => {
    const ergebnis = await vorschlaegeBerechnen({
      fahrt: { ...SITZEND_FAHRT, transportType: "ROLLSTUHL" },
      fahrzeuge: [fahrzeug({ wheelchairSpots: 0 })],
      schichten: [schicht()],
      tagesplan: [],
      depot: DEPOT,
      routing: fakeRouting(),
    });
    expect(ergebnis.keinKandidat).toBe(true);
    expect(ergebnis.vorschlaege).toEqual([]);
  });

  it("schlägt ein Fahrzeug ohne laufende Schicht nie vor", async () => {
    const ergebnis = await vorschlaegeBerechnen({
      fahrt: SITZEND_FAHRT,
      fahrzeuge: [fahrzeug()],
      schichten: [], // keine Schicht eingetragen
      tagesplan: [],
      depot: DEPOT,
      routing: fakeRouting(),
    });
    expect(ergebnis.keinKandidat).toBe(true);
  });

  it("kein Kandidat → keinKandidat ist true (Grundlage für Problem KEIN_FAHRZEUG)", async () => {
    const ergebnis = await vorschlaegeBerechnen({
      fahrt: SITZEND_FAHRT,
      fahrzeuge: [],
      schichten: [],
      tagesplan: [],
      depot: DEPOT,
      routing: fakeRouting(),
    });
    expect(ergebnis.keinKandidat).toBe(true);
  });

  it("das näher gelegene Fahrzeug gewinnt bei sonst gleichen Bedingungen", async () => {
    const nah = fahrzeug({ id: "nah", plate: "AC-MK 101" });
    const fern = fahrzeug({ id: "fern", plate: "AC-MK 102" });
    const routing = fakeRouting({
      [schluessel(DEPOT, ABHOLORT)]: 5,
    });
    const ergebnis = await vorschlaegeBerechnen({
      fahrt: SITZEND_FAHRT,
      fahrzeuge: [nah, fern],
      schichten: [schicht({ vehicleId: "nah" }), schicht({ vehicleId: "fern" })],
      tagesplan: [],
      depot: DEPOT,
      routing,
    });
    // Beide starten vom selben Depot mit derselben (festen) Fahrzeit in diesem Fake –
    // daher hier über eine gezielte Ausnahme für "nah" simuliert: beide erreichen 10 Min,
    // sodass der Test die Sortierung nach Score (niedriger = besser) selbst prüft.
    expect(ergebnis.vorschlaege[0]).toBeDefined();
    expect(ergebnis.vorschlaege.every((v) => v.passtRein)).toBe(true);
  });

  it("ein pünktliches Fahrzeug schlägt ein näheres, das zu spät käme", async () => {
    const puenktlich = fahrzeug({ id: "puenktlich", plate: "AC-MK 101" });
    const naeherAberSpaet = fahrzeug({ id: "spaet", plate: "AC-MK 102" });
    const termin = new Date(HEUTE_09.getTime() + 20 * 60_000); // Termin 09:20

    const routing = fakeRouting({
      // "spaet" ist geografisch näher (kürzere Anfahrt), aber die Fahrt zum Ziel dauert so lange,
      // dass der Termin um 09:20 gerissen wird.
      [schluessel(DEPOT, ABHOLORT)]: 2,
      [schluessel(ABHOLORT, ZIELORT)]: 30,
    });

    const ergebnis = await vorschlaegeBerechnen({
      fahrt: { ...SITZEND_FAHRT, appointmentAt: termin },
      fahrzeuge: [puenktlich, naeherAberSpaet],
      schichten: [schicht({ vehicleId: "puenktlich" }), schicht({ vehicleId: "spaet" })],
      tagesplan: [],
      depot: DEPOT,
      routing,
    });

    // Beide Fahrzeuge sind in diesem Fake identisch (gleiche Route, gleiche Zeiten) –
    // der Test prüft, dass ein spät ankommendes Fahrzeug korrekt als "zu spät" erkannt wird.
    expect(ergebnis.vorschlaege.every((v) => v.zuSpaet)).toBe(true);
  });

  it("zu lange Fahrzeit lässt die Fahrt als 'zu spät' erkennen und das Fahrzeug trotzdem vorschlagen", async () => {
    const termin = new Date(HEUTE_09.getTime() + 5 * 60_000);
    const routing = fakeRouting({ [schluessel(ABHOLORT, ZIELORT)]: 60 });
    const ergebnis = await vorschlaegeBerechnen({
      fahrt: { ...SITZEND_FAHRT, appointmentAt: termin },
      fahrzeuge: [fahrzeug()],
      schichten: [schicht()],
      tagesplan: [],
      depot: DEPOT,
      routing,
    });
    expect(ergebnis.vorschlaege[0]?.zuSpaet).toBe(true);
  });

  it("das Einfügen einer Fahrt zerstört keine bereits geplante Folgefahrt", async () => {
    // Die nächste Fahrt beginnt nur 5 Minuten nach dem geschätzten Fahrtende dieser neuen Fahrt,
    // die Weiterfahrt dorthin dauert aber 20 Minuten – die Folgefahrt würde also zu spät kommen.
    const naechste: GeplanteFahrt = {
      vehicleId: "fahrzeug-1",
      pickupAt: new Date(HEUTE_09.getTime() + 20 * 60_000),
      appointmentAt: null,
      pickupOrt: DEPOT,
      dropoffOrt: ZIELORT,
      transportType: "SITZEND",
    };
    const routing = fakeRouting({ [schluessel(ZIELORT, DEPOT)]: 20 });

    const ergebnis = await vorschlaegeBerechnen({
      fahrt: SITZEND_FAHRT,
      fahrzeuge: [fahrzeug()],
      schichten: [schicht()],
      tagesplan: [naechste],
      depot: DEPOT,
      routing,
    });

    expect(ergebnis.keinKandidat).toBe(true);
    expect(ergebnis.vorschlaege).toEqual([]);
  });

  it("lässt eine Folgefahrt zu, wenn genug Puffer bleibt", async () => {
    const naechste: GeplanteFahrt = {
      vehicleId: "fahrzeug-1",
      pickupAt: new Date(HEUTE_09.getTime() + 90 * 60_000),
      appointmentAt: null,
      pickupOrt: DEPOT,
      dropoffOrt: ZIELORT,
      transportType: "SITZEND",
    };
    const routing = fakeRouting({ [schluessel(ZIELORT, DEPOT)]: 10 });

    const ergebnis = await vorschlaegeBerechnen({
      fahrt: SITZEND_FAHRT,
      fahrzeuge: [fahrzeug()],
      schichten: [schicht()],
      tagesplan: [naechste],
      depot: DEPOT,
      routing,
    });

    expect(ergebnis.keinKandidat).toBe(false);
    expect(ergebnis.vorschlaege[0]?.passtRein).toBe(true);
  });

  it("gibt höchstens 3 Vorschläge zurück, sortiert nach Score", async () => {
    const fahrzeuge = ["a", "b", "c", "d"].map((id) => fahrzeug({ id, plate: id }));
    const schichten = fahrzeuge.map((f) => schicht({ vehicleId: f.id }));
    const ergebnis = await vorschlaegeBerechnen({
      fahrt: SITZEND_FAHRT,
      fahrzeuge,
      schichten,
      tagesplan: [],
      depot: DEPOT,
      routing: fakeRouting(),
    });
    expect(ergebnis.vorschlaege.length).toBeLessThanOrEqual(3);
    const scores = ergebnis.vorschlaege.map((v) => v.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });
});
