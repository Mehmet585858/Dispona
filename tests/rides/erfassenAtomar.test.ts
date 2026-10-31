import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fahrtErfassen } from "@/core/rides/erfassen";
import { routingProvider } from "@/providers/routing";
import { datumIso, tagVerschieben } from "@/core/shifts/week";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/**
 * Maßnahme M-23 Punkt 3 (Prüfbericht S4-009): fahrtErfassen schrieb Hinfahrt, Status, Vorschlag und
 * Rückfahrt einzeln. Scheiterte ein späterer Schritt (z. B. die Vorschlagsrechnung am Routing),
 * blieb eine Hinfahrt ohne Rückfahrt (oder eine halbe Fahrt als ENTWURF) stehen, und der Aufrufer
 * (die KI) bekam einen Fehler – und legte im Zweifel noch einmal an.
 */
describe("fahrtErfassen atomar (M-23)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let passengerId: string;
  let ortA: string;
  let ortB: string;

  beforeAll(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: {
          name: `PRUEF_ErfassenAtomar ${kennung}`,
          settings: {
            create: {
              greeting: "x", voiceId: "x", escalationNumber: "+4900", openingHours: {},
              serviceAreaCenter: { lat: 50.77, lng: 6.08 },
              depotAddress: { street: "Hof 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08 },
            },
          },
        },
      })
    ).id;
    passengerId = (await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Atomar", phones: [] } })).id;
    const ort = (lat: number) =>
      prisma.place.create({
        data: { tenantId, label: "PRUEF Ort", street: "A 1", zip: "52062", city: "Aachen", lat, lng: 6.08, type: "SONSTIGES" },
      });
    ortA = (await ort(50.77)).id;
    ortB = (await ort(50.78)).id;
    const v = await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-A-${kennung}` } });
    void v;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  it("M-23 (S4-009): scheitert die Vorschlagsrechnung, sind Hin- und Rückfahrt trotzdem vollständig angelegt (ERFASST, kein ENTWURF)", async () => {
    vi.spyOn(routingProvider, "travelTimeMinutes").mockRejectedValue(new Error("PRUEF Routing weg"));
    vi.spyOn(routingProvider, "matrix").mockRejectedValue(new Error("PRUEF Routing weg"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = await prisma.user.create({
      data: { id: randomUUID(), tenantId, email: `pruef-${randomUUID()}@test.invalid`, name: "PRUEF", role: "FAHRER" },
    });
    const driver = await prisma.driver.create({ data: { tenantId, userId: user.id } });
    const fahrzeug = await prisma.vehicle.findFirstOrThrow({ where: { tenantId } });
    const morgen = tagVerschieben(datumIso(new Date()), 1);
    const { berlinerMitternacht } = await import("@/core/shifts/week");
    const tagStart = berlinerMitternacht(morgen);
    await prisma.shift.create({
      data: { tenantId, driverId: driver.id, vehicleId: fahrzeug.id, start: tagStart, end: new Date(tagStart.getTime() + 23 * 3600_000) },
    });

    const ergebnis = await fahrtErfassen(
      tenantId,
      {
        passengerId, pickupPlaceId: ortA, dropoffPlaceId: ortB, datum: morgen, abholzeit: "08:00", terminzeit: "",
        rueckfahrt: true, rueckfahrtzeit: "12:00", transportType: "SITZEND", companion: false, assistanceNotes: "",
        prescription: "JA", approval: "NICHT_NOETIG",
      },
      { source: "MANUELL" },
    );
    expect(ergebnis.rueckfahrtRideId).toBeTruthy();
    const fahrten = await prisma.ride.findMany({ where: { tenantId, passengerId } });
    expect(fahrten).toHaveLength(2);
    expect(fahrten.every((f) => f.status === "ERFASST")).toBe(true);
  });

  it("M-23: eine fremde Referenz in der Rückfahrt-Anlage lässt auch keine Hinfahrt zurück", async () => {
    const fremd = await prisma.tenant.create({ data: { name: `PRUEF_ErfassenFremd ${kennung}` } });
    const fremderOrt = await prisma.place.create({
      data: { tenantId: fremd.id, label: "PRUEF Fremd", street: "B 1", zip: "52062", city: "Aachen", lat: 50.7, lng: 6.0, type: "SONSTIGES" },
    });
    try {
      const vorher = await prisma.ride.count({ where: { tenantId } });
      await expect(
        fahrtErfassen(
          tenantId,
          {
            passengerId, pickupPlaceId: ortA, dropoffPlaceId: fremderOrt.id, datum: tagVerschieben(datumIso(new Date()), 2), abholzeit: "08:00",
            terminzeit: "", rueckfahrt: true, rueckfahrtzeit: "12:00", transportType: "SITZEND", companion: false, assistanceNotes: "",
            prescription: "JA", approval: "NICHT_NOETIG",
          },
          { source: "MANUELL" },
        ),
      ).rejects.toThrow();
      expect(await prisma.ride.count({ where: { tenantId } })).toBe(vorher);
    } finally {
      await mandantKomplettLoeschen(fremd.id);
    }
  });
});
