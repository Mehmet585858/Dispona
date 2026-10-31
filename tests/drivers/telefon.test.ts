import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fahrerEinladenSchema, technischeFahrerEmail } from "@/core/drivers/validation";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/** Maßnahme M-21: Fahrer-Rufnummern werden wie Fahrgast-Nummern beim Schreiben normalisiert (S2-013, V-006). */
describe("Fahrer-Rufnummer normalisiert (M-21)", () => {
  it("M-21: fahrerEinladenSchema liefert E.164 für alle Schreibweisen aus Durchgang 2", () => {
    for (const roh of ["0171 2345678", "0049 171 2345678", "+49 (0) 171 2345678", "+49 171 / 2345678"]) {
      expect(fahrerEinladenSchema.parse({ name: "PRUEF Fahrer", phone: roh }).phone).toBe("+491712345678");
    }
    expect(fahrerEinladenSchema.parse({ name: "PRUEF Fahrer", phone: "0031612345678" }).phone).toBe("+31612345678");
  });

  it("M-21: die technische Anmelde-E-Mail ist für alle Schreibweisen derselben Nummer gleich", () => {
    expect(technischeFahrerEmail("0171 2345678")).toBe("fahrer-491712345678@fahrer.intern");
    expect(technischeFahrerEmail("+49 171 2345678")).toBe(technischeFahrerEmail("0171 2345678"));
  });
});

describe("Migration 20261031121000_fahrer_telefon_e164 (M-21)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let altId: string;
  let bueroId: string;

  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: `PRUEF_FahrerMigration ${kennung}` } })).id;
    altId = randomUUID();
    bueroId = randomUUID();
    await prisma.user.create({
      data: { id: altId, tenantId, email: `fahrer-0171${kennung.replace(/\D/g, "")}999@fahrer.intern`, name: "PRUEF Alt", role: "FAHRER", phone: `0171 ${kennung.replace(/\D/g, "")}999` },
    });
    await prisma.user.create({
      data: { id: bueroId, tenantId, email: `pruef-${kennung}@buero.de`, name: "PRUEF Büro", role: "DISPONENT", phone: "0241 123" },
    });
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  it("M-21: schreibt Bestands-Fahrerkonten auf +49… und die passende technische E-Mail um, Büro-Konten bleiben", async () => {
    const sql = readFileSync(path.resolve(import.meta.dirname, "../../prisma/migrations/20261031121000_fahrer_telefon_e164/migration.sql"), "utf8");
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query(sql); // mehrere Anweisungen in einer einfachen Abfrage (wie migrate deploy)
    } finally {
      await client.end();
    }
    const ziffern = kennung.replace(/\D/g, "");
    const alt = await prisma.user.findUniqueOrThrow({ where: { id: altId } });
    expect(alt.phone).toBe(`+49171${ziffern}999`);
    expect(alt.email).toBe(`fahrer-49171${ziffern}999@fahrer.intern`);
    const buero = await prisma.user.findUniqueOrThrow({ where: { id: bueroId } });
    expect(buero.phone).toBe("0241 123");
    expect(buero.email).toBe(`pruef-${kennung}@buero.de`);
  });
});
