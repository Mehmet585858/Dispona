import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testSitzung } from "../hilfen/sitzungsMock";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth", async () => (await import("../hilfen/sitzungsMock")).authMock);

/**
 * Maßnahme M-23 Punkt 3 (Prüfbericht S4-009): fahrerEinladen legte Nutzer und Fahrerprofil in zwei
 * getrennten Schritten an. Jetzt in einer Transaktion: entweder beides oder nichts.
 */
describe("fahrerEinladen (M-23)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;

  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: `PRUEF_Einladen ${kennung}` } })).id;
    const admin = await prisma.user.create({
      data: { id: randomUUID(), tenantId, email: `pruef-${randomUUID()}@test.invalid`, name: "PRUEF Büro", role: "ADMIN" },
    });
    testSitzung.wert = { tenantId, userId: admin.id, role: "ADMIN" };
  });

  afterAll(async () => {
    testSitzung.wert = null;
    await mandantKomplettLoeschen(tenantId);
  });

  it("M-23: legt Nutzer und Fahrerprofil gemeinsam an; eine schon vergebene Nummer hinterlässt keinen halben Datensatz", async () => {
    const { fahrerEinladen } = await import("@/app/dispo/fahrer/actions");
    const nummer = `0171 9${kennung.replace(/[^0-9]/g, "").padEnd(6, "1").slice(0, 6)}`;
    await fahrerEinladen({ name: "PRUEF Fahrer", phone: nummer });
    expect(await prisma.user.count({ where: { tenantId, role: "FAHRER" } })).toBe(1);
    expect(await prisma.driver.count({ where: { tenantId } })).toBe(1);

    await expect(fahrerEinladen({ name: "PRUEF Fahrer 2", phone: nummer })).rejects.toThrow();
    expect(await prisma.user.count({ where: { tenantId, role: "FAHRER" } })).toBe(1);
    expect(await prisma.driver.count({ where: { tenantId } })).toBe(1);
  });
});
