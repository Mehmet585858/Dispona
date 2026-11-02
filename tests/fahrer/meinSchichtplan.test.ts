import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testSitzung } from "../hilfen/sitzungsMock";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";
import { meineSchichtenLaden } from "@/core/shifts/meinSchichtplan";
import { berlinerMitternacht, datumIso, mitUhrzeit, tagVerschieben } from "@/core/shifts/week";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth", async () => (await import("../hilfen/sitzungsMock")).authMock);

import { fahrerUebersichtLaden } from "@/app/fahrer/actions";

/**
 * Schichtplan Schritt 6: „Mein Schichtplan“ in der Fahrer-App. Jede angemeldete Person (auch
 * Aushilfen) sieht ihre eigenen Schichten der nächsten 4 Wochen, als Fahrer oder Beifahrer – mit
 * Datum, Zeit, Fahrzeug, Kollegin/Kollege und Scalamobil. Beifahrer bekommen keine Fahrten.
 */
describe("Mein Schichtplan (Fahrer-App)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let fahrerUser: string;
  let aushilfeUser: string;
  let fahrer: string;
  let aushilfe: string;
  let andere: string;
  let fahrzeug: string;
  const heute = datumIso(new Date());
  const tag = (versatz: number, uhr: string) => mitUhrzeit(berlinerMitternacht(tagVerschieben(heute, versatz)), uhr);

  async function person(name: string, istAushilfe = false) {
    const userId = randomUUID();
    await prisma.user.create({ data: { id: userId, tenantId, email: `pruef-${userId}@test.invalid`, name, role: "FAHRER" } });
    const id = (await prisma.driver.create({ data: { tenantId, userId, istAushilfe } })).id;
    return { userId, id };
  }

  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: `PRUEF_MeinPlan ${kennung}` } })).id;
    ({ userId: fahrerUser, id: fahrer } = await person("PRUEF Fahrerin Anna"));
    ({ userId: aushilfeUser, id: aushilfe } = await person("PRUEF Aushilfe Ben", true));
    andere = (await person("PRUEF Dritte")).id;
    fahrzeug = (await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-MP-${kennung}`, carryChair: true } })).id;
    const zweites = (await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-MP2-${kennung}` } })).id;
    const schicht = (start: Date, end: Date, driverId: string, beifahrerId: string | null, vehicleId = fahrzeug, scalamobil = false) =>
      prisma.shift.create({ data: { tenantId, driverId, beifahrerId, vehicleId, start, end, scalamobil } });
    await schicht(tag(-3, "06:00"), tag(-3, "14:00"), fahrer, aushilfe); // vergangen
    await schicht(tag(1, "06:00"), tag(1, "14:00"), fahrer, aushilfe, fahrzeug, true); // beide
    await schicht(tag(2, "22:00"), tag(3, "06:00"), aushilfe, null, zweites); // Aushilfe fährt selbst, Nacht
    await schicht(tag(5, "06:00"), tag(5, "14:00"), andere, null, zweites); // fremd
    await schicht(tag(40, "06:00"), tag(40, "14:00"), fahrer, null); // zu weit weg
  });

  afterAll(async () => {
    testSitzung.wert = null;
    await mandantKomplettLoeschen(tenantId);
  });

  it("Fahrerin sieht nur eigene Schichten der nächsten 4 Wochen, mit Beifahrer und Scalamobil", async () => {
    const plan = await meineSchichtenLaden(tenantId, fahrer);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      tagIso: tagVerschieben(heute, 1),
      von: "06:00",
      bis: "14:00",
      rolle: "FAHRER",
      kollege: "PRUEF Aushilfe Ben",
      scalamobil: true,
      plate: `PRUEF-MP-${kennung}`,
    });
  });

  it("Aushilfe sieht ihre Schichten als Beifahrer und als Fahrer (Nachtschicht mit Folgetag)", async () => {
    const plan = await meineSchichtenLaden(tenantId, aushilfe);
    expect(plan.map((s) => [s.rolle, s.kollege, s.folgetag])).toEqual([
      ["BEIFAHRER", "PRUEF Fahrerin Anna", false],
      ["FAHRER", null, true],
    ]);
  });

  it("über die App-Action: Beifahrer bekommt den Schichtplan, aber keine Fahrten des Fahrers", async () => {
    const ort = (
      await prisma.place.create({
        data: { tenantId, label: "PRUEF Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
      })
    ).id;
    const fahrgast = (await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Geheim", phones: [] } })).id;
    await prisma.ride.create({
      data: {
        tenantId,
        passengerId: fahrgast,
        pickupPlaceId: ort,
        dropoffPlaceId: ort,
        pickupAt: tag(1, "09:00"),
        transportType: "SITZEND",
        status: "DISPONIERT",
        source: "MANUELL",
        vehicleId: fahrzeug,
        driverId: fahrer,
      },
    });
    testSitzung.wert = { tenantId, userId: aushilfeUser, role: "FAHRER" };
    const alsBeifahrer = await fahrerUebersichtLaden();
    expect(alsBeifahrer.fahrten).toHaveLength(0);
    expect(alsBeifahrer.meinSchichtplan.map((s) => s.rolle)).toEqual(["BEIFAHRER", "FAHRER"]);
    expect(JSON.stringify(alsBeifahrer.meinSchichtplan)).not.toContain("Geheim");

    testSitzung.wert = { tenantId, userId: fahrerUser, role: "FAHRER" };
    const alsFahrer = await fahrerUebersichtLaden();
    expect(alsFahrer.fahrten).toHaveLength(1);
    expect(alsFahrer.meinSchichtplan).toHaveLength(1);
  });
});
