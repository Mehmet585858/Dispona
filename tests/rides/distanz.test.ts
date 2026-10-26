import { describe, expect, it } from "vitest";
import { gefahreneKmAusPunkten, gefahreneKmBerechnen, gefahreneKmGeschaetzt } from "@/core/rides/distanz";

describe("gefahreneKmAusPunkten", () => {
  it("ist 0 bei weniger als zwei Punkten", () => {
    expect(gefahreneKmAusPunkten([])).toBe(0);
    expect(gefahreneKmAusPunkten([{ lat: 50.77, lng: 6.08 }])).toBe(0);
  });

  it("summiert die Strecke zwischen aufeinanderfolgenden Punkten", () => {
    const punkte = [
      { lat: 50.77, lng: 6.08 },
      { lat: 50.78, lng: 6.09 },
      { lat: 50.8, lng: 6.1 },
    ];
    const einzelstrecke = gefahreneKmAusPunkten([punkte[0], punkte[1]]);
    const gesamtstrecke = gefahreneKmAusPunkten(punkte);
    expect(gesamtstrecke).toBeGreaterThan(einzelstrecke);
  });
});

describe("gefahreneKmGeschaetzt", () => {
  it("rechnet Luftlinie mal 1,4", () => {
    const von = { lat: 50.77, lng: 6.08 };
    const nach = { lat: 50.8, lng: 6.1 };
    expect(gefahreneKmGeschaetzt(von, nach)).toBeGreaterThan(0);
  });
});

describe("gefahreneKmBerechnen", () => {
  const von = { lat: 50.77, lng: 6.08 };
  const nach = { lat: 50.8, lng: 6.1 };

  it("nutzt GPS-Punkte, wenn mindestens zwei vorhanden sind", () => {
    const punkte = [von, nach];
    expect(gefahreneKmBerechnen(punkte, von, nach)).toBe(gefahreneKmAusPunkten(punkte));
  });

  it("schätzt per Luftlinie, wenn weniger als zwei Punkte vorhanden sind", () => {
    expect(gefahreneKmBerechnen([], von, nach)).toBe(gefahreneKmGeschaetzt(von, nach));
    expect(gefahreneKmBerechnen([von], von, nach)).toBe(gefahreneKmGeschaetzt(von, nach));
  });
});
