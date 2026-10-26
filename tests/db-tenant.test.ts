import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant } from "@/lib/db";
import { prisma } from "@/lib/prisma";

describe("withTenant – Mandantentrennung", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantA: { id: string };
  let tenantB: { id: string };
  let placeA: { id: string };
  let placeB: { id: string };

  beforeAll(async () => {
    tenantA = await prisma.tenant.create({ data: { name: `Test-Mandant A ${kennung}` } });
    tenantB = await prisma.tenant.create({ data: { name: `Test-Mandant B ${kennung}` } });
    placeA = await prisma.place.create({
      data: {
        tenantId: tenantA.id,
        label: "Ort A",
        street: "Teststraße 1",
        zip: "52062",
        city: "Aachen",
        lat: 50.77,
        lng: 6.08,
        type: "SONSTIGES",
      },
    });
    placeB = await prisma.place.create({
      data: {
        tenantId: tenantB.id,
        label: "Ort B",
        street: "Teststraße 2",
        zip: "52062",
        city: "Aachen",
        lat: 50.78,
        lng: 6.09,
        type: "SONSTIGES",
      },
    });
  });

  afterAll(async () => {
    await prisma.place.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
  });

  it("findMany zeigt Mandant A nie die Orte von Mandant B", async () => {
    const orte = await withTenant(tenantA.id).place.findMany();
    expect(orte.map((o) => o.id)).toContain(placeA.id);
    expect(orte.map((o) => o.id)).not.toContain(placeB.id);
  });

  it("findUnique liefert null, wenn die Zeile einem anderen Mandanten gehört", async () => {
    const fremderOrt = await withTenant(tenantA.id).place.findUnique({ where: { id: placeB.id } });
    expect(fremderOrt).toBeNull();

    const eigenerOrt = await withTenant(tenantA.id).place.findUnique({ where: { id: placeA.id } });
    expect(eigenerOrt?.id).toBe(placeA.id);
  });

  it("create() setzt die tenantId automatisch", async () => {
    const neuerOrt = await withTenant(tenantA.id).place.create({
      data: {
        label: "Neuer Ort",
        street: "Teststraße 3",
        zip: "52062",
        city: "Aachen",
        lat: 50.79,
        lng: 6.1,
        type: "SONSTIGES",
      } as never,
    });
    expect(neuerOrt.tenantId).toBe(tenantA.id);
  });

  it("update() über die Mandantengrenze schlägt fehl", async () => {
    await expect(
      withTenant(tenantA.id).place.update({
        where: { id: placeB.id },
        data: { label: "Übernommen" },
      }),
    ).rejects.toThrow();
  });
});
