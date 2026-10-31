import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { istLokaleDatenbankUrl, mandantKomplettLoeschen, seedZielPruefen } from "@/lib/seedSchutz";
import { prisma } from "@/lib/prisma";

describe("S1-006: Seed-Schutz – Zielprüfung", () => {
  it("erkennt lokale Datenbanken", () => {
    expect(istLokaleDatenbankUrl("postgresql://u:p@localhost:5432/db")).toBe(true);
    expect(istLokaleDatenbankUrl("postgresql://u:p@127.0.0.1:5432/db")).toBe(true);
    expect(istLokaleDatenbankUrl("prisma+postgres://localhost:51213/?api_key=x")).toBe(true);
  });

  it("S1-006: bricht bei einer entfernten Datenbank (z. B. Neon) ohne ausdrückliche Bestätigung ab", () => {
    const url = "postgresql://u:p@ep-xyz.eu-central-1.aws.neon.tech/neondb?sslmode=require";
    expect(istLokaleDatenbankUrl(url)).toBe(false);
    expect(() => seedZielPruefen({ DATABASE_URL: url })).toThrow(/keine lokale Datenbank/);
    expect(() => seedZielPruefen({ DATABASE_URL: url, SEED_ZIEL_BESTAETIGEN: "anderer-host" })).toThrow();
    expect(seedZielPruefen({ DATABASE_URL: url, SEED_ZIEL_BESTAETIGEN: "ep-xyz.eu-central-1.aws.neon.tech" })).toBe(
      "ep-xyz.eu-central-1.aws.neon.tech",
    );
  });

  it("bricht ohne DATABASE_URL ab", () => {
    expect(() => seedZielPruefen({})).toThrow(/DATABASE_URL fehlt/);
  });
});

describe("S1-006: mandantKomplettLoeschen lässt fremde Mandanten unangetastet", () => {
  const kennung = randomUUID().slice(0, 8);
  let fremdId: string;

  afterAll(async () => {
    if (fremdId) await mandantKomplettLoeschen(fremdId);
  });

  it("S1-006: Seed-Löschung trifft nur den Demo-Mandanten, nicht PRUEF_fremd", async () => {
    const fremd = await prisma.tenant.create({
      data: {
        name: `PRUEF_fremd ${kennung}`,
        settings: {
          create: { greeting: "x", voiceId: "x", escalationNumber: "+4900", openingHours: {}, serviceAreaCenter: {} },
        },
        phoneNumbers: { create: [{ e164: `+49999${kennung.replace(/\D/g, "").padEnd(6, "1").slice(0, 6)}`, provider: "VAPI" }] },
      },
    });
    fremdId = fremd.id;
    await prisma.passenger.create({ data: { tenantId: fremd.id, firstName: "PRUEF", lastName: "Fremd", phones: [] } });
    await prisma.vehicle.create({ data: { tenantId: fremd.id, plate: `PRUEF-F-${kennung}` } });

    const demo = await prisma.tenant.create({
      data: {
        name: `PRUEF_demo ${kennung}`,
        settings: {
          create: { greeting: "x", voiceId: "x", escalationNumber: "+4900", openingHours: {}, serviceAreaCenter: {} },
        },
      },
    });
    await prisma.passenger.create({ data: { tenantId: demo.id, firstName: "PRUEF", lastName: "Demo", phones: [] } });
    await prisma.vehicle.create({ data: { tenantId: demo.id, plate: `PRUEF-D-${kennung}` } });

    await mandantKomplettLoeschen(demo.id);

    const zaehlen = async (tenantId: string) => ({
      passenger: await prisma.passenger.count({ where: { tenantId } }),
      vehicle: await prisma.vehicle.count({ where: { tenantId } }),
      phoneNumber: await prisma.phoneNumber.count({ where: { tenantId } }),
      settings: await prisma.tenantSettings.count({ where: { tenantId } }),
      tenant: await prisma.tenant.count({ where: { id: tenantId } }),
    });
    expect(await zaehlen(fremd.id)).toEqual({ passenger: 1, vehicle: 1, phoneNumber: 1, settings: 1, tenant: 1 });
    expect(await zaehlen(demo.id)).toEqual({ passenger: 0, vehicle: 0, phoneNumber: 0, settings: 0, tenant: 0 });
  });
});
