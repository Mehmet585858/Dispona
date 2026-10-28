import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoZuruecksetzen } from "@/core/demo/aufraeumen";
import { prisma } from "@/lib/prisma";

function vorStunden(stunden: number): Date {
  return new Date(Date.now() - stunden * 60 * 60_000);
}

describe("demoZuruecksetzen", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let ortId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Test-Demo-Aufraeumen ${kennung}`,
        settings: {
          create: {
            greeting: "Test",
            voiceId: "test",
            escalationNumber: "",
            openingHours: {},
            serviceAreaCenter: { lat: 50.77, lng: 6.08 },
          },
        },
      },
    });
    tenantId = tenant.id;
    const ort = await prisma.place.create({
      data: { tenantId, label: "Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
    });
    ortId = ort.id;
  });

  afterAll(async () => {
    await prisma.rideStatusEvent.deleteMany({ where: { tenantId } });
    await prisma.suggestion.deleteMany({ where: { tenantId } });
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.ride.deleteMany({ where: { tenantId } });
    await prisma.call.deleteMany({ where: { tenantId } });
    await prisma.place.deleteMany({ where: { tenantId } });
    await prisma.passenger.deleteMany({ where: { tenantId } });
    await prisma.tenantSettings.delete({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  it("löscht alte Fahrt, Fahrgast und Anruf, lässt neuere stehen", async () => {
    const alterFahrgast = await prisma.passenger.create({
      data: { tenantId, firstName: "Alt", lastName: `Interessent-${kennung}`, phones: ["+491700000001"] },
    });
    const neuerFahrgast = await prisma.passenger.create({
      data: { tenantId, firstName: "Neu", lastName: `Interessent-${kennung}`, phones: ["+491700000002"] },
    });
    const alterAnruf = await prisma.call.create({
      data: { tenantId, providerCallId: `call-alt-${kennung}`, toNumber: "+4924010000000", startedAt: vorStunden(10) },
    });
    const neuerAnruf = await prisma.call.create({
      data: { tenantId, providerCallId: `call-neu-${kennung}`, toNumber: "+4924010000000", startedAt: vorStunden(1) },
    });
    const alteFahrt = await prisma.ride.create({
      data: {
        tenantId,
        passengerId: alterFahrgast.id,
        pickupPlaceId: ortId,
        dropoffPlaceId: ortId,
        pickupAt: vorStunden(10),
        transportType: "SITZEND",
        status: "ERFASST",
        source: "ANRUF",
        callId: alterAnruf.id,
        createdAt: vorStunden(10),
      },
    });
    const neueFahrt = await prisma.ride.create({
      data: {
        tenantId,
        passengerId: neuerFahrgast.id,
        pickupPlaceId: ortId,
        dropoffPlaceId: ortId,
        pickupAt: vorStunden(1),
        transportType: "SITZEND",
        status: "ERFASST",
        source: "ANRUF",
        callId: neuerAnruf.id,
        createdAt: vorStunden(1),
      },
    });

    const ergebnis = await demoZuruecksetzen(tenantId);
    expect(ergebnis.fahrtenGeloescht).toBe(1);
    expect(ergebnis.fahrgaesteGeloescht).toBe(1);
    expect(ergebnis.anrufeGeloescht).toBe(1);

    expect(await prisma.ride.findUnique({ where: { id: alteFahrt.id } })).toBeNull();
    expect(await prisma.passenger.findUnique({ where: { id: alterFahrgast.id } })).toBeNull();
    expect(await prisma.call.findUnique({ where: { id: alterAnruf.id } })).toBeNull();

    expect(await prisma.ride.findUnique({ where: { id: neueFahrt.id } })).not.toBeNull();
    expect(await prisma.passenger.findUnique({ where: { id: neuerFahrgast.id } })).not.toBeNull();
    expect(await prisma.call.findUnique({ where: { id: neuerAnruf.id } })).not.toBeNull();
  });
});
