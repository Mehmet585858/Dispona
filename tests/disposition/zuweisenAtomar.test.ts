import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fahrzeugZuweisen } from "@/core/disposition/zuweisen";
import { fahrtStatusAendern } from "@/core/rides/status";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/**
 * Maßnahme M-04 (docs/13 R2-2 "Schreiben-vor-Status-Prüfung erzeugt Split-Brain-Datensatz",
 * R1-1 "Cron-Race bei parallelen Automodus-Durchläufen", R3-2 "Eigentümerprüfung und Schreiben
 * getrennt"): Fahrzeug/Fahrer und der Statuswechsel werden in EINER Transaktion geschrieben, und
 * Fahrer-Schreibzugriffe tragen die Eigentümerschaft als Bedingung.
 */
describe("fahrzeugZuweisen – atomar mit dem Statuswechsel (M-04)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let fahrzeugX: string;
  let fahrzeugY: string;
  let ortA: string;
  let ortB: string;
  let passengerId: string;

  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: `PRUEF_ZuweisungAtomar ${kennung}` } })).id;
    fahrzeugX = (await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-X-${kennung}` } })).id;
    fahrzeugY = (await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-Y-${kennung}` } })).id;
    ortA = (
      await prisma.place.create({
        data: { tenantId, label: "Ort A", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
      })
    ).id;
    ortB = (
      await prisma.place.create({
        data: { tenantId, label: "Ort B", street: "B 1", zip: "52062", city: "Aachen", lat: 50.8, lng: 6.1, type: "SONSTIGES" },
      })
    ).id;
    passengerId = (await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Fahrgast", phones: [] } })).id;
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  async function fahrt(status: "ERFASST" | "DISPONIERT", vehicleId?: string, driverId?: string) {
    return prisma.ride.create({
      data: {
        tenantId,
        passengerId,
        pickupPlaceId: ortA,
        dropoffPlaceId: ortB,
        pickupAt: new Date(Date.now() + 8 * 60 * 60_000 + Math.random() * 60 * 60_000),
        transportType: "SITZEND",
        status,
        source: "MANUELL",
        vehicleId,
        driverId,
      },
    });
  }

  it("M-04 (R2-2): Zuweisung auf eine schon disponierte Fahrt lässt Fahrzeug und Status unverändert", async () => {
    const r = await fahrt("DISPONIERT", fahrzeugX);
    await expect(fahrzeugZuweisen(tenantId, r.id, fahrzeugY, { dispatchMode: "AUTO" })).rejects.toThrow(/nicht erlaubt/);
    const danach = await prisma.ride.findUniqueOrThrow({ where: { id: r.id } });
    expect(danach.vehicleId).toBe(fahrzeugX);
    expect(danach.status).toBe("DISPONIERT");
    expect(await prisma.rideStatusEvent.count({ where: { rideId: r.id } })).toBe(0);
  });

  it("M-04 (R1-1): zwei gleichzeitige Zuweisungen derselben Fahrt auf verschiedene Fahrzeuge – genau eine gilt", async () => {
    const r = await fahrt("ERFASST");
    const ergebnis = await Promise.allSettled([
      fahrzeugZuweisen(tenantId, r.id, fahrzeugX, { dispatchMode: "AUTO" }),
      fahrzeugZuweisen(tenantId, r.id, fahrzeugY, { dispatchMode: "AUTO" }),
    ]);
    expect(ergebnis.filter((e) => e.status === "fulfilled")).toHaveLength(1);
    const danach = await prisma.ride.findUniqueOrThrow({ where: { id: r.id } });
    const gewinner = ergebnis[0].status === "fulfilled" ? fahrzeugX : fahrzeugY;
    expect(danach.vehicleId).toBe(gewinner);
    expect(danach.status).toBe("DISPONIERT");
    expect(await prisma.rideStatusEvent.count({ where: { rideId: r.id, status: "DISPONIERT" } })).toBe(1);
  });

  it("M-04 (R3-2): Statuswechsel mit erwarteterDriverId trifft nach einer Umbesetzung keine Zeile mehr", async () => {
    const userAlt = await prisma.user.create({
      data: { id: randomUUID(), tenantId, email: `${randomUUID()}@pruef.de`, name: "PRUEF Alt", role: "FAHRER" },
    });
    const userNeu = await prisma.user.create({
      data: { id: randomUUID(), tenantId, email: `${randomUUID()}@pruef.de`, name: "PRUEF Neu", role: "FAHRER" },
    });
    const fahrerAlt = await prisma.driver.create({ data: { tenantId, userId: userAlt.id } });
    const fahrerNeu = await prisma.driver.create({ data: { tenantId, userId: userNeu.id } });
    const r = await fahrt("DISPONIERT", fahrzeugX, fahrerAlt.id);

    // Der alte Fahrer hat die Fahrt noch in seiner App; inzwischen umbesetzt:
    await prisma.ride.update({ where: { id: r.id }, data: { driverId: fahrerNeu.id } });

    await expect(
      fahrtStatusAendern(tenantId, r.id, "UNTERWEGS", { erwarteterDriverId: fahrerAlt.id }),
    ).rejects.toThrow(/nicht mehr zu diesem Fahrer/);
    const danach = await prisma.ride.findUniqueOrThrow({ where: { id: r.id } });
    expect(danach.status).toBe("DISPONIERT");
    expect(await prisma.rideStatusEvent.count({ where: { rideId: r.id } })).toBe(0);

    // Der neue Fahrer darf.
    await fahrtStatusAendern(tenantId, r.id, "UNTERWEGS", { erwarteterDriverId: fahrerNeu.id });
    expect((await prisma.ride.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("UNTERWEGS");
  });
});
