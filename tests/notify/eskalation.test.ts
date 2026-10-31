import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { smsProvider } from "@/providers/sms";
import { bestaetigungenPruefen, keinFahrzeugAlarmPruefen } from "@/core/notify/eskalation";
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
        // M-15: Eskalation nur für Fahrten in < 60 Minuten.
        pickupAt: new Date(Date.now() + 30 * 60_000),
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

  it("schickt eine SMS an den Fahrer, wenn seit 5 Minuten keine Bestätigung da ist (M-15)", async () => {
    const rideId = await neueUnbestaetigteFahrt(5);
    const ergebnis = await bestaetigungenPruefen(tenantId);
    expect(ergebnis.smsAnFahrer).toBeGreaterThanOrEqual(1);

    const notifications = await prisma.notification.findMany({ where: { rideId, kind: "KEINE_BESTAETIGUNG_FAHRER" } });
    expect(notifications).toHaveLength(1);
  });

  it("S1-002: scheitert der SMS-Versand, bricht der Lauf nicht ab und der Fehler steht an der Benachrichtigung", async () => {
    const rideId = await neueUnbestaetigteFahrt(5);
    const sendenSpy = vi.spyOn(smsProvider, "send").mockRejectedValueOnce(new Error("PRUEF: Anbieter nicht erreichbar"));
    const fehlerLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const ergebnis = await bestaetigungenPruefen(tenantId);
      expect(ergebnis.fehler).toBeGreaterThanOrEqual(1);
      const notification = await prisma.notification.findFirst({ where: { rideId, kind: "KEINE_BESTAETIGUNG_FAHRER" } });
      expect(notification?.error).toContain("PRUEF: Anbieter nicht erreichbar");
      // S2-009: im Log nur IDs, nie die Rufnummer.
      for (const aufruf of fehlerLog.mock.calls) expect(String(aufruf[0])).not.toContain("+491701234567");
    } finally {
      sendenSpy.mockRestore();
      fehlerLog.mockRestore();
    }
  });

  it("schickt beim nächsten Lauf keine zweite SMS für dieselbe Fahrt", async () => {
    const rideId = await neueUnbestaetigteFahrt(10);
    await bestaetigungenPruefen(tenantId);
    await bestaetigungenPruefen(tenantId);

    const notifications = await prisma.notification.findMany({ where: { rideId, kind: "KEINE_BESTAETIGUNG_FAHRER" } });
    expect(notifications).toHaveLength(1);
  });
});

