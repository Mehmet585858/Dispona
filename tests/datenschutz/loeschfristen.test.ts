import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loeschfristenDurchsetzen } from "@/core/datenschutz/loeschfristen";
import { prisma } from "@/lib/prisma";

function vorTagen(tage: number): Date {
  const datum = new Date();
  datum.setDate(datum.getDate() - tage);
  return datum;
}

describe("loeschfristenDurchsetzen", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let ortId: string;
  let passengerId: string;
  let vehicleId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Test-Loeschfristen ${kennung}`,
        settings: {
          create: {
            greeting: "Test",
            voiceId: "test",
            escalationNumber: "+4924019999999",
            openingHours: {},
            serviceAreaCenter: { lat: 50.77, lng: 6.08 },
            audioRetentionDays: 30,
            dataRetentionDays: 365,
          },
        },
      },
    });
    tenantId = tenant.id;
    const ort = await prisma.place.create({
      data: { tenantId, label: "Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
    });
    ortId = ort.id;
    const passenger = await prisma.passenger.create({
      data: { tenantId, firstName: "Test", lastName: "Fahrgast", phones: [] },
    });
    passengerId = passenger.id;
    const vehicle = await prisma.vehicle.create({ data: { tenantId, plate: `TEST-${randomUUID().slice(0, 4)}` } });
    vehicleId = vehicle.id;
  });

  afterAll(async () => {
    await prisma.rideStatusEvent.deleteMany({ where: { tenantId } });
    await prisma.suggestion.deleteMany({ where: { tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.ride.deleteMany({ where: { tenantId } });
    await prisma.call.deleteMany({ where: { tenantId } });
    await prisma.vehicleLocation.deleteMany({ where: { tenantId } });
    await prisma.vehicle.deleteMany({ where: { tenantId } });
    await prisma.place.deleteMany({ where: { tenantId } });
    await prisma.passenger.deleteMany({ where: { tenantId } });
    await prisma.tenantSettings.delete({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  it("löscht Audio nach audioRetentionDays, lässt neueres Audio stehen", async () => {
    const altesCall = await prisma.call.create({
      data: {
        tenantId,
        providerCallId: `call-alt-${kennung}`,
        toNumber: "+4924010000000",
        startedAt: vorTagen(40),
        audioUrl: "https://example.com/alt.mp3",
      },
    });
    const neuesCall = await prisma.call.create({
      data: {
        tenantId,
        providerCallId: `call-neu-${kennung}`,
        toNumber: "+4924010000000",
        startedAt: vorTagen(1),
        audioUrl: "https://example.com/neu.mp3",
      },
    });

    const ergebnis = await loeschfristenDurchsetzen(tenantId);
    expect(ergebnis.audioGeloescht).toBe(1);

    expect((await prisma.call.findUniqueOrThrow({ where: { id: altesCall.id } })).audioUrl).toBeNull();
    expect((await prisma.call.findUniqueOrThrow({ where: { id: neuesCall.id } })).audioUrl).toBe(
      "https://example.com/neu.mp3",
    );
  });

  it("löscht Fahrten und Transkripte nach dataRetentionDays, lässt neuere stehen", async () => {
    const alteFahrt = await prisma.ride.create({
      data: {
        tenantId,
        passengerId,
        pickupPlaceId: ortId,
        dropoffPlaceId: ortId,
        pickupAt: vorTagen(400),
        transportType: "SITZEND",
        status: "ERLEDIGT",
        source: "MANUELL",
      },
    });
    const neueFahrt = await prisma.ride.create({
      data: {
        tenantId,
        passengerId,
        pickupPlaceId: ortId,
        dropoffPlaceId: ortId,
        pickupAt: vorTagen(1),
        transportType: "SITZEND",
        status: "ERLEDIGT",
        source: "MANUELL",
      },
    });

    const ergebnis = await loeschfristenDurchsetzen(tenantId);
    expect(ergebnis.fahrtenGeloescht).toBeGreaterThanOrEqual(1);

    expect(await prisma.ride.findUnique({ where: { id: alteFahrt.id } })).toBeNull();
    expect(await prisma.ride.findUnique({ where: { id: neueFahrt.id } })).not.toBeNull();
  });

  it("löscht GPS-Punkte älter als 90 Tage, lässt neuere stehen", async () => {
    const alterPunkt = await prisma.vehicleLocation.create({
      data: { tenantId, vehicleId, lat: 50.77, lng: 6.08, at: vorTagen(100) },
    });
    const neuerPunkt = await prisma.vehicleLocation.create({
      data: { tenantId, vehicleId, lat: 50.77, lng: 6.08, at: vorTagen(1) },
    });

    const ergebnis = await loeschfristenDurchsetzen(tenantId);
    expect(ergebnis.gpsGeloescht).toBeGreaterThanOrEqual(1);

    expect(await prisma.vehicleLocation.findUnique({ where: { id: alterPunkt.id } })).toBeNull();
    expect(await prisma.vehicleLocation.findUnique({ where: { id: neuerPunkt.id } })).not.toBeNull();
  });
});
