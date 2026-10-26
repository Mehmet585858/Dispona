import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fahrtStatusAendern, istUebergangErlaubt } from "@/core/rides/status";
import { prisma } from "@/lib/prisma";

describe("istUebergangErlaubt", () => {
  it("erlaubt den normalen Ablauf ENTWURF -> ERFASST -> ... -> ERLEDIGT", () => {
    expect(istUebergangErlaubt("ENTWURF", "ERFASST")).toBe(true);
    expect(istUebergangErlaubt("ERFASST", "VORGESCHLAGEN")).toBe(true);
    expect(istUebergangErlaubt("VORGESCHLAGEN", "DISPONIERT")).toBe(true);
    expect(istUebergangErlaubt("DISPONIERT", "UNTERWEGS")).toBe(true);
    expect(istUebergangErlaubt("UNTERWEGS", "AN_BORD")).toBe(true);
    expect(istUebergangErlaubt("AN_BORD", "ERLEDIGT")).toBe(true);
  });

  it("erlaubt PROBLEM und STORNIERT jederzeit außer aus Endzuständen", () => {
    expect(istUebergangErlaubt("ERFASST", "PROBLEM")).toBe(true);
    expect(istUebergangErlaubt("UNTERWEGS", "PROBLEM")).toBe(true);
    expect(istUebergangErlaubt("ERLEDIGT", "PROBLEM")).toBe(false);
    expect(istUebergangErlaubt("ERLEDIGT", "STORNIERT")).toBe(false);
  });

  it("erlaubt NICHT_ANGETROFFEN nur nach UNTERWEGS", () => {
    expect(istUebergangErlaubt("UNTERWEGS", "NICHT_ANGETROFFEN")).toBe(true);
    expect(istUebergangErlaubt("DISPONIERT", "NICHT_ANGETROFFEN")).toBe(false);
  });

  it("lehnt einen Übergang auf sich selbst ab", () => {
    expect(istUebergangErlaubt("ERFASST", "ERFASST")).toBe(false);
  });
});

describe("fahrtStatusAendern", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let rideId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({ data: { name: `Test-Status ${kennung}` } });
    tenantId = tenant.id;
    const passenger = await prisma.passenger.create({
      data: { tenantId, firstName: "Test", lastName: "Fahrgast", phones: [] },
    });
    const abholort = await prisma.place.create({
      data: {
        tenantId,
        label: "Abholort",
        street: "Teststraße 1",
        zip: "52062",
        city: "Aachen",
        lat: 50.77,
        lng: 6.08,
        type: "SONSTIGES",
      },
    });
    const ride = await prisma.ride.create({
      data: {
        tenantId,
        passengerId: passenger.id,
        pickupPlaceId: abholort.id,
        dropoffPlaceId: abholort.id,
        pickupAt: new Date(),
        transportType: "SITZEND",
        status: "ENTWURF",
        source: "MANUELL",
      },
    });
    rideId = ride.id;
  });

  afterAll(async () => {
    await prisma.rideStatusEvent.deleteMany({ where: { tenantId } });
    await prisma.ride.deleteMany({ where: { tenantId } });
    await prisma.place.deleteMany({ where: { tenantId } });
    await prisma.passenger.deleteMany({ where: { tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  it("ändert den Status, erzeugt RideStatusEvent und AuditLog", async () => {
    const aktualisiert = await fahrtStatusAendern(tenantId, rideId, "ERFASST");
    expect(aktualisiert.status).toBe("ERFASST");

    const ereignisse = await prisma.rideStatusEvent.findMany({ where: { rideId } });
    expect(ereignisse).toHaveLength(1);
    expect(ereignisse[0].status).toBe("ERFASST");

    const audit = await prisma.auditLog.findMany({ where: { tenantId, entityId: rideId } });
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("ride.status_change");
  });

  it("lehnt einen nicht erlaubten Übergang ab", async () => {
    await expect(fahrtStatusAendern(tenantId, rideId, "ERLEDIGT")).rejects.toThrow();
  });

  it("setzt completedAt, wenn die Fahrt erledigt wird", async () => {
    await fahrtStatusAendern(tenantId, rideId, "DISPONIERT");
    await fahrtStatusAendern(tenantId, rideId, "UNTERWEGS");
    await fahrtStatusAendern(tenantId, rideId, "AN_BORD");
    const erledigt = await fahrtStatusAendern(tenantId, rideId, "ERLEDIGT");
    expect(erledigt.completedAt).not.toBeNull();
  });
});
