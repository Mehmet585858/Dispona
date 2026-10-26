import { describe, expect, it } from "vitest";
import { createOpenRouteService } from "@/providers/routing/openRouteService";
import { luftlinieMinuten } from "@/providers/routing/luftlinie";

const AACHEN = { lat: 50.7753, lng: 6.0839 };
const BAESWEILER = { lat: 50.9036, lng: 6.1894 };

describe("luftlinieMinuten", () => {
  it("liefert 0 für identische Punkte", () => {
    expect(luftlinieMinuten(AACHEN, AACHEN)).toBe(0);
  });

  it("liefert eine plausible Schätzung für eine reale Strecke", () => {
    const minuten = luftlinieMinuten(AACHEN, BAESWEILER);
    expect(minuten).toBeGreaterThan(10);
    expect(minuten).toBeLessThan(60);
  });
});

describe("createOpenRouteService – ohne Schlüssel (Notlösung)", () => {
  const provider = createOpenRouteService(undefined);

  it("liefert für geocode() eine leere Liste statt eines Fehlers", async () => {
    await expect(provider.geocode("Irgendeine Adresse")).resolves.toEqual([]);
  });

  it("matrix() weicht auf die Luftlinien-Schätzung aus", async () => {
    const ergebnis = await provider.matrix([AACHEN], [BAESWEILER], new Date());
    expect(ergebnis).toHaveLength(1);
    expect(ergebnis[0][0]).toBeCloseTo(luftlinieMinuten(AACHEN, BAESWEILER));
  });

  it("travelTimeMinutes() funktioniert ebenfalls über die Notlösung", async () => {
    const minuten = await provider.travelTimeMinutes(AACHEN, BAESWEILER, new Date());
    expect(minuten).toBeGreaterThan(0);
  });
});
