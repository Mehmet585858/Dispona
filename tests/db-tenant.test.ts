import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FremdeReferenzError, withTenant } from "@/lib/db";
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

describe("withTenant – innerhalb einer Transaktion (M-04/M-23)", () => {
  it("M-04: findUnique/update sehen eine in derselben Transaktion angelegte Zeile des eigenen Mandanten", async () => {
    const tenant = await prisma.tenant.create({ data: { name: `PRUEF_tx ${randomUUID().slice(0, 8)}` } });
    const fremd = await prisma.tenant.create({ data: { name: `PRUEF_tx-fremd ${randomUUID().slice(0, 8)}` } });
    const fremderFahrgast = await prisma.passenger.create({
      data: { tenantId: fremd.id, firstName: "PRUEF", lastName: "Fremd", phones: [] },
    });
    const db = withTenant(tenant.id);
    try {
      const ergebnis = await db.$transaction(async (tx) => {
        const neu = await tx.passenger.create({ data: { tenantId: tenant.id, firstName: "PRUEF", lastName: "Tx", phones: [] } });
        const gelesen = await tx.passenger.findUnique({ where: { id: neu.id } });
        const aktualisiert = await tx.passenger.update({ where: { id: neu.id }, data: { lastName: "Tx2" } });
        // Fremde Zeile bleibt auch in der Transaktion unsichtbar bzw. unveränderbar.
        const fremdGelesen = await tx.passenger.findUnique({ where: { id: fremderFahrgast.id } });
        await expect(tx.passenger.update({ where: { id: fremderFahrgast.id }, data: { lastName: "X" } })).rejects.toThrow(
          "Nicht gefunden.",
        );
        return { gelesen, aktualisiert, fremdGelesen };
      });
      expect(ergebnis.gelesen?.lastName).toBe("Tx");
      expect(ergebnis.aktualisiert.lastName).toBe("Tx2");
      expect(ergebnis.fremdGelesen).toBeNull();
      expect((await prisma.passenger.findUniqueOrThrow({ where: { id: fremderFahrgast.id } })).lastName).toBe("Fremd");
    } finally {
      await prisma.passenger.deleteMany({ where: { tenantId: { in: [tenant.id, fremd.id] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenant.id, fremd.id] } } });
    }
  });
});


/**
 * Maßnahme M-11 (Prüfbericht S2-008): withTenant() filterte nur die Zieltabelle. Fremdschlüssel
 * in `data` (Fahrgast, Ort, Fahrer, Fahrzeug, …) wurden nur geprüft, wo ein Aufrufer daran dachte
 * (referenzenPruefen). Hier wird der Mandanten-Client direkt benutzt – ohne Hilfsfunktion –, wie
 * es ein künftiger, neuer Codepfad tun würde.
 */
