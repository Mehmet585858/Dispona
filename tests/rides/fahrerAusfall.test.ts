import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fahrerFaelltAusKern } from "@/core/rides/fahrerAusfall";
import { prisma } from "@/lib/prisma";

describe("fahrerFaelltAusKern", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let driverId: string;
  let ortId: string;
  let passengerId: string;
  let vehicleId: string;

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const uebermorgen = new Date(heute);
  uebermorgen.setDate(uebermorgen.getDate() + 2);

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Test-FahrerAusfall ${kennung}`,
        settings: {
          create: {
            greeting: "Test",
            voiceId: "test",
            escalationNumber: "+4924019999999",
            openingHours: {},
            serviceAreaCenter: { lat: 50.77, lng: 6.08 },
            depotAddress: { street: "Betriebshof 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08 },
          },
        },
      },
    });
    tenantId = tenant.id;

    const user = await prisma.user.create({
      data: { id: randomUUID(), tenantId, email: `${randomUUID()}@test.de`, name: "Test Fahrer", role: "FAHRER" },
    });
    const driver = await prisma.driver.create({ data: { tenantId, userId: user.id } });
    driverId = driver.id;

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

    await prisma.shift.create({
      data: { tenantId, driverId, vehicleId, start: heute, end: uebermorgen },
    });
  });

  afterAll(async () => {
    await prisma.rideStatusEvent.deleteMany({ where: { tenantId } });
    await prisma.suggestion.deleteMany({ where: { tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.ride.deleteMany({ where: { tenantId } });
    await prisma.shift.deleteMany({ where: { tenantId } });
    await prisma.driver.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.vehicle.deleteMany({ where: { tenantId } });
    await prisma.place.deleteMany({ where: { tenantId } });
    await prisma.passenger.deleteMany({ where: { tenantId } });
    await prisma.tenantSettings.delete({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  async function neueFahrt(status: "DISPONIERT" | "UNTERWEGS" | "AN_BORD") {
    const pickupAt = new Date(heute.getTime() + 10 * 60 * 60_000);
    return prisma.ride.create({
      data: {
        tenantId,
        passengerId,
        pickupPlaceId: ortId,
        dropoffPlaceId: ortId,
        pickupAt,
        transportType: "SITZEND",
        status,
        source: "MANUELL",
        driverId,
        vehicleId,
      },
    });
  }

  it("markiert die Schicht als ausgefallen", async () => {
    await fahrerFaelltAusKern(tenantId, driverId, heute, uebermorgen);
    const schichten = await prisma.shift.findMany({ where: { driverId } });
    expect(schichten.every((s) => s.unavailable)).toBe(true);
  });

  it("versucht, eine DISPONIERT-Fahrt neu vorzuschlagen (nicht mehr DISPONIERT)", async () => {
    const fahrt = await neueFahrt("DISPONIERT");
    const ergebnis = await fahrerFaelltAusKern(tenantId, driverId, heute, uebermorgen);
    expect(ergebnis.neuVorgeschlagen).toBeGreaterThanOrEqual(1);

    const aktualisiert = await prisma.ride.findUniqueOrThrow({ where: { id: fahrt.id } });
    expect(aktualisiert.status).not.toBe("DISPONIERT");
    expect(aktualisiert.problems).toContain("Fahrer fällt aus");
  });

  it("lässt eine UNTERWEGS-Fahrt als Problem stehen, ohne sie neu vorzuschlagen", async () => {
    const fahrt = await neueFahrt("UNTERWEGS");
    await fahrerFaelltAusKern(tenantId, driverId, heute, uebermorgen);

    const aktualisiert = await prisma.ride.findUniqueOrThrow({ where: { id: fahrt.id } });
    expect(aktualisiert.status).toBe("PROBLEM");
    expect(aktualisiert.problems).toContain("Fahrer fällt aus");
  });
});
