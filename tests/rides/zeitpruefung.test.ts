import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fahrtPruefen } from "@/core/rides/pruefungen";
import { fahrtErfassen } from "@/core/rides/erfassen";
import { fahrtSchema, serieSchema } from "@/core/rides/validation";
import { datumIso, tagVerschieben } from "@/core/shifts/week";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

const AACHEN = { lat: 50.7753, lng: 6.0839 };
const JETZT = new Date("2026-11-02T22:40:00Z"); // Montag 23:40 Berlin – das Szenario aus S1-007

function pruefen(pickupAt: Date, appointmentAt?: Date) {
  return fahrtPruefen({
    pickupOrt: AACHEN,
    pickupAt,
    appointmentAt,
    jetzt: JETZT,
    bestehendeAbholzeitenDesFahrgasts: [],
    approval: "NICHT_NOETIG",
    genehmigungen: [],
    serviceAreaCenter: AACHEN,
    serviceAreaKm: 30,
  });
}

/**
 * Maßnahme M-46 Punkt 2 (Prüfbericht S1-007): Die Prüfkette kannte keine Plausibilität der Zeit –
 * eine Fahrt für gestern oder mit Termin vor der Abholung wurde ohne Hinweis angelegt, vorgeschlagen
 * und hätte vom Automodus disponiert werden können.
 */
describe("Zeitprüfung beim Erfassen (M-46, S1-007)", () => {
  it("M-46: Abholung gestern → ABHOLZEIT_VERGANGEN", () => {
    expect(pruefen(new Date("2026-11-01T05:30:00Z"))).toContain("ABHOLZEIT_VERGANGEN");
  });

  it("M-46: Abholung vor wenigen Minuten (sofort-Fahrt) ist kein Problem, eine Stunde vorher schon", () => {
    expect(pruefen(new Date(JETZT.getTime() - 10 * 60_000))).toEqual([]);
    expect(pruefen(new Date(JETZT.getTime() - 60 * 60_000))).toContain("ABHOLZEIT_VERGANGEN");
  });

  it("M-46: Termin vor oder gleich der Abholung → TERMIN_VOR_ABHOLUNG", () => {
    const abholung = new Date("2026-11-03T08:00:00Z");
    expect(pruefen(abholung, new Date("2026-11-03T07:00:00Z"))).toContain("TERMIN_VOR_ABHOLUNG");
    expect(pruefen(abholung, abholung)).toContain("TERMIN_VOR_ABHOLUNG");
    expect(pruefen(abholung, new Date("2026-11-03T08:30:00Z"))).toEqual([]);
  });

  it("M-46 (S2-020): Fahrt- und Serienschema lehnen unmögliche Kalendertage ab, nicht nur falsche Schreibweise", () => {
    const basis = {
      passengerId: "p", pickupPlaceId: "a", dropoffPlaceId: "b", abholzeit: "08:00", terminzeit: "",
      rueckfahrt: false, rueckfahrtzeit: "", transportType: "SITZEND", companion: false,
      prescription: "JA", approval: "NICHT_NOETIG",
    } as const;
    expect(fahrtSchema.safeParse({ ...basis, datum: "2026-02-30" }).success).toBe(false);
    expect(fahrtSchema.safeParse({ ...basis, datum: "2026-11-03" }).success).toBe(true);
    const serie = { ...basis, wochentage: ["MO"] };
    expect(serieSchema.safeParse({ ...serie, bis: "2026-13-45" }).success).toBe(false);
    expect(serieSchema.safeParse({ ...serie, bis: "morgen" }).success).toBe(false);
    expect(serieSchema.safeParse({ ...serie, bis: "2026-12-31" }).success).toBe(true);
  });

  describe("gegen Postgres (Disponenten-Weg)", () => {
    const kennung = randomUUID().slice(0, 8);
    let tenantId: string;
    let passengerId: string;
    let ortA: string;
    let ortB: string;

    beforeAll(async () => {
      tenantId = (
        await prisma.tenant.create({
          data: {
            name: `PRUEF_Zeit ${kennung}`,
            settings: { create: { greeting: "x", voiceId: "x", escalationNumber: "+4900", openingHours: {}, serviceAreaCenter: AACHEN } },
          },
        })
      ).id;
      passengerId = (await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Zeit", phones: [] } })).id;
      ortA = (await prisma.place.create({ data: { tenantId, label: "PRUEF A", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" } })).id;
      ortB = (await prisma.place.create({ data: { tenantId, label: "PRUEF B", street: "B 2", zip: "52062", city: "Aachen", lat: 50.78, lng: 6.09, type: "SONSTIGES" } })).id;
    });

    afterAll(async () => {
      await mandantKomplettLoeschen(tenantId);
    });

    it("M-46: fahrtErfassen für gestern trägt ABHOLZEIT_VERGANGEN – der Automodus fasst sie damit nicht an", async () => {
      const gestern = tagVerschieben(datumIso(new Date()), -1);
      const { rideId, probleme } = await fahrtErfassen(
        tenantId,
        {
          passengerId, pickupPlaceId: ortA, dropoffPlaceId: ortB, datum: gestern, abholzeit: "06:30", terminzeit: "",
          rueckfahrt: false, rueckfahrtzeit: "", transportType: "SITZEND", companion: false, prescription: "JA", approval: "NICHT_NOETIG",
        },
        { source: "MANUELL" },
      );
      expect(probleme).toContain("ABHOLZEIT_VERGANGEN");
      const fahrt = await prisma.ride.findUniqueOrThrow({ where: { id: rideId } });
      expect(fahrt.problems).toContain("ABHOLZEIT_VERGANGEN");
    });

    it("M-46: fahrtErfassen mit Termin vor Abholung trägt TERMIN_VOR_ABHOLUNG", async () => {
      const morgen = tagVerschieben(datumIso(new Date()), 1);
      const { probleme } = await fahrtErfassen(
        tenantId,
        {
          passengerId, pickupPlaceId: ortA, dropoffPlaceId: ortB, datum: morgen, abholzeit: "09:00", terminzeit: "08:00",
          rueckfahrt: false, rueckfahrtzeit: "", transportType: "SITZEND", companion: false, prescription: "JA", approval: "NICHT_NOETIG",
        },
        { source: "MANUELL" },
      );
      expect(probleme).toContain("TERMIN_VOR_ABHOLUNG");
    });
  });
});
