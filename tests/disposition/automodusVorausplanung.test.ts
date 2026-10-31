import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { automatischDisponieren } from "@/core/disposition/automatischDisponieren";
import { berlinerMitternacht, datumIso, tagVerschieben } from "@/core/shifts/week";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/**
 * Maßnahme M-17 (Prüfbericht S2-003) gegen Postgres: Nachts wurde je Fahrzeug fast nur die erste
 * Fahrt des Tages disponiert, weil jede weitere ein höchstens 10 Minuten altes GPS verlangte.
 */
describe("Automodus – Vorausplanung ohne GPS (M-17)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let vehicleId: string;
  let passengerId: string;
  let ortId: string;
  let driverId: string;

  async function vorgeschlageneFahrt(pickupAt: Date) {
    const ride = await prisma.ride.create({
      data: {
        tenantId, passengerId, pickupPlaceId: ortId, dropoffPlaceId: ortId, pickupAt,
        transportType: "SITZEND", status: "VORGESCHLAGEN", source: "MANUELL", prescription: "JA",
      },
    });
    await prisma.suggestion.create({
      data: {
        tenantId, rideId: ride.id, decision: "OFFEN",
        options: [{ vehicleId, plate: "PRUEF", etaMin: 10, onTime: true, score: 10, reason: "PRUEF" }],
      },
    });
    return ride.id;
  }

  beforeAll(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: {
          name: `PRUEF_Voraus ${kennung}`,
          settings: {
            create: {
              greeting: "x", voiceId: "x", escalationNumber: "+4900", openingHours: {},
              serviceAreaCenter: { lat: 50.77, lng: 6.08 },
              depotAddress: { street: "Hof 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08 },
              autoMode: "IMMER",
            },
          },
        },
      })
    ).id;
    vehicleId = (await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-V-${kennung}` } })).id;
    passengerId = (await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Voraus", phones: [] } })).id;
    ortId = (
      await prisma.place.create({
        data: { tenantId, label: "PRUEF Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
      })
    ).id;
    const user = await prisma.user.create({
      data: { id: randomUUID(), tenantId, email: `pruef-${randomUUID()}@test.invalid`, name: "PRUEF", role: "FAHRER" },
    });
    driverId = (await prisma.driver.create({ data: { tenantId, userId: user.id } })).id;
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  it("M-17: drei Fahrten für morgen auf ein Fahrzeug ohne GPS-Daten → alle drei automatisch disponiert", async () => {
    const morgen = berlinerMitternacht(tagVerschieben(datumIso(new Date()), 1));
    await prisma.shift.create({
      data: { tenantId, driverId, vehicleId, start: morgen, end: new Date(morgen.getTime() + 23 * 3600_000) },
    });
    const fahrten = [];
    for (const stunde of [8, 11, 14]) fahrten.push(await vorgeschlageneFahrt(new Date(morgen.getTime() + stunde * 3600_000)));

    await automatischDisponieren(tenantId);

    const status = await prisma.ride.findMany({ where: { id: { in: fahrten } }, select: { status: true, autoSkipReason: true } });
    expect(status.map((s) => s.status)).toEqual(["DISPONIERT", "DISPONIERT", "DISPONIERT"]);
  });

  it("M-17: Fahrt in 30 Minuten ohne GPS, Fahrzeug hatte heute schon eine Fahrt → weiterhin autoSkipReason", async () => {
    const jetzt = Date.now();
    await prisma.shift.create({
      data: { tenantId, driverId, vehicleId, start: new Date(jetzt - 3 * 3600_000), end: new Date(jetzt + 3 * 3600_000) },
    });
    // Frühere Fahrt heute auf demselben Fahrzeug (bereits disponiert) – kein Start vom Betriebshof.
    await prisma.ride.create({
      data: {
        tenantId, passengerId, pickupPlaceId: ortId, dropoffPlaceId: ortId, pickupAt: new Date(jetzt - 60 * 60_000),
        transportType: "SITZEND", status: "ERLEDIGT", source: "MANUELL", vehicleId,
      },
    });
    const bald = await vorgeschlageneFahrt(new Date(jetzt + 30 * 60_000));

    await automatischDisponieren(tenantId);

    const fahrt = await prisma.ride.findUniqueOrThrow({ where: { id: bald } });
    expect(fahrt.status).toBe("VORGESCHLAGEN");
    expect(fahrt.autoSkipReason).toMatch(/Standort/);
  });
});
