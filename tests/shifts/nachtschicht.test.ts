import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testSitzung } from "../hilfen/sitzungsMock";
import { schichtZeitraum } from "@/core/shifts/dauer";
import { schichtMusterSchema } from "@/core/drivers/validation";
import { findeAktiveSchicht } from "@/core/disposition/kandidaten";
import { berlinerMitternacht, mitUhrzeit } from "@/core/shifts/week";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth", async () => (await import("../hilfen/sitzungsMock")).authMock);

/**
 * Maßnahme M-18 (Prüfbericht S2-004): Eine Schicht 22:00–06:00 wurde mit Ende VOR Beginn gespeichert –
 * nachts fand das System nie einen Fahrer im Dienst, genau dann, wenn der Automodus arbeiten soll.
 */
describe("Nachtschichten über Mitternacht (M-18)", () => {
  it("M-18: Endzeit vor Startzeit → Ende am Folgetag", () => {
    const tag = berlinerMitternacht("2026-11-02");
    const { start, end, folgetag } = schichtZeitraum(tag, "22:00", "06:00");
    expect(folgetag).toBe(true);
    expect(start.toISOString()).toBe(mitUhrzeit(tag, "22:00").toISOString());
    expect(end.toISOString()).toBe(mitUhrzeit(berlinerMitternacht("2026-11-03"), "06:00").toISOString());
    expect((end.getTime() - start.getTime()) / 3600_000).toBe(8);
  });

  it("M-18: über die Zeitumstellung (25.10.2026) dauert 22:00–06:00 neun Stunden", () => {
    const { start, end } = schichtZeitraum(berlinerMitternacht("2026-10-24"), "22:00", "06:00");
    expect((end.getTime() - start.getTime()) / 3600_000).toBe(9);
  });

  it("Tagschicht bleibt am selben Tag", () => {
    const { end, folgetag } = schichtZeitraum(berlinerMitternacht("2026-11-02"), "06:00", "14:00");
    expect(folgetag).toBe(false);
    expect(end.toISOString()).toBe(mitUhrzeit(berlinerMitternacht("2026-11-02"), "14:00").toISOString());
  });

  it("M-18 Punkt 3: findeAktiveSchicht mit Mitternachtsschicht – 23:30 und 05:59 im Dienst, 06:30 nicht", () => {
    const { start, end } = schichtZeitraum(berlinerMitternacht("2026-11-02"), "22:00", "06:00");
    const schichten = [{ vehicleId: "v1", driverId: "d1", start, end, onBreak: false, unavailable: false }];
    const montag = berlinerMitternacht("2026-11-02");
    const dienstag = berlinerMitternacht("2026-11-03");
    expect(findeAktiveSchicht(schichten, "v1", mitUhrzeit(montag, "23:30"))).toBeDefined();
    expect(findeAktiveSchicht(schichten, "v1", mitUhrzeit(dienstag, "05:59"))).toBeDefined();
    expect(findeAktiveSchicht(schichten, "v1", mitUhrzeit(dienstag, "06:30"))).toBeUndefined();
    expect(findeAktiveSchicht(schichten, "v1", mitUhrzeit(montag, "21:30"))).toBeUndefined();
  });

  it("M-18: Schema lehnt gleiche Start- und Endzeit sowie ungültige Uhrzeiten ab", () => {
    const basis = { driverId: "d", vehicleId: "v", wochentage: [0] };
    expect(schichtMusterSchema.safeParse({ ...basis, start: "22:00", end: "06:00" }).success).toBe(true);
    expect(schichtMusterSchema.safeParse({ ...basis, start: "22:00", end: "22:00" }).success).toBe(false);
    expect(schichtMusterSchema.safeParse({ ...basis, start: "25:00", end: "06:00" }).success).toBe(false);
  });

  describe("schichtMusterAnlegen gegen Postgres", () => {
    const kennung = randomUUID().slice(0, 8);
    let tenantId: string;
    let driverId: string;
    let vehicleId: string;
    let userId: string;

    beforeAll(async () => {
      tenantId = (await prisma.tenant.create({ data: { name: `PRUEF_Nacht ${kennung}` } })).id;
      vehicleId = (await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-N-${kennung}` } })).id;
      const user = await prisma.user.create({
        data: { id: randomUUID(), tenantId, email: `pruef-${randomUUID()}@test.invalid`, name: "PRUEF", role: "FAHRER" },
      });
      driverId = (await prisma.driver.create({ data: { tenantId, userId: user.id } })).id;
      userId = (
        await prisma.user.create({
          data: { id: randomUUID(), tenantId, email: `pruef-${randomUUID()}@test.invalid`, name: "PRUEF Büro", role: "ADMIN" },
        })
      ).id;
    });

    afterAll(async () => {
      testSitzung.wert = null;
      await mandantKomplettLoeschen(tenantId);
    });

    it("M-18 (Reproduktion Durchgang 1): Muster 22:00–06:00 → findeAktiveSchicht um 02:00 liefert die Schicht", async () => {
      testSitzung.wert = { tenantId, userId, role: "ADMIN" };
      const { schichtMusterAnlegen } = await import("@/app/dispo/fahrer/actions");
      // Montag, 02.11.2026: Schicht Mo 22:00 – Di 06:00.
      await schichtMusterAnlegen({ driverId, vehicleId, wochentage: [0], start: "22:00", end: "06:00" }, "2026-11-02");

      const schichten = await prisma.shift.findMany({ where: { tenantId } });
      expect(schichten).toHaveLength(1);
      expect(schichten[0].end.getTime()).toBeGreaterThan(schichten[0].start.getTime());
      const dienstagZweiUhr = mitUhrzeit(berlinerMitternacht("2026-11-03"), "02:00");
      expect(findeAktiveSchicht(schichten, vehicleId, dienstagZweiUhr)).toBe(schichten[0]);
    });
  });
});
