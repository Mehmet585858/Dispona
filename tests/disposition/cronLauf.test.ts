import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  cronLaufMitSperre,
  cronUeberwachen,
  fuerAlleMandanten,
  jeEintragIsoliert,
  planFuerMorgenBeanspruchen,
} from "@/core/betrieb/cronLauf";
import { planFuerMorgenBerechnen } from "@/core/disposition/planFuerMorgen";
import { routingProvider } from "@/providers/routing";
import { smsProvider } from "@/providers/sms";
import { datumIso, tagVerschieben, berlinerMitternacht } from "@/core/shifts/week";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/**
 * Maßnahme M-16 (Prüfbericht S2-010, S3-011, docs/13 R2-3): Die Nachtautomatik und "Plan für morgen"
 * liefen jede Minute ohne Sperre; eine einzelne fehlerhafte Fahrt brach die ganze Liste ab (jede
 * Minute erneut, bis zum Morgen, ohne dass es jemand merkte); planFuerMorgenLauf wurde erst NACH dem
 * Lauf gesetzt.
 */
describe("Cron-Läufe (M-16)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;

  beforeAll(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: {
          name: `PRUEF_Cron ${kennung}`,
          settings: {
            create: {
              greeting: "x", voiceId: "x", escalationNumber: "+4900", openingHours: {},
              serviceAreaCenter: { lat: 50.77, lng: 6.08 },
              depotAddress: { street: "Hof 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08 },
              alertPhone: "+491701118888",
              autoMode: "IMMER",
            },
          },
        },
      })
    ).id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  it("M-16 (S2-010): Eintrag 3 von 5 wirft → 4 und 5 werden trotzdem bearbeitet, der Fehler wird gemeldet", async () => {
    const bearbeitet: number[] = [];
    const fehlgeschlagen: number[] = [];
    const ergebnis = await jeEintragIsoliert(
      [1, 2, 3, 4, 5],
      async (n) => {
        if (n === 3) throw new Error("PRUEF kaputt");
        bearbeitet.push(n);
      },
      async (n) => {
        fehlgeschlagen.push(n);
      },
    );
    expect(bearbeitet).toEqual([1, 2, 4, 5]);
    expect(fehlgeschlagen).toEqual([3]);
    expect(ergebnis.fehler).toBe(1);
  });

  it("M-16: zwei parallele Läufe desselben Crons → genau einer arbeitet", async () => {
    let freigeben: () => void = () => undefined;
    const warten = new Promise<void>((resolve) => {
      freigeben = resolve;
    });
    let arbeiten = 0;
    const arbeit = async () => {
      arbeiten += 1;
      await warten;
      return "fertig";
    };
    const erster = cronLaufMitSperre(tenantId, "pruef-parallel", arbeit);
    // Kurz warten, bis der erste Lauf die Sperre hält.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const zweiter = await cronLaufMitSperre(tenantId, "pruef-parallel", arbeit);
    freigeben();
    expect(zweiter.status).toBe("gesperrt");
    expect((await erster).status).toBe("gelaufen");
    expect(arbeiten).toBe(1);
  });

  it("M-16: Laufprotokoll – Erfolg und Fehler werden je Cron und Mandant festgehalten, die Sperre wird gelöst", async () => {
    await cronLaufMitSperre(tenantId, "pruef-protokoll", async () => "ok");
    const nachErfolg = await prisma.cronLauf.findUniqueOrThrow({ where: { tenantId_cron: { tenantId, cron: "pruef-protokoll" } } });
    expect(nachErfolg.letzterErfolg).not.toBeNull();
    expect(nachErfolg.laeuftSeit).toBeNull();

    const fehlerLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const ergebnis = await cronLaufMitSperre(tenantId, "pruef-protokoll", async () => {
      throw new TypeError("PRUEF Max Mustermann");
    });
    expect(ergebnis.status).toBe("fehler");
    const nachFehler = await prisma.cronLauf.findUniqueOrThrow({ where: { tenantId_cron: { tenantId, cron: "pruef-protokoll" } } });
    expect(nachFehler.letzterFehler).toBe("TypeError");
    expect(nachFehler.laeuftSeit).toBeNull();
    // Keine Inhalte aus der Fehlermeldung im Log (könnten Personendaten enthalten).
    for (const aufruf of fehlerLog.mock.calls) expect(JSON.stringify(aufruf)).not.toContain("Mustermann");
  });

  it("M-16 Punkt 3 (S3-011, R2-3): 'Plan für morgen' wird zu Beginn beansprucht – ein zweiter Takt läuft nicht", async () => {
    const heute = datumIso(new Date());
    const [a, b] = await Promise.all([planFuerMorgenBeanspruchen(tenantId, heute), planFuerMorgenBeanspruchen(tenantId, heute)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(await planFuerMorgenBeanspruchen(tenantId, heute)).toBe(false);
    expect(await planFuerMorgenBeanspruchen(tenantId, tagVerschieben(heute, 1))).toBe(true);
  });

  it("M-16: planFuerMorgen – eine Fahrt, deren Vorschlagsrechnung wirft, hält die übrigen nicht auf", async () => {
    const morgen = tagVerschieben(datumIso(new Date()), 1);
    const ort = await prisma.place.create({
      data: { tenantId, label: "PRUEF Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
    });
    const passenger = await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Plan", phones: [] } });
    const vehicle = await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-P-${kennung}` } });
    const user = await prisma.user.create({
      data: { id: randomUUID(), tenantId, email: `pruef-${randomUUID()}@test.invalid`, name: "PRUEF", role: "FAHRER" },
    });
    const driver = await prisma.driver.create({ data: { tenantId, userId: user.id } });
    const tagStart = berlinerMitternacht(morgen);
    await prisma.shift.create({
      data: { tenantId, driverId: driver.id, vehicleId: vehicle.id, start: tagStart, end: new Date(tagStart.getTime() + 23 * 3600_000) },
    });
    const fahrten: string[] = [];
    for (const stunde of [7, 8, 9, 10, 11]) {
      const r = await prisma.ride.create({
        data: {
          tenantId, passengerId: passenger.id, pickupPlaceId: ort.id, dropoffPlaceId: ort.id,
          pickupAt: new Date(tagStart.getTime() + stunde * 3600_000), transportType: "SITZEND", status: "ERFASST", source: "MANUELL",
        },
      });
      fahrten.push(r.id);
    }
    // Die Vorschlagsrechnung fragt die Fahrzeit der Fahrt selbst mit departAt = Abholzeit ab. Bei
    // der dritten Fahrt (09:00) wirft das Routing einmal – wie ein unerwarteter Fehler mitten im Lauf.
    const dritteAbholung = new Date(tagStart.getTime() + 9 * 3600_000).getTime();
    const echteFahrzeit = routingProvider.travelTimeMinutes.bind(routingProvider);
    let geworfen = false;
    vi.spyOn(routingProvider, "travelTimeMinutes").mockImplementation(async (von, nach, abfahrt) => {
      if (!geworfen && abfahrt.getTime() === dritteAbholung) {
        geworfen = true;
        throw new Error("PRUEF Routing kaputt");
      }
      return echteFahrzeit(von, nach, abfahrt);
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const ergebnis = await planFuerMorgenBerechnen(tenantId);
    expect(geworfen).toBe(true);
    expect(ergebnis.geprueft).toBe(5);
    expect(ergebnis.fehler).toBe(1);
    // Fahrten 4 und 5 (10:00, 11:00) wurden trotzdem bearbeitet; Fahrt 3 trägt den Vermerk.
    const nachher = await prisma.ride.findMany({ where: { id: { in: fahrten } }, select: { id: true, status: true, autoSkipReason: true } });
    const nach = new Map(nachher.map((r) => [r.id, r]));
    expect(nach.get(fahrten[3])?.status).not.toBe("ERFASST");
    expect(nach.get(fahrten[4])?.status).not.toBe("ERFASST");
    expect(nach.get(fahrten[2])?.autoSkipReason).toBeTruthy();
  });

  it("M-16 Punkt 4: kein erfolgreicher Automodus-Lauf seit über 15 Minuten → genau ein Alarm an den Inhaber", async () => {
    await prisma.cronLauf.upsert({
      where: { tenantId_cron: { tenantId, cron: "automodus" } },
      create: { tenantId, cron: "automodus", letzterErfolg: new Date(Date.now() - 20 * 60_000) },
      update: { letzterErfolg: new Date(Date.now() - 20 * 60_000), alarmGesendetAm: null },
    });
    const senden = vi.spyOn(smsProvider, "send");
    const erster = await cronUeberwachen(tenantId);
    const zweiter = await cronUeberwachen(tenantId);
    expect(erster.alarme).toBe(1);
    expect(zweiter.alarme).toBe(0);
    expect(senden).toHaveBeenCalledTimes(1);
    expect(String(senden.mock.calls[0][1])).not.toMatch(/PRUEF/);
  });

  it("M-16 Punkt 4: frischer Lauf → kein Alarm; Automodus aus → kein Alarm für den Automodus", async () => {
    await prisma.cronLauf.update({
      where: { tenantId_cron: { tenantId, cron: "automodus" } },
      data: { letzterErfolg: new Date(), alarmGesendetAm: null },
    });
    expect((await cronUeberwachen(tenantId)).alarme).toBe(0);
    await prisma.cronLauf.update({
      where: { tenantId_cron: { tenantId, cron: "automodus" } },
      data: { letzterErfolg: new Date(Date.now() - 60 * 60_000), alarmGesendetAm: null },
    });
    await prisma.tenantSettings.update({ where: { tenantId }, data: { autoMode: "AUS" } });
    expect((await cronUeberwachen(tenantId)).alarme).toBe(0);
    await prisma.tenantSettings.update({ where: { tenantId }, data: { autoMode: "IMMER" } });
  });

  it("M-16 Punkt 4: fehlgeschlagener 'Plan für morgen' → einmal Alarm an den Inhaber", async () => {
    await prisma.cronLauf.update({ where: { tenantId_cron: { tenantId, cron: "automodus" } }, data: { letzterErfolg: new Date() } });
    await prisma.cronLauf.upsert({
      where: { tenantId_cron: { tenantId, cron: "planFuerMorgen" } },
      create: { tenantId, cron: "planFuerMorgen", letzterFehler: "TypeError", letzterFehlerAm: new Date() },
      update: { letzterFehler: "TypeError", letzterFehlerAm: new Date(), alarmGesendetAm: null },
    });
    const senden = vi.spyOn(smsProvider, "send");
    expect((await cronUeberwachen(tenantId)).alarme).toBe(1);
    expect((await cronUeberwachen(tenantId)).alarme).toBe(0);
    expect(String(senden.mock.calls[0][1])).toContain("Plan für morgen");
  });

  it("M-16 Punkt 5: ein Mandant, der wirft, hält die anderen nicht auf", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const gelaufen: string[] = [];
    const ergebnis = await fuerAlleMandanten(["a", "b", "c"], async (id) => {
      if (id === "b") throw new Error("PRUEF");
      gelaufen.push(id);
      return id;
    });
    expect(gelaufen).toEqual(["a", "c"]);
    expect(ergebnis.map((e) => e.status)).toEqual(["ok", "fehler", "ok"]);
  });
});
