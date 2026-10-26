import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bestaetigungenPruefen } from "@/core/notify/eskalation";
import { prisma } from "@/lib/prisma";

describe("bestaetigungenPruefen", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({ data: { name: `Test-Eskalation ${kennung}` } });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.rideStatusEvent.deleteMany({ where: { tenantId } });
    await prisma.ride.deleteMany({ where: { tenantId } });
    await prisma.driver.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.vehicle.deleteMany({ where: { tenantId } });
    await prisma.place.deleteMany({ where: { tenantId } });
    await prisma.passenger.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  async function neueUnbestaetigteFahrt(dispoVorMinuten: number) {
    const user = await prisma.user.create({
      data: { id: randomUUID(), tenantId, email: `${randomUUID()}@test.de`, name: "Test Fahrer", role: "FAHRER", phone: "+491701234567" },
    });
    const driver = await prisma.driver.create({ data: { tenantId, userId: user.id } });
    const passenger = await prisma.passenger.create({
      data: { tenantId, firstName: "Test", lastName: "Fahrgast", phones: [] },
    });
    const ort = await prisma.place.create({
      data: { tenantId, label: "Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
    });
    const vehicle = await prisma.vehicle.create({ data: { tenantId, plate: `TEST-${randomUUID().slice(0, 4)}` } });
    const ride = await prisma.ride.create({
      data: {
        tenantId,
        passengerId: passenger.id,
        pickupPlaceId: ort.id,
        dropoffPlaceId: ort.id,
        pickupAt: new Date(Date.now() + 3 * 60 * 60_000),
        transportType: "SITZEND",
        status: "DISPONIERT",
        source: "MANUELL",
        vehicleId: vehicle.id,
        driverId: driver.id,
      },
    });
    await prisma.rideStatusEvent.create({
      data: { tenantId, rideId: ride.id, status: "DISPONIERT", at: new Date(Date.now() - dispoVorMinuten * 60_000) },
    });
    return ride.id;
  }

  it("schickt noch keine SMS, wenn die Fahrt erst seit Kurzem disponiert ist", async () => {
    await neueUnbestaetigteFahrt(1);
    const ergebnis = await bestaetigungenPruefen(tenantId);
    expect(ergebnis.smsAnFahrer).toBe(0);
  });

  it("schickt eine SMS an den Fahrer, wenn seit 2 Minuten keine Bestätigung da ist", async () => {
    const rideId = await neueUnbestaetigteFahrt(5);
    const ergebnis = await bestaetigungenPruefen(tenantId);
    expect(ergebnis.smsAnFahrer).toBeGreaterThanOrEqual(1);

    const notifications = await prisma.notification.findMany({ where: { rideId, kind: "KEINE_BESTAETIGUNG_FAHRER" } });
    expect(notifications).toHaveLength(1);
  });

  it("schickt beim nächsten Lauf keine zweite SMS für dieselbe Fahrt", async () => {
    const rideId = await neueUnbestaetigteFahrt(10);
    await bestaetigungenPruefen(tenantId);
    await bestaetigungenPruefen(tenantId);

    const notifications = await prisma.notification.findMany({ where: { rideId, kind: "KEINE_BESTAETIGUNG_FAHRER" } });
    expect(notifications).toHaveLength(1);
  });
});
