import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testSitzung } from "../hilfen/sitzungsMock";
import { fahrzeugZuweisen } from "@/core/disposition/zuweisen";
import { fahrtVerschieben, fahrzeugWaehlen } from "@/app/dispo/fahrten/actions";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth", async () => (await import("../hilfen/sitzungsMock")).authMock);

/**
 * Maßnahme M-72 (Prüfbericht Durchgang 4, S1-008): Ein Disponent konnte im Fahrt-Fenster ein
 * Fahrzeug wählen, für das zur Abholzeit keine Schicht läuft, dessen Fahrer "Ich falle aus"
 * gedrückt hat, Pause hat oder deaktiviert ist. Die Fahrt stand danach auf DISPONIERT ohne Fahrer:
 * keine Push, keine Bestätigungs-SMS, kein Alarm, und sie fehlte in "Braucht Sie".
 *
 * Regel jetzt: DISPONIERT nur mit Fahrzeug UND einsatzfähigem Fahrer (in Schicht, nicht
 * ausgefallen, nicht in Pause, aktiv). Sonst klare Fehlermeldung, die Fahrt bleibt, wie sie war.
 */
describe("fahrzeugZuweisen – nur mit einsatzfähigem Fahrer (M-72, S1-008)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let userId: string;
  let ortA: string;
  let ortB: string;
  let passengerId: string;
  // Abholungen ab "in 8 Stunden", je Fahrt 2 Stunden später (keine Fahrzeugkonflikte untereinander);
  // Schichten laufen von "in 1 Stunde" bis "in 47 Stunden".
  const abholung = new Date(Date.now() + 8 * 60 * 60_000);
  const schichtStart = new Date(Date.now() + 1 * 60 * 60_000);
  const schichtEnde = new Date(Date.now() + 47 * 60 * 60_000);
  let fahrtZaehler = 0;

  let fahrzeugMitSchicht: string;
  let fahrerMitSchicht: string;
  let fahrzeugOhneSchicht: string;
  let fahrzeugAusgefallen: string;
  let fahrzeugPause: string;
  let fahrzeugDeaktiviert: string;
  let fahrzeugErsatz: string;
  let fahrerErsatz: string;

  async function fahrer(name: string, active = true) {
    const user = await prisma.user.create({
      data: { id: randomUUID(), tenantId, email: `pruef-${randomUUID()}@test.invalid`, name: `PRUEF ${name}`, role: "FAHRER" },
    });
    return (await prisma.driver.create({ data: { tenantId, userId: user.id, active } })).id;
  }

  async function fahrzeug(kuerzel: string) {
    return (await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-${kuerzel}-${kennung}` } })).id;
  }

  async function schicht(driverId: string, vehicleId: string, extra: { unavailable?: boolean; onBreak?: boolean } = {}) {
    await prisma.shift.create({ data: { tenantId, driverId, vehicleId, start: schichtStart, end: schichtEnde, ...extra } });
  }

  async function fahrt(status: "ERFASST" | "VORGESCHLAGEN" = "ERFASST") {
    return prisma.ride.create({
      data: {
        tenantId,
        passengerId,
        pickupPlaceId: ortA,
        dropoffPlaceId: ortB,
        pickupAt: new Date(abholung.getTime() + fahrtZaehler++ * 2 * 60 * 60_000),
        transportType: "SITZEND",
        status,
        source: "MANUELL",
      },
    });
  }

  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: `PRUEF_ZuweisungFahrer ${kennung}` } })).id;
    userId = randomUUID();
    await prisma.user.create({ data: { id: userId, tenantId, email: `pruef-${userId}@test.invalid`, name: "PRUEF Dispo", role: "DISPONENT" } });
    ortA = (
      await prisma.place.create({
        data: { tenantId, label: "PRUEF Ort A", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
      })
    ).id;
    ortB = (
      await prisma.place.create({
        data: { tenantId, label: "PRUEF Ort B", street: "B 1", zip: "52062", city: "Aachen", lat: 50.8, lng: 6.1, type: "SONSTIGES" },
      })
    ).id;
    passengerId = (await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Fahrgast", phones: [] } })).id;

    fahrzeugMitSchicht = await fahrzeug("OK");
    fahrerMitSchicht = await fahrer("Im Dienst");
    await schicht(fahrerMitSchicht, fahrzeugMitSchicht);

    fahrzeugOhneSchicht = await fahrzeug("LEER");

    fahrzeugAusgefallen = await fahrzeug("AUS");
    await schicht(await fahrer("Ausgefallen"), fahrzeugAusgefallen, { unavailable: true });

    fahrzeugPause = await fahrzeug("PAUSE");
    await schicht(await fahrer("Pause"), fahrzeugPause, { onBreak: true });

    fahrzeugDeaktiviert = await fahrzeug("DEAKT");
    await schicht(await fahrer("Deaktiviert", false), fahrzeugDeaktiviert);

    // Ersatzfall: Fahrer A ist auf diesem Fahrzeug ausgefallen, Fahrer B hat die Ersatzschicht.
    fahrzeugErsatz = await fahrzeug("ERSATZ");
    await schicht(await fahrer("Ersatz A"), fahrzeugErsatz, { unavailable: true });
    fahrerErsatz = await fahrer("Ersatz B");
    await schicht(fahrerErsatz, fahrzeugErsatz);

    testSitzung.wert = { tenantId, userId, role: "DISPONENT" };
  });

  afterAll(async () => {
    testSitzung.wert = null;
    await mandantKomplettLoeschen(tenantId);
  });

  async function stand(rideId: string) {
    const r = await prisma.ride.findUniqueOrThrow({ where: { id: rideId } });
    const ereignisse = await prisma.rideStatusEvent.count({ where: { rideId, status: "DISPONIERT" } });
    return { status: r.status, vehicleId: r.vehicleId, driverId: r.driverId, disponiertEreignisse: ereignisse };
  }

  it("S1-008: Fahrzeug mit gültiger Schicht → DISPONIERT mit dem Fahrer aus der Schicht", async () => {
    const r = await fahrt();
    await fahrzeugZuweisen(tenantId, r.id, fahrzeugMitSchicht, { dispatchMode: "MANUELL", userId });
    expect(await stand(r.id)).toEqual({ status: "DISPONIERT", vehicleId: fahrzeugMitSchicht, driverId: fahrerMitSchicht, disponiertEreignisse: 1 });
  });

  it.each([
    ["ohne Schicht zur Abholzeit", () => fahrzeugOhneSchicht, /nicht im Dienst/],
    ["dessen Fahrer \"Ich falle aus\" gedrückt hat", () => fahrzeugAusgefallen, /ausgefallen/],
    ["dessen Fahrer Pause hat", () => fahrzeugPause, /Pause/],
    ["dessen Fahrer deaktiviert ist", () => fahrzeugDeaktiviert, /deaktiviert/],
  ])("S1-008: Fahrzeug %s → Fehler, Fahrt bleibt ERFASST ohne Fahrzeug und Fahrer, kein DISPONIERT-Ereignis", async (_, vehicleId, meldung) => {
    const r = await fahrt();
    await expect(fahrzeugZuweisen(tenantId, r.id, vehicleId(), { dispatchMode: "MANUELL", userId })).rejects.toThrow(meldung);
    expect(await stand(r.id)).toEqual({ status: "ERFASST", vehicleId: null, driverId: null, disponiertEreignisse: 0 });
  });

  it("S1-008: Ersatzschicht – Fahrer A ausgefallen, Fahrer B auf demselben Fahrzeug → B wird zugewiesen", async () => {
    const r = await fahrt();
    await fahrzeugZuweisen(tenantId, r.id, fahrzeugErsatz, { dispatchMode: "MANUELL", userId });
    expect(await stand(r.id)).toMatchObject({ status: "DISPONIERT", vehicleId: fahrzeugErsatz, driverId: fahrerErsatz });
  });

  it("S1-008: Fahrt-Fenster „Fahrzeug ändern“ (fahrzeugWaehlen) meldet {ok:false, grund} statt still zu disponieren", async () => {
    const r = await fahrt("VORGESCHLAGEN");
    const ergebnis = await fahrzeugWaehlen(r.id, fahrzeugOhneSchicht);
    expect(ergebnis.ok).toBe(false);
    if (!ergebnis.ok) expect(ergebnis.grund).toMatch(/nicht im Dienst/);
    expect(await stand(r.id)).toEqual({ status: "VORGESCHLAGEN", vehicleId: null, driverId: null, disponiertEreignisse: 0 });
  });

  it("S1-008: Ziehen im Zeitstrahl (fahrtVerschieben) auf ein Fahrzeug ohne Schicht lässt die bisherige Zuweisung unberührt", async () => {
    const r = await fahrt();
    await fahrzeugZuweisen(tenantId, r.id, fahrzeugMitSchicht, { dispatchMode: "MANUELL", userId });

    const ergebnis = await fahrtVerschieben(r.id, { neuesFahrzeugId: fahrzeugOhneSchicht });
    expect(ergebnis.ok).toBe(false);
    if (!ergebnis.ok) expect(ergebnis.grund).toMatch(/nicht im Dienst/);
    // Weder "disponiert ohne Fahrer" noch "erfasst mit altem Fahrzeug": alles wie vorher.
    expect(await stand(r.id)).toEqual({ status: "DISPONIERT", vehicleId: fahrzeugMitSchicht, driverId: fahrerMitSchicht, disponiertEreignisse: 1 });
    // Der bisherige Fahrer hat die Fahrt nicht verloren – also auch keine "entzogen"-Meldung.
    expect(await prisma.notification.count({ where: { rideId: r.id, kind: "FAHRT_ENTZOGEN" } })).toBe(0);
  });

  describe("Datenbank sichert die Regel selbst ab (wie M-11)", () => {
    it("S1-008 (DB): roher Insert einer DISPONIERT-Fahrt ohne Fahrer oder ohne Fahrzeug wird abgelehnt", async () => {
      const basis = { tenantId, passengerId, pickupPlaceId: ortA, dropoffPlaceId: ortB, transportType: "SITZEND", status: "DISPONIERT", source: "MANUELL" } as const;
      await expect(prisma.ride.create({ data: { ...basis, pickupAt: abholung, vehicleId: fahrzeugMitSchicht } })).rejects.toThrow(/DISPONIERT_OHNE_FAHRER/);
      await expect(prisma.ride.create({ data: { ...basis, pickupAt: abholung, driverId: fahrerMitSchicht } })).rejects.toThrow(/DISPONIERT_OHNE_FAHRER/);
      expect(await prisma.ride.count({ where: { tenantId, status: "DISPONIERT", OR: [{ vehicleId: null }, { driverId: null }] } })).toBe(0);
    });

    it("S1-008 (DB): Statuswechsel nach DISPONIERT ohne Fahrer und Fahrer-Lösen im Status DISPONIERT werden abgelehnt", async () => {
      const r = await fahrt();
      await expect(prisma.ride.update({ where: { id: r.id }, data: { status: "DISPONIERT", vehicleId: fahrzeugMitSchicht } })).rejects.toThrow(
        /DISPONIERT_OHNE_FAHRER/,
      );

      await fahrzeugZuweisen(tenantId, r.id, fahrzeugMitSchicht, { dispatchMode: "MANUELL", userId });
      await expect(prisma.ride.update({ where: { id: r.id }, data: { driverId: null } })).rejects.toThrow(/DISPONIERT_OHNE_FAHRER/);
      await expect(prisma.ride.update({ where: { id: r.id }, data: { vehicleId: null } })).rejects.toThrow(/DISPONIERT_OHNE_FAHRER/);
      expect(await stand(r.id)).toMatchObject({ status: "DISPONIERT", vehicleId: fahrzeugMitSchicht, driverId: fahrerMitSchicht });
    });

    it("S1-008 (DB): der gültige Weg – erst zurück auf ERFASST, dann Fahrzeug und Fahrer lösen – bleibt erlaubt", async () => {
      const r = await fahrt();
      await fahrzeugZuweisen(tenantId, r.id, fahrzeugMitSchicht, { dispatchMode: "MANUELL", userId });
      await prisma.ride.update({ where: { id: r.id }, data: { status: "ERFASST" } });
      await prisma.ride.update({ where: { id: r.id }, data: { vehicleId: null, driverId: null } });
      expect(await stand(r.id)).toMatchObject({ status: "ERFASST", vehicleId: null, driverId: null });
    });
  });
});
