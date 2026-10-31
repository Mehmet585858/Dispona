import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fahrzeugZuweisen, FahrzeugKonfliktError } from "@/core/disposition/zuweisen";
import { prisma } from "@/lib/prisma";

/**
 * Prüfbericht S1-004: zwei gleichzeitige Zuweisungen desselben Fahrzeugs auf zwei zeitlich
 * überlappende Fahrten dürfen nicht beide durchgehen. Läuft gegen echtes Postgres – genau das
 * Szenario "Cron automodus und Disponent-Klick zur selben Sekunde".
 */
describe("fahrzeugZuweisen – parallele Zuweisungen (S1-004)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let vehicleId: string;
  let ortA: { id: string };
  let ortB: { id: string };
  let passengerId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({ data: { name: `PRUEF_Zuweisung ${kennung}` } });
    tenantId = tenant.id;
    const vehicle = await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-${kennung}` } });
    vehicleId = vehicle.id;
    ortA = await prisma.place.create({
      data: { tenantId, label: "Ort A", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
    });
    ortB = await prisma.place.create({
      data: { tenantId, label: "Ort B", street: "B 1", zip: "52062", city: "Aachen", lat: 50.8, lng: 6.1, type: "SONSTIGES" },
    });
    const passenger = await prisma.passenger.create({
      data: { tenantId, firstName: "PRUEF", lastName: "Fahrgast", phones: [] },
    });
    passengerId = passenger.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.suggestion.deleteMany({ where: { tenantId } });
    await prisma.rideStatusEvent.deleteMany({ where: { tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.ride.deleteMany({ where: { tenantId } });
    await prisma.vehicle.deleteMany({ where: { tenantId } });
    await prisma.place.deleteMany({ where: { tenantId } });
    await prisma.passenger.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  async function fahrt(abholung: Date) {
    return prisma.ride.create({
      data: {
        tenantId,
        passengerId,
        pickupPlaceId: ortA.id,
        dropoffPlaceId: ortB.id,
        pickupAt: abholung,
        transportType: "SITZEND",
        status: "ERFASST",
        source: "MANUELL",
      },
    });
  }

  it("S1-004: von zwei gleichzeitigen Zuweisungen auf dasselbe Fahrzeug geht genau eine durch", async () => {
    const basis = new Date(Date.now() + 6 * 60 * 60_000);
    const a = await fahrt(basis);
    const b = await fahrt(new Date(basis.getTime() + 5 * 60_000));

    const ergebnis = await Promise.allSettled([
      fahrzeugZuweisen(tenantId, a.id, vehicleId, { dispatchMode: "AUTO" }),
      fahrzeugZuweisen(tenantId, b.id, vehicleId, { dispatchMode: "MANUELL" }),
    ]);
    const zustaende = ergebnis.map((e) => e.status);
    expect(zustaende.filter((z) => z === "fulfilled")).toHaveLength(1);
    const abgelehnt = ergebnis.find((e): e is PromiseRejectedResult => e.status === "rejected");
    expect(abgelehnt?.reason).toBeInstanceOf(FahrzeugKonfliktError);

    const fahrten = await prisma.ride.findMany({ where: { id: { in: [a.id, b.id] } }, select: { vehicleId: true, status: true } });
    expect(fahrten.filter((f) => f.vehicleId === vehicleId)).toHaveLength(1);
    expect(fahrten.filter((f) => f.status === "DISPONIERT")).toHaveLength(1);
  });

  it("nacheinander wird die zweite Zuweisung weiterhin sauber abgelehnt", async () => {
    const basis = new Date(Date.now() + 10 * 60 * 60_000);
    const a = await fahrt(basis);
    const b = await fahrt(new Date(basis.getTime() + 5 * 60_000));
    await fahrzeugZuweisen(tenantId, a.id, vehicleId, { dispatchMode: "MANUELL" });
    await expect(fahrzeugZuweisen(tenantId, b.id, vehicleId, { dispatchMode: "MANUELL" })).rejects.toBeInstanceOf(
      FahrzeugKonfliktError,
    );
  });
});
