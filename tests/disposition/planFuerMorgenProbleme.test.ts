import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { planFuerMorgenBerechnen } from "@/core/disposition/planFuerMorgen";
import { berlinerMitternacht, datumIso, tagVerschieben } from "@/core/shifts/week";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/** Maßnahme M-20 Punkt 3 (docs/13 R2-6), Ausbreitung: "Plan für morgen" hängte KEIN_FAHRZEUG an,
 * auch wenn es schon eingetragen war (z. B. von der Vorschlagsrechnung beim Erfassen). */
describe("planFuerMorgen – KEIN_FAHRZEUG nur einmal (M-20)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;

  beforeAll(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: {
          name: `PRUEF_PlanProbleme ${kennung}`,
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
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  it("M-20: eine Fahrt ohne Kandidat, die KEIN_FAHRZEUG schon trägt, bekommt es kein zweites Mal", async () => {
    const ort = await prisma.place.create({
      data: { tenantId, label: "PRUEF Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
    });
    const passenger = await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Plan", phones: [] } });
    const ride = await prisma.ride.create({
      data: {
        tenantId, passengerId: passenger.id, pickupPlaceId: ort.id, dropoffPlaceId: ort.id,
        pickupAt: new Date(berlinerMitternacht(tagVerschieben(datumIso(new Date()), 1)).getTime() + 9 * 3600_000),
        transportType: "SITZEND", status: "ERFASST", source: "MANUELL", problems: ["KEIN_FAHRZEUG"],
      },
    });
    await planFuerMorgenBerechnen(tenantId);
    const nachher = await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
    expect(nachher.problems).toEqual(["KEIN_FAHRZEUG"]);
  });
});
