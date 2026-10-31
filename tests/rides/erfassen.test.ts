import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fahrtErfassen, rueckfahrtAbholzeit, RUECKFAHRT_PLATZHALTER_MINUTEN } from "@/core/rides/erfassen";
import { fahrtSchema } from "@/core/rides/validation";
import { berlinerMitternacht, mitUhrzeit } from "@/core/shifts/week";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/**
 * Maßnahme M-07: Rückfahrt richtig anlegen – "Zeit offen" (Prüfbericht S1-005), über Mitternacht
 * (docs/13 R1-3), Doppelbuchungs-Ausnahme über die Fahrt-ID statt den Zeitwert (R1-2).
 */
describe("rueckfahrtAbholzeit (M-07)", () => {
  const tag = berlinerMitternacht("2026-11-10");

  it("R1-3: Rückfahrtzeit vor der Hinfahrtzeit heißt Folgetag", () => {
    const hin = mitUhrzeit(tag, "23:30");
    const rueck = rueckfahrtAbholzeit(tag, hin, "00:15");
    expect(rueck.zeitOffen).toBe(false);
    expect(rueck.pickupAt.getTime()).toBeGreaterThan(hin.getTime());
    expect(rueck.pickupAt.toISOString()).toBe(mitUhrzeit(berlinerMitternacht("2026-11-11"), "00:15").toISOString());
  });

  it("S1-005: ohne Uhrzeit gibt es einen Platzhalter nach der Hinfahrt und das Kennzeichen 'Zeit offen'", () => {
    const hin = mitUhrzeit(tag, "08:00");
    const rueck = rueckfahrtAbholzeit(tag, hin, undefined);
    expect(rueck.zeitOffen).toBe(true);
    expect(rueck.pickupAt.getTime()).toBe(hin.getTime() + RUECKFAHRT_PLATZHALTER_MINUTEN * 60_000);
  });

  it("Validierung: Uhrzeiten müssen HH:MM sein, leere Rückfahrtzeit bleibt erlaubt", () => {
    const basis = {
      passengerId: "p", pickupPlaceId: "a", dropoffPlaceId: "b", datum: "2026-11-10", abholzeit: "08:00",
      rueckfahrt: true, transportType: "SITZEND", companion: false, prescription: "JA", approval: "JA",
    } as const;
    expect(fahrtSchema.safeParse({ ...basis, rueckfahrtzeit: "" }).success).toBe(true);
    expect(fahrtSchema.safeParse({ ...basis, rueckfahrtzeit: "abc" }).success).toBe(false);
    expect(fahrtSchema.safeParse({ ...basis, abholzeit: "25:00" }).success).toBe(false);
  });
});

