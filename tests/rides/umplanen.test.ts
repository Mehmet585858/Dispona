import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testSitzung } from "../hilfen/sitzungsMock";
import { fahrtErfassen } from "@/core/rides/erfassen";
import { fahrtAendern } from "@/core/rides/aendern";
import { fahrerFaelltAusKern } from "@/core/rides/fahrerAusfall";
import { fahrzeugZuweisen } from "@/core/disposition/zuweisen";
import { berlinerMitternacht, datumIso, tagVerschieben } from "@/core/shifts/week";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth", async () => (await import("../hilfen/sitzungsMock")).authMock);

/**
 * Maßnahme M-20 (docs/13 R2-4, R2-5, R2-6, R2-9; Prüfbericht S3-004): Umplanen und Umbesetzen.
 * Vorschlag bleibt Vorschlag, alte Zuweisung wird gelöscht, Probleme werden neu berechnet statt
 * nur ergänzt, und eine Änderung ergibt genau eine Push je Fahrer.
 */
describe("Umplanen und Umbesetzen (M-20)", () => {
  const kennung = randomUUID().slice(0, 8);
  const morgen = tagVerschieben(datumIso(new Date()), 1);
  let tenantId: string;
  let adminId: string;
  let passengerId: string;
  let ortA: string;
  let ortB: string;
  const fahrzeug: string[] = [];
  const fahrer: string[] = [];

  async function neueFahrt(abholzeit: string) {
    const { rideId } = await fahrtErfassen(
      tenantId,
      {
        passengerId,
        pickupPlaceId: ortA,
        dropoffPlaceId: ortB,
        datum: morgen,
        abholzeit,
        terminzeit: "",
        rueckfahrt: false,
        rueckfahrtzeit: "",
        transportType: "SITZEND",
        companion: false,
        assistanceNotes: "",
        prescription: "JA",
        approval: "NICHT_NOETIG",
      },
      { source: "MANUELL" },
    );
    return rideId;
  }

  async function pushes(rideId: string) {
    return prisma.notification.findMany({ where: { rideId, channel: "PUSH" }, select: { toRef: true, kind: true } });
  }

  beforeAll(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: {
          name: `PRUEF_Umplanen ${kennung}`,
          settings: {
            create: {
              greeting: "x", voiceId: "x", escalationNumber: "+4900", openingHours: {},
              serviceAreaCenter: { lat: 50.77, lng: 6.08 },
              depotAddress: { street: "Hof 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08 },
            },
          },
        },
      })
    ).id;
    adminId = (
      await prisma.user.create({
        data: { id: randomUUID(), tenantId, email: `pruef-${randomUUID()}@test.invalid`, name: "PRUEF Büro", role: "ADMIN" },
      })
    ).id;
    passengerId = (await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Umplanen", phones: [] } })).id;
    const ort = (lat: number) =>
      prisma.place.create({
        data: { tenantId, label: "PRUEF Ort", street: "A 1", zip: "52062", city: "Aachen", lat, lng: 6.08, type: "SONSTIGES" },
      });
    ortA = (await ort(50.77)).id;
    ortB = (await ort(50.78)).id;
    const tagStart = berlinerMitternacht(morgen);
    for (const n of [1, 2]) {
      const v = await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-U${n}-${kennung}` } });
      const u = await prisma.user.create({
        data: { id: randomUUID(), tenantId, email: `pruef-${randomUUID()}@test.invalid`, name: `PRUEF F${n}`, role: "FAHRER" },
      });
      const d = await prisma.driver.create({ data: { tenantId, userId: u.id } });
      await prisma.shift.create({
        data: { tenantId, driverId: d.id, vehicleId: v.id, start: tagStart, end: new Date(tagStart.getTime() + 23 * 3600_000) },
      });
      fahrzeug.push(v.id);
      fahrer.push(d.id);
    }
    testSitzung.wert = { tenantId, userId: adminId, role: "ADMIN" };
  });

  afterAll(async () => {
    testSitzung.wert = null;
    await mandantKomplettLoeschen(tenantId);
  });

  it("M-20 (R2-4): Zeitverschiebung eines Vorschlags in derselben Zeile → bleibt VORGESCHLAGEN, kein Fahrzeug, keine Push", async () => {
    const { fahrtVerschieben } = await import("@/app/dispo/fahrten/actions");
    const rideId = await neueFahrt("08:00");
    const vorher = await prisma.ride.findUniqueOrThrow({ where: { id: rideId }, include: { suggestions: true } });
    expect(vorher.status).toBe("VORGESCHLAGEN");
    const zeile = (vorher.suggestions[0].options as { vehicleId: string }[])[0].vehicleId;

    const ergebnis = await fahrtVerschieben(rideId, { neueAbholzeit: "08:30", neuesFahrzeugId: zeile });
    expect(ergebnis.ok).toBe(true);

    const nachher = await prisma.ride.findUniqueOrThrow({ where: { id: rideId } });
    expect(nachher.status).toBe("VORGESCHLAGEN");
    expect(nachher.vehicleId).toBeNull();
    expect(await pushes(rideId)).toEqual([]);
  });

  it("M-20 (R2-5): Fahrerausfall → Fahrzeug und Fahrer werden von der Fahrt genommen", async () => {
    const rideId = await neueFahrt("10:00");
    await fahrzeugZuweisen(tenantId, rideId, fahrzeug[0], { dispatchMode: "MANUELL" });
    const tagStart = berlinerMitternacht(morgen);
    await fahrerFaelltAusKern(tenantId, fahrer[0], tagStart, new Date(tagStart.getTime() + 24 * 3600_000));

    const nachher = await prisma.ride.findUniqueOrThrow({ where: { id: rideId } });
    expect(nachher.vehicleId).toBeNull();
    expect(nachher.driverId).toBeNull();
    expect(nachher.driverAckAt).toBeNull();
    expect(nachher.problems).toContain("Fahrer fällt aus");

    // R2-6: nach Neubesetzung ist der überholte Grund weg.
    await prisma.shift.updateMany({ where: { driverId: fahrer[0] }, data: { unavailable: false } });
    await fahrzeugZuweisen(tenantId, rideId, fahrzeug[1], { dispatchMode: "MANUELL" });
    const neu = await prisma.ride.findUniqueOrThrow({ where: { id: rideId } });
    expect(neu.problems).toEqual([]);
  });

  it("M-20 (R2-6): fahrtAendern auf einer PROBLEM-Fahrt rechnet die Probleme neu und führt zurück in die Vorschlagsrechnung", async () => {
    const rideId = await neueFahrt("12:00");
    await prisma.ride.update({ where: { id: rideId }, data: { status: "PROBLEM", problems: ["Fahrer fällt aus", "KEIN_FAHRZEUG"] } });
    const ergebnis = await fahrtAendern(tenantId, rideId, { abholzeit: "12:30" });
    expect(ergebnis.ok).toBe(true);
    const nachher = await prisma.ride.findUniqueOrThrow({ where: { id: rideId } });
    expect(nachher.status).toBe("VORGESCHLAGEN");
    expect(nachher.problems).toEqual([]);
  });

  it("M-20 (S3-004): Adressänderung einer disponierten Fahrt → Zuweisung weg, Fahrer bekommt genau 'entzogen'", async () => {
    const rideId = await neueFahrt("14:00");
    await fahrzeugZuweisen(tenantId, rideId, fahrzeug[0], { dispatchMode: "MANUELL" });
    await prisma.notification.deleteMany({ where: { rideId } });

    await fahrtAendern(tenantId, rideId, { dropoffPlaceId: ortA });
    const nachher = await prisma.ride.findUniqueOrThrow({ where: { id: rideId } });
    expect(nachher.vehicleId).toBeNull();
    expect(nachher.driverId).toBeNull();
    expect(nachher.status).not.toBe("DISPONIERT");
    expect(await pushes(rideId)).toEqual([{ toRef: fahrer[0], kind: "FAHRT_ENTZOGEN" }]);
  });

  it("M-20 (R2-9): kombinierte Zeit- und Fahrzeug-Verschiebung → genau eine Push je Fahrer", async () => {
    const { fahrtVerschieben } = await import("@/app/dispo/fahrten/actions");
    const rideId = await neueFahrt("16:00");
    await fahrzeugZuweisen(tenantId, rideId, fahrzeug[0], { dispatchMode: "MANUELL" });
    await prisma.notification.deleteMany({ where: { rideId } });

    const ergebnis = await fahrtVerschieben(rideId, { neueAbholzeit: "16:30", neuesFahrzeugId: fahrzeug[1] });
    expect(ergebnis.ok).toBe(true);
    const nachher = await prisma.ride.findUniqueOrThrow({ where: { id: rideId } });
    expect(nachher.status).toBe("DISPONIERT");
    expect(nachher.vehicleId).toBe(fahrzeug[1]);
    const liste = await pushes(rideId);
    expect(liste.filter((p) => p.toRef === fahrer[0])).toEqual([{ toRef: fahrer[0], kind: "FAHRT_ENTZOGEN" }]);
    expect(liste.filter((p) => p.toRef === fahrer[1])).toEqual([{ toRef: fahrer[1], kind: "NEUE_FAHRT" }]);
  });

  it("M-20: Zeitverschiebung einer disponierten Fahrt in derselben Zeile → bleibt beim Fahrzeug, genau eine Push 'geändert'", async () => {
    const { fahrtVerschieben } = await import("@/app/dispo/fahrten/actions");
    const rideId = await neueFahrt("18:00");
    await fahrzeugZuweisen(tenantId, rideId, fahrzeug[0], { dispatchMode: "MANUELL" });
    await prisma.notification.deleteMany({ where: { rideId } });

    const ergebnis = await fahrtVerschieben(rideId, { neueAbholzeit: "18:30", neuesFahrzeugId: fahrzeug[0] });
    expect(ergebnis.ok).toBe(true);
    const nachher = await prisma.ride.findUniqueOrThrow({ where: { id: rideId } });
    expect(nachher.status).toBe("DISPONIERT");
    expect(nachher.vehicleId).toBe(fahrzeug[0]);
    expect(await pushes(rideId)).toEqual([{ toRef: fahrer[0], kind: "FAHRT_GEAENDERT" }]);
  });

  it("M-20: nur ein neuer Hinweis an einer disponierten Fahrt → bleibt disponiert, Fahrer bekommt 'geändert'", async () => {
    const rideId = await neueFahrt("20:00");
    await fahrzeugZuweisen(tenantId, rideId, fahrzeug[0], { dispatchMode: "MANUELL" });
    await prisma.notification.deleteMany({ where: { rideId } });

    await fahrtAendern(tenantId, rideId, { assistanceNotes: "PRUEF Hinweis" });
    const nachher = await prisma.ride.findUniqueOrThrow({ where: { id: rideId } });
    expect(nachher.status).toBe("DISPONIERT");
    expect(nachher.vehicleId).toBe(fahrzeug[0]);
    expect(await pushes(rideId)).toEqual([{ toRef: fahrer[0], kind: "FAHRT_GEAENDERT" }]);
  });
});
