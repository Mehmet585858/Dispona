import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";
import type { RideStatus } from "@/generated/prisma/enums";

/**
 * Maßnahme M-05 (docs/13 R3-1, Prüfbericht S4-014): Die Fahrer-App-Actions nehmen nur die vier
 * Fahrer-Status an und prüfen GPS-Werte. Nur die Sitzungsquelle wird gemockt, der Rest läuft
 * gegen Postgres.
 */
const sitzung = vi.hoisted(() => ({ wert: null as null | { tenantId: string; userId: string; role: string } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () =>
        sitzung.wert
          ? {
              user: { id: sitzung.wert.userId, tenantId: sitzung.wert.tenantId, role: sitzung.wert.role, name: "PRUEF", email: "p@t.de" },
              session: { createdAt: new Date() },
            }
          : null,
      ),
    },
  },
}));

import { fahrtStatusSetzenFahrer, gpsPositionMelden, gesehenBestaetigen } from "@/app/fahrer/actions";

describe("Fahrer-App-Actions (M-05)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let userId: string;
  let driverId: string;
  let vehicleId: string;
  let ortId: string;
  let passengerId: string;

  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: `PRUEF_FahrerActions ${kennung}` } })).id;
    userId = randomUUID();
    await prisma.user.create({ data: { id: userId, tenantId, email: `${userId}@pruef.de`, name: "PRUEF Fahrer", role: "FAHRER" } });
    driverId = (await prisma.driver.create({ data: { tenantId, userId, gpsConsentAt: new Date() } })).id;
    vehicleId = (await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-${kennung}` } })).id;
    ortId = (
      await prisma.place.create({
        data: { tenantId, label: "Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
      })
    ).id;
    passengerId = (await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Fahrgast", phones: [] } })).id;
    sitzung.wert = { tenantId, userId, role: "FAHRER" };
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  async function eigeneFahrt(status: RideStatus = "DISPONIERT") {
    return prisma.ride.create({
      data: {
        tenantId,
        passengerId,
        pickupPlaceId: ortId,
        dropoffPlaceId: ortId,
        pickupAt: new Date(Date.now() + 60 * 60_000),
        transportType: "SITZEND",
        status,
        source: "MANUELL",
        vehicleId,
        driverId,
      },
    });
  }

  it("M-05 (R3-1): fahrtStatusSetzenFahrer(…, 'STORNIERT') wird abgelehnt, die Fahrt bleibt disponiert", async () => {
    const fahrt = await eigeneFahrt();
    await expect(fahrtStatusSetzenFahrer(fahrt.id, "STORNIERT")).rejects.toThrow(/nur das Büro/);
    await expect(fahrtStatusSetzenFahrer(fahrt.id, "ERFASST")).rejects.toThrow(/nur das Büro/);
    expect((await prisma.ride.findUniqueOrThrow({ where: { id: fahrt.id } })).status).toBe("DISPONIERT");
    expect(await prisma.rideStatusEvent.count({ where: { rideId: fahrt.id } })).toBe(0);
  });

  it("erlaubte Fahrer-Status funktionieren weiterhin (UNTERWEGS mit gültiger Position)", async () => {
    const fahrt = await eigeneFahrt();
    await fahrtStatusSetzenFahrer(fahrt.id, "UNTERWEGS", { lat: 50.77, lng: 6.08 });
    expect((await prisma.ride.findUniqueOrThrow({ where: { id: fahrt.id } })).status).toBe("UNTERWEGS");
  });

  it("M-05 (S4-014): gpsPositionMelden(999, NaN) wird abgelehnt und speichert nichts", async () => {
    await prisma.shift.create({
      data: { tenantId, driverId, vehicleId, start: new Date(Date.now() - 60 * 60_000), end: new Date(Date.now() + 8 * 60 * 60_000), startedAt: new Date() },
    });
    await expect(gpsPositionMelden(999, Number.NaN)).rejects.toThrow(/GPS/);
    await expect(gpsPositionMelden(50.77, 181)).rejects.toThrow(/GPS/);
    expect(await prisma.vehicleLocation.count({ where: { tenantId } })).toBe(0);
    await gpsPositionMelden(50.77, 6.08);
    expect(await prisma.vehicleLocation.count({ where: { tenantId } })).toBe(1);
  });

  it("M-05 (Punkt 3): eine nie beendete Schicht von letzter Woche sendet keine Positionen mehr", async () => {
    await prisma.shift.deleteMany({ where: { tenantId } });
    await prisma.vehicleLocation.deleteMany({ where: { tenantId } });
    const vorEinerWoche = Date.now() - 7 * 24 * 60 * 60_000;
    await prisma.shift.create({
      data: { tenantId, driverId, vehicleId, start: new Date(vorEinerWoche), end: new Date(vorEinerWoche + 8 * 60 * 60_000), startedAt: new Date(vorEinerWoche) },
    });
    await gpsPositionMelden(50.77, 6.08);
    expect(await prisma.vehicleLocation.count({ where: { tenantId } })).toBe(0);
  });

  it("M-04 (R3-2): Gesehen-Bestätigung für eine fremde Fahrt trifft keine Zeile", async () => {
    const fahrt = await eigeneFahrt();
    await prisma.ride.update({ where: { id: fahrt.id }, data: { driverId: null } });
    await expect(gesehenBestaetigen(fahrt.id)).rejects.toThrow(/gehört nicht/);
    expect((await prisma.ride.findUniqueOrThrow({ where: { id: fahrt.id } })).driverAckAt).toBeNull();
  });

  it("M-02 (R3-6): mit einer Büro-Sitzung sind die Fahrer-Actions gesperrt", async () => {
    sitzung.wert = { tenantId, userId, role: "ADMIN" };
    try {
      await expect(gpsPositionMelden(50.77, 6.08)).rejects.toThrow(/Nur Fahrer/);
    } finally {
      sitzung.wert = { tenantId, userId, role: "FAHRER" };
    }
  });
});