describe("fahrtErfassen – Rückfahrt (M-07)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let passengerId: string;
  let ortA: string;
  let ortB: string;

  beforeAll(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: {
          name: `PRUEF_Rueckfahrt ${kennung}`,
          settings: { create: { greeting: "x", voiceId: "x", escalationNumber: "+4900", openingHours: {}, serviceAreaCenter: { lat: 50.77, lng: 6.08 } } },
        },
      })
    ).id;
    passengerId = (await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Dialyse", phones: [] } })).id;
    ortA = (
      await prisma.place.create({
        data: { tenantId, label: "Wohnung", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "WOHNUNG" },
      })
    ).id;
    ortB = (
      await prisma.place.create({
        data: { tenantId, label: "Dialyse", street: "B 1", zip: "52062", city: "Aachen", lat: 50.78, lng: 6.09, type: "DIALYSE" },
      })
    ).id;
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  const basis = {
    pickupPlaceId: "",
    dropoffPlaceId: "",
    terminzeit: "",
    transportType: "SITZEND" as const,
    companion: false,
    assistanceNotes: "",
    prescription: "JA" as const,
    approval: "NICHT_NOETIG" as const,
  };

  it("S1-005: rueckfahrt: true ohne Zeit → zwei Fahrten, die zweite mit Problem 'Zeit offen' und Rückbezug", async () => {
    const ergebnis = await fahrtErfassen(
      tenantId,
      { ...basis, passengerId, pickupPlaceId: ortA, dropoffPlaceId: ortB, datum: "2026-11-10", abholzeit: "07:00", rueckfahrt: true, rueckfahrtzeit: "" },
      { source: "ANRUF" },
    );
    expect(ergebnis.rueckfahrtRideId).toBeTruthy();
    expect(ergebnis.rueckfahrtZeitOffen).toBe(true);
    const rueck = await prisma.ride.findUniqueOrThrow({ where: { id: ergebnis.rueckfahrtRideId! } });
    expect(rueck.returnOfId).toBe(ergebnis.rideId);
    expect(rueck.returnTimeOpen).toBe(true);
    expect(rueck.problems).toContain("RUECKFAHRT_ZEIT_OFFEN");
    expect(rueck.pickupPlaceId).toBe(ortB);
    expect(rueck.dropoffPlaceId).toBe(ortA);
    const hin = await prisma.ride.findUniqueOrThrow({ where: { id: ergebnis.rideId } });
    expect(rueck.pickupAt.getTime()).toBeGreaterThan(hin.pickupAt.getTime());
  });

  it("R1-3: Hinfahrt 23:30 / Rückfahrt 00:15 → Rückfahrt am Folgetag", async () => {
    const ergebnis = await fahrtErfassen(
      tenantId,
      { ...basis, passengerId, pickupPlaceId: ortA, dropoffPlaceId: ortB, datum: "2026-11-12", abholzeit: "23:30", rueckfahrt: true, rueckfahrtzeit: "00:15" },
      { source: "MANUELL" },
    );
    const rueck = await prisma.ride.findUniqueOrThrow({ where: { id: ergebnis.rueckfahrtRideId! } });
    expect(rueck.pickupAt.toISOString()).toBe(mitUhrzeit(berlinerMitternacht("2026-11-13"), "00:15").toISOString());
    expect(rueck.returnTimeOpen).toBe(false);
    expect(rueck.problems).not.toContain("RUECKFAHRT_ZEIT_OFFEN");
  });

  it("R1-2: eine unabhängige Fahrt zur exakt selben Uhrzeit wie die Hinfahrt bleibt für die Rückfahrt eine DOPPELBUCHUNG", async () => {
    // Bestehende echte Fahrt um 09:00 am 20.11.
    await fahrtErfassen(
      tenantId,
      { ...basis, passengerId, pickupPlaceId: ortA, dropoffPlaceId: ortB, datum: "2026-11-20", abholzeit: "09:00", rueckfahrt: false, rueckfahrtzeit: "" },
      { source: "MANUELL" },
    );
    // Neue Bestellung: Hinfahrt ebenfalls 09:00 (bewusst eine Doppelbuchung), Rückfahrt 09:30.
    const ergebnis = await fahrtErfassen(
      tenantId,
      { ...basis, passengerId, pickupPlaceId: ortA, dropoffPlaceId: ortB, datum: "2026-11-20", abholzeit: "09:00", rueckfahrt: true, rueckfahrtzeit: "09:30" },
      { source: "MANUELL" },
    );
    expect(ergebnis.probleme).toContain("DOPPELBUCHUNG");
    // Vorher wurde nach dem Zeitwert gefiltert: die bestehende 09:00-Fahrt verschwand mit der
    // Hinfahrt aus der Prüfung, die Rückfahrt um 09:30 galt fälschlich als konfliktfrei.
    expect(ergebnis.rueckfahrtProbleme).toContain("DOPPELBUCHUNG");
  });

  it("die eigene Hinfahrt zählt für die Rückfahrt weiterhin nicht als Doppelbuchung", async () => {
    const ergebnis = await fahrtErfassen(
      tenantId,
      { ...basis, passengerId, pickupPlaceId: ortA, dropoffPlaceId: ortB, datum: "2026-11-25", abholzeit: "10:00", rueckfahrt: true, rueckfahrtzeit: "10:40" },
      { source: "MANUELL" },
    );
    expect(ergebnis.probleme).toEqual([]);
    expect(ergebnis.rueckfahrtProbleme).toEqual([]);
  });
});
