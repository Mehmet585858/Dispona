import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fahrtAbbrechen, fahrtStornieren } from "@/core/rides/stornieren";
import { istUebergangErlaubt } from "@/core/rides/status";
import { werkzeugAusfuehren } from "@/core/voice/werkzeuge";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";
import type { RideStatus } from "@/generated/prisma/enums";

/**
 * Maßnahme M-19 (docs/13 R3-3): Eine Fahrt ließ sich stornieren, während der Fahrgast schon im
 * Fahrzeug saß – aus der Dispo, der DSGVO-Löschung und über die KI am Telefon. Die Fahrt
 * verschwand vom Handy des Fahrers mit derselben Meldung wie ein Storno vor der Abholung.
 */
describe("Stornieren nur vor der Abholung (M-19)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let passengerId: string;
  let ortId: string;
  let driverId: string;

  async function fahrt(status: RideStatus) {
    return (
      await prisma.ride.create({
        data: {
          tenantId, passengerId, pickupPlaceId: ortId, dropoffPlaceId: ortId, pickupAt: new Date(Date.now() + 15 * 60_000),
          transportType: "SITZEND", status, source: "MANUELL", driverId,
        },
      })
    ).id;
  }

  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: `PRUEF_Storno ${kennung}` } })).id;
    passengerId = (await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Storno", phones: [] } })).id;
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

  it("M-19 (R3-3): Übergänge UNTERWEGS/AN_BORD → STORNIERT sind nicht mehr erlaubt", () => {
    expect(istUebergangErlaubt("AN_BORD", "STORNIERT")).toBe(false);
    expect(istUebergangErlaubt("UNTERWEGS", "STORNIERT")).toBe(false);
    expect(istUebergangErlaubt("DISPONIERT", "STORNIERT")).toBe(true);
  });

  it("M-19 (R3-3): fahrtStornieren bei AN_BORD bzw. UNTERWEGS → abgelehnt, Status bleibt, keine Push", async () => {
    for (const status of ["AN_BORD", "UNTERWEGS"] as const) {
      const id = await fahrt(status);
      await expect(fahrtStornieren(tenantId, id)).rejects.toThrow(/läuft bereits/);
      expect((await prisma.ride.findUniqueOrThrow({ where: { id } })).status).toBe(status);
      expect(await prisma.notification.count({ where: { rideId: id, kind: "STORNO" } })).toBe(0);
    }
  });

  it("M-19: 'Fahrt abbrechen' (nur Büro) setzt eine laufende Fahrt auf PROBLEM mit eigenem Vermerk und eigener Meldung", async () => {
    const id = await fahrt("AN_BORD");
    await fahrtAbbrechen(tenantId, id, { userId: undefined });
    const nachher = await prisma.ride.findUniqueOrThrow({ where: { id } });
    expect(nachher.status).toBe("PROBLEM");
    expect(nachher.problems).toContain("FAHRT_ABGEBROCHEN");
    expect(await prisma.notification.count({ where: { rideId: id, kind: "ABBRUCH" } })).toBe(1);
    expect(await prisma.notification.count({ where: { rideId: id, kind: "STORNO" } })).toBe(0);
  });

  it("M-19: 'Fahrt abbrechen' gilt nur für laufende Fahrten – vor der Abholung heißt es stornieren", async () => {
    const id = await fahrt("DISPONIERT");
    await expect(fahrtAbbrechen(tenantId, id, {})).rejects.toThrow(/nicht unterwegs/);
    expect((await prisma.ride.findUniqueOrThrow({ where: { id } })).status).toBe("DISPONIERT");
  });

  it("M-19: KI-Werkzeug fahrt_stornieren bei UNTERWEGS → Hinweis 'an Mitarbeiter', Fahrt bleibt", async () => {
    const id = await fahrt("UNTERWEGS");
    const callId = (
      await prisma.call.create({
        data: { tenantId, providerCallId: `PRUEF_st_${kennung}`, toNumber: "+490", startedAt: new Date(), identifiedPassengerIds: [passengerId] },
      })
    ).id;
    const ergebnis = await werkzeugAusfuehren(tenantId, callId, { id: `PRUEF_tc_${kennung}`, name: "fahrt_stornieren", arguments: { rideId: id } });
    expect(ergebnis.error).toBeUndefined();
    expect(ergebnis.result).toMatch(/Mitarbeiter/);
    expect((await prisma.ride.findUniqueOrThrow({ where: { id } })).status).toBe("UNTERWEGS");
  });

  it("M-19: KI-Werkzeug storniert weiterhin eine disponierte Fahrt", async () => {
    const id = await fahrt("DISPONIERT");
    const callId = (
      await prisma.call.create({
        data: { tenantId, providerCallId: `PRUEF_st2_${kennung}`, toNumber: "+490", startedAt: new Date(), identifiedPassengerIds: [passengerId] },
      })
    ).id;
    const ergebnis = await werkzeugAusfuehren(tenantId, callId, { id: `PRUEF_tc2_${kennung}`, name: "fahrt_stornieren", arguments: { rideId: id } });
    expect(ergebnis.result).toBe("Fahrt storniert.");
    expect((await prisma.ride.findUniqueOrThrow({ where: { id } })).status).toBe("STORNIERT");
  });
});
