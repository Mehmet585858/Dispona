import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testSitzung } from "../hilfen/sitzungsMock";
import { BesatzungError, fahrzeugZuweisen, KeinFahrerError } from "@/core/disposition/zuweisen";
import { automatischDisponieren } from "@/core/disposition/automatischDisponieren";
import { vorschlagBerechnenUndSpeichern } from "@/core/disposition/vorschlagSpeichern";
import { fahrzeugWaehlen } from "@/app/dispo/fahrten/actions";
import { BESATZUNG_TEXTE } from "@/core/shifts/texte";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth", async () => (await import("../hilfen/sitzungsMock")).authMock);

/**
 * Schichtplan (02.11.2026), Schritt 3: Disposition und Automodus richten sich nach der Besatzung.
 * Liegend nur zu zweit, Tragestuhl über eine Treppe zu zweit (mit Tragestuhl) oder mit Scalamobil
 * und eingewiesenem Fahrer. Manuelle Zuweisung mit klarer Meldung abgelehnt; der Automodus
 * disponiert nie, wenn die Besatzung nicht passt (Sicherheitsbedingung 6).
 */
describe("Zuweisung und Automodus nach Besatzung", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let userId: string;
  let passengerId: string;
  let ortEben: string;
  let ortTreppe: string;
  let liegendAllein: string;
  let liegendZuZweit: string;
  let liegendBeifahrerDeaktiviert: string;
  let btwScalamobil: string;
  let btwScalamobilOhneEinweisung: string;
  let fahrerZuZweit: string;
  const schichtStart = new Date(Date.now() + 60 * 60_000);
  const schichtEnde = new Date(Date.now() + 30 * 60 * 60_000);
  let zaehler = 0;

  async function person(name: string, extra: { active?: boolean; scalamobilEinweisung?: boolean } = {}) {
    const user = await prisma.user.create({
      data: { id: randomUUID(), tenantId, email: `pruef-${randomUUID()}@test.invalid`, name: `PRUEF ${name}`, role: "FAHRER" },
    });
    return (await prisma.driver.create({ data: { tenantId, userId: user.id, ...extra } })).id;
  }

  async function fahrzeugMitSchicht(
    kuerzel: string,
    ausstattung: { stretcher?: boolean; carryChair?: boolean; wheelchairSpots?: number },
    schicht: { driverId: string; beifahrerId?: string; scalamobil?: boolean },
  ) {
    const vehicleId = (await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-${kuerzel}-${kennung}`, seats: 2, ...ausstattung } })).id;
    await prisma.shift.create({ data: { tenantId, vehicleId, start: schichtStart, end: schichtEnde, ...schicht } });
    return vehicleId;
  }

  async function fahrt(transportType: "LIEGEND" | "TRAGESTUHL", ziel: string, status: "ERFASST" | "VORGESCHLAGEN" = "ERFASST") {
    return prisma.ride.create({
      data: {
        tenantId,
        passengerId,
        pickupPlaceId: ortEben,
        dropoffPlaceId: ziel,
        // Je Fahrt 2 Stunden später: keine Konflikte untereinander auf demselben Fahrzeug.
        pickupAt: new Date(schichtStart.getTime() + (1 + zaehler++ * 2) * 60 * 60_000 * 0.5),
        transportType,
        status,
        source: "MANUELL",
        prescription: "JA",
      },
    });
  }

  beforeAll(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: {
          name: `PRUEF_Besatzung ${kennung}`,
          settings: {
            create: {
              greeting: "x",
              voiceId: "x",
              escalationNumber: "+4900",
              openingHours: {},
              serviceAreaCenter: { lat: 50.77, lng: 6.08 },
              depotAddress: { lat: 50.77, lng: 6.08 },
              autoMode: "IMMER",
              autoModeMinMargin: 0,
              scalamobilAnzahl: 2,
            },
          },
        },
      })
    ).id;
    userId = randomUUID();
    await prisma.user.create({ data: { id: userId, tenantId, email: `pruef-${userId}@test.invalid`, name: "PRUEF Dispo", role: "DISPONENT" } });
    passengerId = (await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Fahrgast", phones: [] } })).id;
    const ort = (label: string, treppe: boolean) =>
      prisma.place.create({
        data: { tenantId, label, street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "WOHNUNG", treppe },
      });
    ortEben = (await ort("PRUEF eben", false)).id;
    ortTreppe = (await ort("PRUEF Treppe", true)).id;

    liegendAllein = await fahrzeugMitSchicht("L1", { stretcher: true }, { driverId: await person("Allein") });
    fahrerZuZweit = await person("Zu zweit");
    liegendZuZweit = await fahrzeugMitSchicht("L2", { stretcher: true }, { driverId: fahrerZuZweit, beifahrerId: await person("Beifahrer") });
    liegendBeifahrerDeaktiviert = await fahrzeugMitSchicht(
      "L3",
      { stretcher: true },
      { driverId: await person("Mit Ex"), beifahrerId: await person("Ex Beifahrer", { active: false }) },
    );
    btwScalamobil = await fahrzeugMitSchicht(
      "S1",
      { wheelchairSpots: 1 },
      { driverId: await person("Eingewiesen", { scalamobilEinweisung: true }), scalamobil: true },
    );
    btwScalamobilOhneEinweisung = await fahrzeugMitSchicht("S2", { wheelchairSpots: 1 }, { driverId: await person("Ohne Einweisung"), scalamobil: true });
    testSitzung.wert = { tenantId, userId, role: "DISPONENT" };
  });

  afterAll(async () => {
    testSitzung.wert = null;
    await mandantKomplettLoeschen(tenantId);
  });

  it("Liegend ohne Beifahrer: BesatzungError (ein KeinFahrerError) mit klarer Meldung, Fahrt unverändert", async () => {
    const r = await fahrt("LIEGEND", ortEben);
    const versuch = fahrzeugZuweisen(tenantId, r.id, liegendAllein, { dispatchMode: "MANUELL", userId });
    await expect(versuch).rejects.toBeInstanceOf(BesatzungError);
    await expect(fahrzeugZuweisen(tenantId, r.id, liegendAllein, { dispatchMode: "MANUELL", userId })).rejects.toBeInstanceOf(KeinFahrerError);
    await expect(fahrzeugZuweisen(tenantId, r.id, liegendAllein, { dispatchMode: "MANUELL", userId })).rejects.toThrow(
      BESATZUNG_TEXTE.liegendOhneBeifahrer,
    );
    const danach = await prisma.ride.findUniqueOrThrow({ where: { id: r.id } });
    expect([danach.status, danach.vehicleId, danach.driverId]).toEqual(["ERFASST", null, null]);
  });

  it("Liegend mit Beifahrer: zugewiesen, Fahrt geht an den Fahrer (nicht an den Beifahrer)", async () => {
    const r = await fahrt("LIEGEND", ortEben);
    await fahrzeugZuweisen(tenantId, r.id, liegendZuZweit, { dispatchMode: "MANUELL", userId });
    const danach = await prisma.ride.findUniqueOrThrow({ where: { id: r.id } });
    expect([danach.status, danach.vehicleId, danach.driverId]).toEqual(["DISPONIERT", liegendZuZweit, fahrerZuZweit]);
  });

  it("deaktivierter Beifahrer zählt nicht", async () => {
    const r = await fahrt("LIEGEND", ortEben);
    await expect(fahrzeugZuweisen(tenantId, r.id, liegendBeifahrerDeaktiviert, { dispatchMode: "MANUELL", userId })).rejects.toThrow(
      BESATZUNG_TEXTE.liegendOhneBeifahrer,
    );
  });

  it("Tragestuhl mit Treppe: Scalamobil + Einweisung geht, ohne Einweisung nicht; ebenerdig reicht der BTW allein", async () => {
    const treppe = await fahrt("TRAGESTUHL", ortTreppe);
    await expect(fahrzeugZuweisen(tenantId, treppe.id, btwScalamobilOhneEinweisung, { dispatchMode: "MANUELL", userId })).rejects.toThrow(
      BESATZUNG_TEXTE.treppeScalamobilOhneEinweisung,
    );
    await fahrzeugZuweisen(tenantId, treppe.id, btwScalamobil, { dispatchMode: "MANUELL", userId });
    expect((await prisma.ride.findUniqueOrThrow({ where: { id: treppe.id } })).status).toBe("DISPONIERT");
    const eben = await fahrt("TRAGESTUHL", ortEben);
    await fahrzeugZuweisen(tenantId, eben.id, btwScalamobilOhneEinweisung, { dispatchMode: "MANUELL", userId });
    expect((await prisma.ride.findUniqueOrThrow({ where: { id: eben.id } })).status).toBe("DISPONIERT");
  });

  it("Fahrt-Fenster „Fahrzeug ändern“ (fahrzeugWaehlen) meldet den Grund als {ok:false, grund}", async () => {
    const r = await fahrt("LIEGEND", ortEben, "VORGESCHLAGEN");
    expect(await fahrzeugWaehlen(r.id, liegendAllein)).toEqual({ ok: false, grund: BESATZUNG_TEXTE.liegendOhneBeifahrer });
  });

  it("Vorschlag: Liegend-Fahrt bekommt nur das Fahrzeug mit Beifahrer vorgeschlagen", async () => {
    const r = await fahrt("LIEGEND", ortEben);
    await vorschlagBerechnenUndSpeichern(tenantId, r.id, userId);
    const vorschlag = await prisma.suggestion.findFirstOrThrow({ where: { rideId: r.id } });
    expect((vorschlag.options as { vehicleId: string }[]).map((o) => o.vehicleId)).toEqual([liegendZuZweit]);
  });

  it("Automodus: Sicherheitsbedingung 6 – disponiert nie, wenn die Besatzung nicht passt (Grund steht an der Fahrt)", async () => {
    const r = await fahrt("LIEGEND", ortEben, "VORGESCHLAGEN");
    // Veralteter Vorschlag (z. B. von vor einer Schichtänderung) mit dem Fahrzeug ohne Beifahrer.
    await prisma.suggestion.create({
      data: {
        tenantId,
        rideId: r.id,
        decision: "OFFEN",
        options: [{ vehicleId: liegendAllein, plate: "PRUEF", etaMin: 10, onTime: true, score: 10, reason: "PRUEF" }],
      },
    });
    await automatischDisponieren(tenantId);
    const danach = await prisma.ride.findUniqueOrThrow({ where: { id: r.id } });
    expect(danach.status).toBe("VORGESCHLAGEN");
    expect(danach.vehicleId).toBeNull();
    expect(danach.autoSkipReason).toBe(BESATZUNG_TEXTE.liegendOhneBeifahrer);
  });
});
