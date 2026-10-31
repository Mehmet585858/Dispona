import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoBetriebSimulieren } from "@/core/demo/betriebSimulieren";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

describe("demoBetriebSimulieren", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let wohnungId: string;
  let klinikId: string;
  let fahrzeugId: string;
  let fahrerId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Test-Demo-Betrieb-${kennung}`,
        paket: "PRO",
        settings: {
          create: {
            greeting: "Test",
            voiceId: "test",
            escalationNumber: "",
            openingHours: {},
            serviceAreaCenter: { lat: 52.52, lng: 13.405 },
            serviceAreaKm: 50,
            depotAddress: { lat: 52.52, lng: 13.405 },
            autoMode: "IMMER",
            autoModeMinMargin: 0,
          },
        },
      },
    });
    tenantId = tenant.id;

    const wohnung = await prisma.place.create({
      data: { tenantId, label: "Wohnung", street: "A 1", zip: "10115", city: "Berlin", lat: 52.52, lng: 13.4, type: "WOHNUNG" },
    });
    wohnungId = wohnung.id;
    const klinik = await prisma.place.create({
      data: { tenantId, label: "Klinikum", street: "B 1", zip: "10117", city: "Berlin", lat: 52.525, lng: 13.41, type: "KLINIK" },
    });
    klinikId = klinik.id;

    const fahrzeug = await prisma.vehicle.create({
      data: { tenantId, plate: `B-TEST ${kennung}`, active: true, seats: 4, wheelchairSpots: 1, carryChair: false, stretcher: false },
    });
    fahrzeugId = fahrzeug.id;
    // M-72: eine DISPONIERT-Fahrt gibt es nur mit Fahrer (die Datenbank lehnt alles andere ab).
    const user = await prisma.user.create({
      data: { id: randomUUID(), tenantId, email: `${randomUUID()}@pruef.de`, name: "Test Fahrer", role: "FAHRER" },
    });
    fahrerId = (await prisma.driver.create({ data: { tenantId, userId: user.id } })).id;
  });

  afterAll(async () => {
    await prisma.rideStatusEvent.deleteMany({ where: { tenantId } });
    await prisma.suggestion.deleteMany({ where: { tenantId } });
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.vehicleLocation.deleteMany({ where: { tenantId } });
    await prisma.ride.deleteMany({ where: { tenantId } });
    await prisma.call.deleteMany({ where: { tenantId } });
    await prisma.passenger.deleteMany({ where: { tenantId } });
    await prisma.place.deleteMany({ where: { tenantId } });
    await prisma.driver.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.vehicle.deleteMany({ where: { tenantId } });
    await prisma.tenantSettings.delete({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  it("legt bei Bedarf eine neue Fahrt mit echtem, entschlüsselbarem Anruf-Transkript an", async () => {
    await demoBetriebSimulieren(tenantId);

    const fahrten = await prisma.ride.findMany({ where: { tenantId }, include: { call: true, passenger: true } });
    expect(fahrten.length).toBeGreaterThan(0);

    // tagesplanSicherstellen() legt daneben auch direkt (ohne Anruf) Vergangenheits-Fahrten an -
    // hier geht es konkret um die simulierte Anruf-Fahrt, nicht irgendeine beliebige.
    const fahrt = fahrten.find((f) => f.callId !== null);
    expect(fahrt).toBeDefined();
    expect(fahrt!.source).toBe("ANRUF");
    expect(fahrt!.call?.transcript).toBeTruthy();
    const klartext = decrypt(fahrt!.call!.transcript!);
    expect(klartext).toContain(fahrt!.passenger.lastName);

    // Fahrgast-Stamm wurde selbst angelegt (kein vorheriger seedDemoTenant()-Lauf nötig).
    const passagiere = await prisma.passenger.findMany({ where: { tenantId } });
    expect(passagiere.length).toBeGreaterThanOrEqual(6);
  });

  it("schreibt den Status einer fälligen, disponierten Fahrt automatisch fort und aktualisiert die Position", async () => {
    const passagier = await prisma.passenger.create({
      data: { tenantId, firstName: "Status", lastName: `Test-${kennung}`, phones: [] },
    });
    const faelligeFahrt = await prisma.ride.create({
      data: {
        tenantId,
        passengerId: passagier.id,
        pickupPlaceId: wohnungId,
        dropoffPlaceId: klinikId,
        pickupAt: new Date(), // schon fällig
        transportType: "SITZEND",
        status: "DISPONIERT",
        source: "ANRUF",
        vehicleId: fahrzeugId,
        driverId: fahrerId,
      },
    });

    await demoBetriebSimulieren(tenantId);

    const aktualisiert = await prisma.ride.findUnique({ where: { id: faelligeFahrt.id } });
    expect(aktualisiert?.status).toBe("UNTERWEGS");

    const position = await prisma.vehicleLocation.findFirst({
      where: { vehicleId: fahrzeugId },
      orderBy: { at: "desc" },
    });
    expect(position).not.toBeNull();
  });
});
