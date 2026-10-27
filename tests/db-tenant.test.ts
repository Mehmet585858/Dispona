import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant } from "@/lib/db";
import { prisma } from "@/lib/prisma";

describe("withTenant – Mandantentrennung", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantA: { id: string };
  let tenantB: { id: string };
  let placeA: { id: string };
  let placeB: { id: string };
  let passengerA: { id: string };
  let passengerB: { id: string };
  let vehicleA: { id: string };
  let vehicleB: { id: string };
  let userA: { id: string };
  let userB: { id: string };
  let driverA: { id: string };
  let driverB: { id: string };
  let rideA: { id: string };
  let rideB: { id: string };
  let callA: { id: string };
  let callB: { id: string };

  beforeAll(async () => {
    tenantA = await prisma.tenant.create({ data: { name: `Test-Mandant A ${kennung}` } });
    tenantB = await prisma.tenant.create({ data: { name: `Test-Mandant B ${kennung}` } });
    placeA = await prisma.place.create({
      data: {
        tenantId: tenantA.id,
        label: "Ort A",
        street: "Teststraße 1",
        zip: "52062",
        city: "Aachen",
        lat: 50.77,
        lng: 6.08,
        type: "SONSTIGES",
      },
    });
    placeB = await prisma.place.create({
      data: {
        tenantId: tenantB.id,
        label: "Ort B",
        street: "Teststraße 2",
        zip: "52062",
        city: "Aachen",
        lat: 50.78,
        lng: 6.09,
        type: "SONSTIGES",
      },
    });

    passengerA = await prisma.passenger.create({
      data: { tenantId: tenantA.id, firstName: "A", lastName: "Fahrgast", phones: [] },
    });
    passengerB = await prisma.passenger.create({
      data: { tenantId: tenantB.id, firstName: "B", lastName: "Fahrgast", phones: [] },
    });

    vehicleA = await prisma.vehicle.create({ data: { tenantId: tenantA.id, plate: `A-${kennung}` } });
    vehicleB = await prisma.vehicle.create({ data: { tenantId: tenantB.id, plate: `B-${kennung}` } });

    userA = await prisma.user.create({
      data: { id: randomUUID(), tenantId: tenantA.id, email: `${randomUUID()}@test.de`, name: "Fahrer A", role: "FAHRER" },
    });
    userB = await prisma.user.create({
      data: { id: randomUUID(), tenantId: tenantB.id, email: `${randomUUID()}@test.de`, name: "Fahrer B", role: "FAHRER" },
    });
    driverA = await prisma.driver.create({ data: { tenantId: tenantA.id, userId: userA.id } });
    driverB = await prisma.driver.create({ data: { tenantId: tenantB.id, userId: userB.id } });

    rideA = await prisma.ride.create({
      data: {
        tenantId: tenantA.id,
        passengerId: passengerA.id,
        pickupPlaceId: placeA.id,
        dropoffPlaceId: placeA.id,
        pickupAt: new Date(),
        transportType: "SITZEND",
        status: "ERFASST",
        source: "MANUELL",
      },
    });
    rideB = await prisma.ride.create({
      data: {
        tenantId: tenantB.id,
        passengerId: passengerB.id,
        pickupPlaceId: placeB.id,
        dropoffPlaceId: placeB.id,
        pickupAt: new Date(),
        transportType: "SITZEND",
        status: "ERFASST",
        source: "MANUELL",
      },
    });

    callA = await prisma.call.create({
      data: { tenantId: tenantA.id, providerCallId: `call-a-${kennung}`, toNumber: "+4924010000001", startedAt: new Date() },
    });
    callB = await prisma.call.create({
      data: { tenantId: tenantB.id, providerCallId: `call-b-${kennung}`, toNumber: "+4924010000002", startedAt: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.ride.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.call.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.driver.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.vehicle.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.passenger.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.place.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
  });

  it("A sieht nie die Daten von B – über mehrere Modelle hinweg (Passenger, Vehicle, Driver, Ride, Call)", async () => {
    const dbA = withTenant(tenantA.id);

    expect((await dbA.passenger.findMany()).map((p) => p.id)).not.toContain(passengerB.id);
    expect(await dbA.passenger.findUnique({ where: { id: passengerB.id } })).toBeNull();

    expect((await dbA.vehicle.findMany()).map((v) => v.id)).not.toContain(vehicleB.id);
    expect(await dbA.vehicle.findUnique({ where: { id: vehicleB.id } })).toBeNull();

    expect((await dbA.driver.findMany()).map((d) => d.id)).not.toContain(driverB.id);
    expect(await dbA.driver.findUnique({ where: { id: driverB.id } })).toBeNull();

    expect((await dbA.ride.findMany()).map((r) => r.id)).not.toContain(rideB.id);
    expect(await dbA.ride.findUnique({ where: { id: rideB.id } })).toBeNull();

    expect((await dbA.call.findMany()).map((c) => c.id)).not.toContain(callB.id);
    expect(await dbA.call.findUnique({ where: { id: callB.id } })).toBeNull();

    // und umgekehrt: A bleibt für sich selbst sichtbar
    expect(await dbA.passenger.findUnique({ where: { id: passengerA.id } })).not.toBeNull();
    expect(await dbA.vehicle.findUnique({ where: { id: vehicleA.id } })).not.toBeNull();
    expect(await dbA.driver.findUnique({ where: { id: driverA.id } })).not.toBeNull();
    expect(await dbA.ride.findUnique({ where: { id: rideA.id } })).not.toBeNull();
    expect(await dbA.call.findUnique({ where: { id: callA.id } })).not.toBeNull();
  });

  it("A kann Bs Daten weder ändern noch löschen, über mehrere Modelle hinweg", async () => {
    const dbA = withTenant(tenantA.id);
    await expect(dbA.passenger.update({ where: { id: passengerB.id }, data: { firstName: "Übernommen" } })).rejects.toThrow();
    await expect(dbA.ride.update({ where: { id: rideB.id }, data: { status: "STORNIERT" } })).rejects.toThrow();
    await expect(dbA.vehicle.delete({ where: { id: vehicleB.id } })).rejects.toThrow();
  });

  it("findMany zeigt Mandant A nie die Orte von Mandant B", async () => {
    const orte = await withTenant(tenantA.id).place.findMany();
    expect(orte.map((o) => o.id)).toContain(placeA.id);
    expect(orte.map((o) => o.id)).not.toContain(placeB.id);
  });

  it("findUnique liefert null, wenn die Zeile einem anderen Mandanten gehört", async () => {
    const fremderOrt = await withTenant(tenantA.id).place.findUnique({ where: { id: placeB.id } });
    expect(fremderOrt).toBeNull();

    const eigenerOrt = await withTenant(tenantA.id).place.findUnique({ where: { id: placeA.id } });
    expect(eigenerOrt?.id).toBe(placeA.id);
  });

  it("create() setzt die tenantId automatisch", async () => {
    const neuerOrt = await withTenant(tenantA.id).place.create({
      data: {
        label: "Neuer Ort",
        street: "Teststraße 3",
        zip: "52062",
        city: "Aachen",
        lat: 50.79,
        lng: 6.1,
        type: "SONSTIGES",
      } as never,
    });
    expect(neuerOrt.tenantId).toBe(tenantA.id);
  });

  it("update() über die Mandantengrenze schlägt fehl", async () => {
    await expect(
      withTenant(tenantA.id).place.update({
        where: { id: placeB.id },
        data: { label: "Übernommen" },
      }),
    ).rejects.toThrow();
  });
});