describe("withTenant – Fremdschlüssel über die Mandantengrenze (M-11)", () => {
  const kennung = randomUUID().slice(0, 8);
  let a: string;
  let b: string;
  let placeA: string;
  let placeB: string;
  let passengerA: string;
  let passengerB: string;
  let vehicleA: string;
  let vehicleB: string;
  let driverA: string;
  let driverB: string;
  let rideA: string;

  const fahrtDaten = (passengerId: string, pickupPlaceId: string, dropoffPlaceId: string) => ({
    passengerId,
    pickupPlaceId,
    dropoffPlaceId,
    pickupAt: new Date(),
    transportType: "SITZEND" as const,
    status: "ERFASST" as const,
    source: "MANUELL" as const,
  });

  beforeAll(async () => {
    a = (await prisma.tenant.create({ data: { name: `PRUEF_fk-A ${kennung}` } })).id;
    b = (await prisma.tenant.create({ data: { name: `PRUEF_fk-B ${kennung}` } })).id;
    const ort = (tenantId: string) =>
      prisma.place.create({
        data: { tenantId, label: "PRUEF Ort", street: "Teststraße 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
      });
    placeA = (await ort(a)).id;
    placeB = (await ort(b)).id;
    passengerA = (await prisma.passenger.create({ data: { tenantId: a, firstName: "PRUEF", lastName: "A", phones: [] } })).id;
    passengerB = (await prisma.passenger.create({ data: { tenantId: b, firstName: "PRUEF", lastName: "B", phones: [] } })).id;
    vehicleA = (await prisma.vehicle.create({ data: { tenantId: a, plate: `PRUEF-A-${kennung}` } })).id;
    vehicleB = (await prisma.vehicle.create({ data: { tenantId: b, plate: `PRUEF-B-${kennung}` } })).id;
    const fahrer = async (tenantId: string) => {
      const user = await prisma.user.create({
        data: { id: randomUUID(), tenantId, email: `pruef-${randomUUID()}@test.invalid`, name: "PRUEF Fahrer", role: "FAHRER" },
      });
      return (await prisma.driver.create({ data: { tenantId, userId: user.id } })).id;
    };
    driverA = await fahrer(a);
    driverB = await fahrer(b);
    rideA = (await prisma.ride.create({ data: { tenantId: a, ...fahrtDaten(passengerA, placeA, placeA) } })).id;
  });

  afterAll(async () => {
    const { mandantKomplettLoeschen } = await import("@/lib/seedSchutz");
    await mandantKomplettLoeschen(a);
    await mandantKomplettLoeschen(b);
  });

  it("M-11: ride.create mit Fahrgast und Orten eines anderen Mandanten wird abgelehnt, nichts angelegt", async () => {
    const db = withTenant(a);
    await expect(db.ride.create({ data: { tenantId: a, ...fahrtDaten(passengerB, placeA, placeA) } })).rejects.toBeInstanceOf(
      FremdeReferenzError,
    );
    await expect(db.ride.create({ data: { tenantId: a, ...fahrtDaten(passengerA, placeB, placeA) } })).rejects.toBeInstanceOf(
      FremdeReferenzError,
    );
    expect(await prisma.ride.count({ where: { tenantId: a } })).toBe(1);
  });

  it("M-11: ride.update auf Fahrzeug bzw. Fahrer eines anderen Mandanten wird abgelehnt, Fahrt unverändert", async () => {
    const db = withTenant(a);
    await expect(db.ride.update({ where: { id: rideA }, data: { vehicleId: vehicleB } })).rejects.toBeInstanceOf(FremdeReferenzError);
    await expect(db.ride.updateMany({ where: { id: rideA }, data: { driverId: driverB } })).rejects.toBeInstanceOf(FremdeReferenzError);
    const fahrt = await prisma.ride.findUniqueOrThrow({ where: { id: rideA } });
    expect(fahrt.vehicleId).toBeNull();
    expect(fahrt.driverId).toBeNull();
  });

  it("M-11: Schicht, Genehmigung, Push-Abo und Wohnort mit fremden IDs werden abgelehnt", async () => {
    const db = withTenant(a);
    const jetzt = new Date();
    await expect(
      db.shift.create({ data: { tenantId: a, driverId: driverB, vehicleId: vehicleA, start: jetzt, end: new Date(jetzt.getTime() + 3600_000) } }),
    ).rejects.toBeInstanceOf(FremdeReferenzError);
    await expect(
      db.approval.create({ data: { tenantId: a, passengerId: passengerB, validFrom: jetzt, validUntil: jetzt } }),
    ).rejects.toBeInstanceOf(FremdeReferenzError);
    await expect(
      db.pushSubscription.create({ data: { tenantId: a, driverId: driverB, endpoint: `https://push.test/${kennung}`, keys: { p256dh: "x", auth: "y" } } }),
    ).rejects.toBeInstanceOf(FremdeReferenzError);
    await expect(db.passenger.update({ where: { id: passengerA }, data: { homePlaceId: placeB } })).rejects.toBeInstanceOf(
      FremdeReferenzError,
    );
  });

  it("M-11: auch der rohe Client (ohne withTenant) kann keine Fahrt an einen fremden Fahrgast hängen", async () => {
    await expect(prisma.ride.create({ data: { tenantId: a, ...fahrtDaten(passengerB, placeA, placeA) } })).rejects.toThrow();
    expect(await prisma.ride.count({ where: { tenantId: a } })).toBe(1);
  });

  it("M-11: eigene, in derselben Transaktion angelegte Zeilen gehen durch; include zeigt nur eigene Daten", async () => {
    const db = withTenant(a);
    const fahrt = await db.$transaction(async (tx) => {
      const fahrgast = await tx.passenger.create({ data: { tenantId: a, firstName: "PRUEF", lastName: "Tx", phones: [] } });
      return tx.ride.create({ data: { tenantId: a, ...fahrtDaten(fahrgast.id, placeA, placeA), vehicleId: vehicleA, driverId: driverA } });
    });
    const mitFahrgast = await db.ride.findMany({ where: { tenantId: a }, include: { passenger: true, pickupPlace: true } });
    expect(mitFahrgast.map((r) => r.passenger.tenantId)).toEqual(mitFahrgast.map(() => a));
    expect(mitFahrgast.map((r) => r.pickupPlace.tenantId)).toEqual(mitFahrgast.map(() => a));
    await prisma.ride.delete({ where: { id: fahrt.id } });
  });
});
