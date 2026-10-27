import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { planFuerMorgenBerechnen } from "@/core/disposition/planFuerMorgen";
import { berlinerMitternacht, datumIso, mitUhrzeit, tagVerschieben } from "@/core/shifts/week";
import { prisma } from "@/lib/prisma";

describe("planFuerMorgenBerechnen", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let ortAId: string;
  let ortBId: string;
  let passengerId: string;

  const heute = datumIso(new Date());
  const morgenIso = tagVerschieben(heute, 1);
  const morgen = berlinerMitternacht(morgenIso);
  const morgenEnde = new Date(morgen);
  morgenEnde.setDate(morgenEnde.getDate() + 1);

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Test-PlanMorgen ${kennung}`,
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

    const ortA = await prisma.place.create({
      data: { tenantId, label: "Ort A", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
    });
    ortAId = ortA.id;
    const ortB = await prisma.place.create({
      data: { tenantId, label: "Ort B", street: "B 1", zip: "52062", city: "Aachen", lat: 50.78, lng: 6.09, type: "SONSTIGES" },
    });
    ortBId = ortB.id;

    const passenger = await prisma.passenger.create({
      data: { tenantId, firstName: "Test", lastName: "Fahrgast", phones: [] },
    });
    passengerId = passenger.id;
  });

  afterEach(async () => {
    await prisma.rideStatusEvent.deleteMany({ where: { tenantId } });
    await prisma.suggestion.deleteMany({ where: { tenantId } });
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.ride.deleteMany({ where: { tenantId } });
    await prisma.shift.deleteMany({ where: { tenantId } });
    await prisma.driver.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.vehicle.deleteMany({ where: { tenantId } });
  });

  afterAll(async () => {
    await prisma.place.deleteMany({ where: { tenantId } });
    await prisma.passenger.deleteMany({ where: { tenantId } });
    await prisma.tenantSettings.delete({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  async function fahrzeugMitSchicht() {
    const vehicle = await prisma.vehicle.create({ data: { tenantId, plate: `TEST-${randomUUID().slice(0, 4)}` } });
    const user = await prisma.user.create({
      data: { id: randomUUID(), tenantId, email: `${randomUUID()}@test.de`, name: "Test Fahrer", role: "FAHRER" },
    });
    const driver = await prisma.driver.create({ data: { tenantId, userId: user.id } });
    await prisma.shift.create({ data: { tenantId, driverId: driver.id, vehicleId: vehicle.id, start: morgen, end: morgenEnde } });
    return vehicle.id;
  }

  async function unzugewieseneFahrt(uhrzeit: string) {
    return prisma.ride.create({
      data: {
        tenantId,
        passengerId,
        pickupPlaceId: ortAId,
        dropoffPlaceId: ortBId,
        pickupAt: mitUhrzeit(morgen, uhrzeit),
        transportType: "SITZEND",
        status: "ERFASST",
        source: "MANUELL",
        prescription: "JA", // sonst greift "Transportschein fehlt" (requireDocsForAuto, Standard an)
      },
    });
  }

  it("legt bei ausgeschaltetem Automodus einen Vorschlag an, disponiert aber nicht", async () => {
    await fahrzeugMitSchicht();
    const fahrt = await unzugewieseneFahrt("09:00");

    const ergebnis = await planFuerMorgenBerechnen(tenantId);
    expect(ergebnis.geprueft).toBe(1);
    expect(ergebnis.vorgeschlagen).toBe(1);
    expect(ergebnis.automatischDisponiert).toBe(0);

    const aktualisiert = await prisma.ride.findUniqueOrThrow({ where: { id: fahrt.id } });
    expect(aktualisiert.status).toBe("VORGESCHLAGEN");
    expect(aktualisiert.vehicleId).toBeNull();
  });

  it("disponiert im Automodus 'IMMER' eindeutige Fahrten direkt", async () => {
    const vehicleId = await fahrzeugMitSchicht();
    const fahrt = await unzugewieseneFahrt("09:00");
    await prisma.tenantSettings.update({ where: { tenantId }, data: { autoMode: "IMMER" } });

    const ergebnis = await planFuerMorgenBerechnen(tenantId);
    expect(ergebnis.automatischDisponiert).toBe(1);

    const aktualisiert = await prisma.ride.findUniqueOrThrow({ where: { id: fahrt.id } });
    expect(aktualisiert.status).toBe("DISPONIERT");
    expect(aktualisiert.vehicleId).toBe(vehicleId);
    expect(aktualisiert.dispatchMode).toBe("AUTO");

    await prisma.tenantSettings.update({ where: { tenantId }, data: { autoMode: "AUS" } });
  });

  it("meldet KEIN_FAHRZEUG, wenn keine passende Fahrzeugausstattung vorhanden ist", async () => {
    await fahrzeugMitSchicht(); // nur ein normales Fahrzeug, keins mit Rollstuhlplatz
    const fahrt = await prisma.ride.create({
      data: {
        tenantId,
        passengerId,
        pickupPlaceId: ortAId,
        dropoffPlaceId: ortBId,
        pickupAt: mitUhrzeit(morgen, "09:00"),
        transportType: "ROLLSTUHL",
        status: "ERFASST",
        source: "MANUELL",
      },
    });

    const ergebnis = await planFuerMorgenBerechnen(tenantId);
    expect(ergebnis.keinKandidat).toBe(1);

    const aktualisiert = await prisma.ride.findUniqueOrThrow({ where: { id: fahrt.id } });
    expect(aktualisiert.problems).toContain("KEIN_FAHRZEUG");
  });

  it("tut nichts, solange kein Betriebshof hinterlegt ist", async () => {
    const ohneDepot = await prisma.tenant.create({
      data: {
        name: `Test-PlanMorgen-OhneDepot ${kennung}`,
        settings: {
          create: {
            greeting: "Test",
            voiceId: "test",
            escalationNumber: "+4924019999999",
            openingHours: {},
            serviceAreaCenter: { lat: 50.77, lng: 6.08 },
          },
        },
      },
    });

    const ergebnis = await planFuerMorgenBerechnen(ohneDepot.id);
    expect(ergebnis).toEqual({ geprueft: 0, automatischDisponiert: 0, vorgeschlagen: 0, keinKandidat: 0 });

    await prisma.tenantSettings.delete({ where: { tenantId: ohneDepot.id } });
    await prisma.tenant.delete({ where: { id: ohneDepot.id } });
  });
});
