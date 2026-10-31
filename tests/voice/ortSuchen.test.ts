import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { werkzeugAusfuehren } from "@/core/voice/werkzeuge";
import { routingProvider } from "@/providers/routing";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/**
 * Maßnahme M-06 – Reproduktionen aus Prüfbericht Durchgang 1: "Hauptstraße 1" lieferte den
 * gespeicherten Ort "Hauptstraße 12" als sicher (S1-003), "Aachen" traf jeden Ort in Aachen,
 * und das Geocoding lief ohne Bezug zum Einsatzgebiet (S2-007).
 */
describe("ort_suchen (M-06)", () => {
  const kennung = randomUUID().slice(0, 8);
  const MITTE = { lat: 50.9036, lng: 6.1894 };
  let tenantId: string;
  let callId: string;
  let ortId: string;

  beforeAll(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: {
          name: `PRUEF_OrtSuchen ${kennung}`,
          settings: {
            create: { greeting: "x", voiceId: "x", escalationNumber: "+4900", openingHours: {}, serviceAreaCenter: MITTE },
          },
        },
      })
    ).id;
    callId = (await prisma.call.create({ data: { tenantId, providerCallId: `PRUEF_ort_${kennung}`, toNumber: "+490", startedAt: new Date() } })).id;
    ortId = (
      await prisma.place.create({
        data: { tenantId, label: "PRUEF Wohnung", street: "Hauptstraße 12", zip: "52499", city: "Baesweiler", lat: 50.9, lng: 6.18, type: "WOHNUNG" },
      })
    ).id;
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  async function ortSuchen(text: string, id = randomUUID()) {
    const ergebnis = await werkzeugAusfuehren(tenantId, callId, { id, name: "ort_suchen", arguments: { text } });
    return ergebnis.result ?? ergebnis.error ?? "";
  }

  it("S1-003: 'Hauptstraße 1' liefert 'Hauptstraße 12' nicht als sicher", async () => {
    const antwort = await ortSuchen("Hauptstraße 1");
    expect(antwort).not.toContain("sicher).");
    expect(antwort).not.toContain(ortId);
  });

  it("'Hauptstraße 12' ohne Ort ist nur ein unsicherer Vorschlag, mit Ort sicher", async () => {
    expect(await ortSuchen("Hauptstraße 12")).toMatch(/unsicher/);
    expect(await ortSuchen("Hauptstraße 12, 52499 Baesweiler")).toContain(`(placeId ${ortId}, sicher)`);
  });

  it("S1-003: 'Aachen' ist kein gespeicherter Ort – ohne Geocoding-Treffer gibt es keine Adresse", async () => {
    const spion = vi.spyOn(routingProvider, "geocode").mockResolvedValueOnce([]);
    try {
      expect(await ortSuchen("Aachen")).toMatch(/Keine Adresse gefunden/);
    } finally {
      spion.mockRestore();
    }
  });

  it("S2-007: Geocoding bekommt die Mitte des Einsatzgebiets als near-Parameter", async () => {
    const spion = vi.spyOn(routingProvider, "geocode").mockResolvedValueOnce([]);
    try {
      await ortSuchen("Kirchstraße 5");
      expect(spion).toHaveBeenCalledWith("Kirchstraße 5", MITTE);
    } finally {
      spion.mockRestore();
    }
  });
});