describe("bestaetigungenPruefen – Eskalation je Zuweisung (S2-017)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;

  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: `PRUEF_Eskalation-Wechsel ${kennung}` } })).id;
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

  async function fahrer(nummer: string) {
    const user = await prisma.user.create({
      data: { id: randomUUID(), tenantId, email: `${randomUUID()}@test.de`, name: "PRUEF Fahrer", role: "FAHRER", phone: nummer },
    });
    return prisma.driver.create({ data: { tenantId, userId: user.id } });
  }

  it("S2-017: nach einem Fahrerwechsel bekommt auch der neue Fahrer die SMS", async () => {
    const fahrer1 = await fahrer("+491700000011");
    const fahrer2 = await fahrer("+491700000012");
    const passenger = await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Fahrgast", phones: [] } });
    const ort = await prisma.place.create({
      data: { tenantId, label: "Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
    });
    const vehicle = await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-${kennung}` } });
    const ride = await prisma.ride.create({
      data: {
        tenantId, passengerId: passenger.id, pickupPlaceId: ort.id, dropoffPlaceId: ort.id,
        pickupAt: new Date(Date.now() + 30 * 60_000), transportType: "SITZEND", status: "DISPONIERT", source: "MANUELL",
        vehicleId: vehicle.id, driverId: fahrer1.id,
      },
    });
    await prisma.rideStatusEvent.create({ data: { tenantId, rideId: ride.id, status: "DISPONIERT", at: new Date(Date.now() - 5 * 60_000) } });

    const lauf1 = await bestaetigungenPruefen(tenantId);
    expect(lauf1.smsAnFahrer).toBe(1);

    // Fahrer 1 fällt aus, Fahrt wird neu disponiert: neuer Fahrer, neues DISPONIERT-Ereignis, keine Bestätigung.
    await prisma.ride.update({ where: { id: ride.id }, data: { driverId: fahrer2.id, driverAckAt: null } });
    // M-15: Frist 5 Minuten (vorher 2) – die neue Zuweisung liegt 6 Minuten zurück.
    await prisma.rideStatusEvent.create({ data: { tenantId, rideId: ride.id, status: "DISPONIERT", at: new Date(Date.now() - 6 * 60_000) } });

    const lauf2 = await bestaetigungenPruefen(tenantId);
    expect(lauf2.smsAnFahrer).toBe(1);
    const anFahrer2 = await prisma.notification.findMany({ where: { rideId: ride.id, kind: "KEINE_BESTAETIGUNG_FAHRER", toRef: fahrer2.id } });
    expect(anFahrer2).toHaveLength(1);

    // Dritter Lauf ohne neue Zuweisung: keine weitere SMS.
    const lauf3 = await bestaetigungenPruefen(tenantId);
    expect(lauf3.smsAnFahrer).toBe(0);
  });
});

describe("keinFahrzeugAlarmPruefen", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Test-KeinFahrzeug ${kennung}`,
        settings: {
          create: {
            greeting: "Test",
            voiceId: "test",
            escalationNumber: "+4924019999999",
            openingHours: {},
            serviceAreaCenter: { lat: 50.77, lng: 6.08 },
            alertPhone: "+491701112222",
          },
        },
      },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.ride.deleteMany({ where: { tenantId } });
    await prisma.place.deleteMany({ where: { tenantId } });
    await prisma.passenger.deleteMany({ where: { tenantId } });
    await prisma.tenantSettings.delete({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  async function neueFahrtOhneFahrzeug(minutenBisAbholung: number) {
    const passenger = await prisma.passenger.create({
      data: { tenantId, firstName: "Test", lastName: "Fahrgast", phones: [] },
    });
    const ort = await prisma.place.create({
      data: { tenantId, label: "Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
    });
    const ride = await prisma.ride.create({
      data: {
        tenantId,
        passengerId: passenger.id,
        pickupPlaceId: ort.id,
        dropoffPlaceId: ort.id,
        pickupAt: new Date(Date.now() + minutenBisAbholung * 60_000),
        transportType: "SITZEND",
        status: "ERFASST",
        source: "MANUELL",
        problems: ["KEIN_FAHRZEUG"],
      },
    });
    return ride.id;
  }

  it("schickt eine SMS, wenn in den nächsten 2 Stunden kein Fahrzeug gefunden wurde", async () => {
    const rideId = await neueFahrtOhneFahrzeug(90);
    const ergebnis = await keinFahrzeugAlarmPruefen(tenantId);
    expect(ergebnis.smsAnInhaber).toBeGreaterThanOrEqual(1);

    const notifications = await prisma.notification.findMany({ where: { rideId, kind: "KEIN_FAHRZEUG_ALARM" } });
    expect(notifications).toHaveLength(1);
  });

  it("schickt keine SMS für Fahrten weiter als 2 Stunden in der Zukunft", async () => {
    const rideId = await neueFahrtOhneFahrzeug(300);
    await keinFahrzeugAlarmPruefen(tenantId);

    const notifications = await prisma.notification.findMany({ where: { rideId, kind: "KEIN_FAHRZEUG_ALARM" } });
    expect(notifications).toHaveLength(0);
  });

  it("schickt beim nächsten Lauf keine zweite SMS für dieselbe Fahrt", async () => {
    const rideId = await neueFahrtOhneFahrzeug(60);
    await keinFahrzeugAlarmPruefen(tenantId);
    await keinFahrzeugAlarmPruefen(tenantId);

    const notifications = await prisma.notification.findMany({ where: { rideId, kind: "KEIN_FAHRZEUG_ALARM" } });
    expect(notifications).toHaveLength(1);
  });
});

/**
 * Maßnahme M-15 Punkt 2/3 (Prüfbericht S3-006, docs/05-disposition.md "Automodus"): Eskalation nur
 * für Fahrten, die in weniger als 60 Minuten beginnen, mit 5 Minuten Frist. Vorher ging die SMS
 * zwei Minuten nach JEDER Zuweisung raus – beim Plan für morgen 90 SMS auf einmal.
 */
describe("Eskalation nur für zeitnahe Fahrten (M-15)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;

  beforeAll(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: {
          name: `PRUEF_Eskalation-Fenster ${kennung}`,
          settings: {
            create: { greeting: "x", voiceId: "x", escalationNumber: "+4900", openingHours: {}, serviceAreaCenter: { lat: 50.77, lng: 6.08 }, alertPhone: "+491701119999", driverAckMinutes: 5 },
          },
        },
      })
    ).id;
  });

  afterAll(async () => {
    const { mandantKomplettLoeschen } = await import("@/lib/seedSchutz");
    await mandantKomplettLoeschen(tenantId);
  });

  async function zuweisung(abholungInMinuten: number, disponiertVorMinuten: number) {
    const user = await prisma.user.create({
      data: { id: randomUUID(), tenantId, email: `pruef-${randomUUID()}@test.invalid`, name: "PRUEF Fahrer", role: "FAHRER", phone: "+491700000099" },
    });
    const driver = await prisma.driver.create({ data: { tenantId, userId: user.id } });
    const passenger = await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Fahrgast", phones: [] } });
    const ort = await prisma.place.create({
      data: { tenantId, label: "PRUEF Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
    });
    const ride = await prisma.ride.create({
      data: {
        tenantId, passengerId: passenger.id, pickupPlaceId: ort.id, dropoffPlaceId: ort.id,
        pickupAt: new Date(Date.now() + abholungInMinuten * 60_000), transportType: "SITZEND", status: "DISPONIERT", source: "MANUELL",
        driverId: driver.id,
      },
    });
    await prisma.rideStatusEvent.create({
      data: { tenantId, rideId: ride.id, status: "DISPONIERT", at: new Date(Date.now() - disponiertVorMinuten * 60_000) },
    });
    return ride.id;
  }

  async function smsAnFahrer(rideId: string) {
    return prisma.notification.count({ where: { rideId, kind: "KEINE_BESTAETIGUNG_FAHRER" } });
  }

  it("M-15 (S3-006): Zuweisung für morgen → keine SMS, auch 30 Minuten nach der Zuweisung", async () => {
    const rideId = await zuweisung(24 * 60, 30);
    await bestaetigungenPruefen(tenantId);
    expect(await smsAnFahrer(rideId)).toBe(0);
  });

  it("M-15: Fahrt in 30 Minuten, seit 3 Minuten disponiert → noch keine SMS (5-Minuten-Frist)", async () => {
    const rideId = await zuweisung(30, 3);
    await bestaetigungenPruefen(tenantId);
    expect(await smsAnFahrer(rideId)).toBe(0);
  });

  it("M-15: früh zugewiesene Fahrt – die Frist beginnt erst, wenn sie ins 60-Minuten-Fenster rückt", async () => {
    const geradeImFenster = await zuweisung(58, 2 * 24 * 60);
    const seitSechsMinutenImFenster = await zuweisung(54, 2 * 24 * 60);
    await bestaetigungenPruefen(tenantId);
    expect(await smsAnFahrer(geradeImFenster)).toBe(0);
    expect(await smsAnFahrer(seitSechsMinutenImFenster)).toBe(1);
  });

  it("M-15 Punkt 3: Kein-Fahrzeug-Alarm kommt erneut, wenn die Fahrt zwischendurch disponiert war", async () => {
    const passenger = await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "KF", phones: [] } });
    const ort = await prisma.place.create({
      data: { tenantId, label: "PRUEF Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
    });
    const ride = await prisma.ride.create({
      data: {
        tenantId, passengerId: passenger.id, pickupPlaceId: ort.id, dropoffPlaceId: ort.id,
        pickupAt: new Date(Date.now() + 90 * 60_000), transportType: "SITZEND", status: "ERFASST", source: "MANUELL",
        problems: ["KEIN_FAHRZEUG"],
      },
    });
    // Erster Alarm vor 30 Minuten, danach disponiert (Fahrer gefunden), dann fiel der Fahrer aus.
    await prisma.notification.create({
      data: { tenantId, channel: "SMS", toRef: "INHABER", rideId: ride.id, kind: "KEIN_FAHRZEUG_ALARM", sentAt: new Date(Date.now() - 30 * 60_000) },
    });
    await prisma.rideStatusEvent.create({ data: { tenantId, rideId: ride.id, status: "DISPONIERT", at: new Date(Date.now() - 20 * 60_000) } });

    await keinFahrzeugAlarmPruefen(tenantId);
    expect(await prisma.notification.count({ where: { rideId: ride.id, kind: "KEIN_FAHRZEUG_ALARM" } })).toBe(2);
  });
});
