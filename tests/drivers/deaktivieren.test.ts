import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fahrerDeaktivieren } from "@/core/drivers/deaktivieren";
import { vorschlaegeBerechnen } from "@/core/disposition/vorschlagen";
import { anmeldeLinkZustellen } from "@/lib/anmeldeLink";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/**
 * Maßnahme M-12 (docs/13 R3-4): Es gab kein Offboarding. Nach dem Deaktivieren sind Sitzungen
 * und Push-Abos weg, die Schicht ist beendet/ausgefallen, offene Fahrten werden neu geplant, der
 * Fahrer taucht in keinem Vorschlag mehr auf und bekommt keinen Anmelde-Link mehr.
 */
describe("fahrerDeaktivieren (M-12)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let userId: string;
  let driverId: string;
  let vehicleId: string;
  let rideId: string;
  const email = `fahrer-49170${kennung.replace(/\D/g, "")}1@fahrer.intern`;

  beforeAll(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: {
          name: `PRUEF_Deaktivieren ${kennung}`,
          settings: {
            create: {
              greeting: "x", voiceId: "x", escalationNumber: "+4900", openingHours: {}, serviceAreaCenter: { lat: 50.77, lng: 6.08 },
              depotAddress: { street: "Hof 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08 },
            },
          },
        },
      })
    ).id;
    userId = randomUUID();
    await prisma.user.create({ data: { id: userId, tenantId, email, name: "PRUEF Gekündigt", role: "FAHRER", phone: "+491700000001" } });
    driverId = (await prisma.driver.create({ data: { tenantId, userId } })).id;
    vehicleId = (await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-D-${kennung}` } })).id;
    await prisma.session.create({
      data: { id: randomUUID(), userId, token: randomUUID(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000) },
    });
    await prisma.pushSubscription.create({
      data: { tenantId, driverId, endpoint: `https://push.example/PRUEF_${kennung}`, keys: { p256dh: "x", auth: "y" } },
    });
    const jetzt = Date.now();
    await prisma.shift.create({
      data: { tenantId, driverId, vehicleId, start: new Date(jetzt - 60 * 60_000), end: new Date(jetzt + 6 * 60 * 60_000), startedAt: new Date(jetzt - 60 * 60_000) },
    });
    await prisma.shift.create({
      data: { tenantId, driverId, vehicleId, start: new Date(jetzt + 24 * 60 * 60_000), end: new Date(jetzt + 32 * 60 * 60_000) },
    });
    const ort = await prisma.place.create({
      data: { tenantId, label: "Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
    });
    const passenger = await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Fahrgast", phones: [] } });
    rideId = (
      await prisma.ride.create({
        data: {
          tenantId, passengerId: passenger.id, pickupPlaceId: ort.id, dropoffPlaceId: ort.id,
          pickupAt: new Date(jetzt + 3 * 60 * 60_000), transportType: "SITZEND", status: "DISPONIERT", source: "MANUELL",
          vehicleId, driverId,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  it("M-12 (R3-4): nach dem Deaktivieren sind Sitzungen und Push-Abos weg, Schichten beendet/ausgefallen, die Fahrt ist neu zu planen", async () => {
    const ergebnis = await fahrerDeaktivieren(tenantId, driverId, "PRUEF_admin");
    expect(ergebnis.sitzungenGeloescht).toBe(1);
    expect(ergebnis.pushAbosGeloescht).toBe(1);

    expect(await prisma.session.count({ where: { userId } })).toBe(0);
    expect(await prisma.pushSubscription.count({ where: { driverId } })).toBe(0);
    const fahrer = await prisma.driver.findUniqueOrThrow({ where: { id: driverId } });
    expect(fahrer.active).toBe(false);
    expect(fahrer.deactivatedAt).not.toBeNull();

    const schichten = await prisma.shift.findMany({ where: { driverId }, orderBy: { start: "asc" } });
    expect(schichten[0].endedAt).not.toBeNull();
    expect(schichten.every((s) => s.unavailable)).toBe(true);

    const fahrt = await prisma.ride.findUniqueOrThrow({ where: { id: rideId } });
    expect(fahrt.status).not.toBe("DISPONIERT");
    expect(fahrt.problems).toContain("Fahrer fällt aus");
  });

  it("M-12: der Fahrer taucht in keinem Vorschlag mehr auf", async () => {
    const schichten = await prisma.shift.findMany({ where: { tenantId } });
    const fahrzeuge = await prisma.vehicle.findMany({ where: { tenantId } });
    const { vorschlaege, keinKandidat } = await vorschlaegeBerechnen({
      fahrt: { transportType: "SITZEND", companion: false, pickupAt: new Date(Date.now() + 2 * 60 * 60_000), pickupOrt: { lat: 50.77, lng: 6.08 }, dropoffOrt: { lat: 50.78, lng: 6.09 } },
      fahrzeuge,
      schichten,
      tagesplan: [],
      depot: { lat: 50.77, lng: 6.08 },
      routing: { travelTimeMinutes: async () => 5 },
    });
    expect(vorschlaege).toEqual([]);
    expect(keinKandidat).toBe(true);
  });

  it("M-12: für das deaktivierte Konto geht kein Anmelde-Link mehr raus", async () => {
    const senden = vi.fn(async () => ({ id: "x" }));
    await expect(anmeldeLinkZustellen({ email, url: "https://x" }, { senden })).rejects.toThrow(/deaktiviert/);
    expect(senden).not.toHaveBeenCalled();
  });
});
