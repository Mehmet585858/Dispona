import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { telefonListeAusText } from "@/core/passengers/validation";
import { telefonNormalisieren } from "@/core/passengers/suche";
import { withTenant } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/**
 * Prüfbericht S2-013: Oberfläche/Import speicherten "0171 2345678" unverändert, die KI suchte nur
 * "+491712345678" → 0 Treffer, jeder Stammkunde wurde beim Anruf neu angelegt.
 */
describe("Telefonnummern als gemeinsamer Suchschlüssel (S2-013)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;

  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: `PRUEF_Telefon ${kennung}` } })).id;
  });
  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  it("S2-013: ein im Büro gespeicherter Fahrgast wird über den Suchschlüssel der KI gefunden", async () => {
    const db = withTenant(tenantId);
    await db.passenger.create({
      data: { tenantId, firstName: "PRUEF", lastName: "Stammkunde", phones: telefonListeAusText("0171 2345678, 02401/12345") },
    });
    const treffer = await db.passenger.findMany({ where: { phones: { has: telefonNormalisieren("0171 2345678") } } });
    expect(treffer).toHaveLength(1);
    const trefferFestnetz = await db.passenger.findMany({ where: { phones: { has: telefonNormalisieren("+49 2401 12345") } } });
    expect(trefferFestnetz).toHaveLength(1);
  });

  it("telefonListeAusText normalisiert, entfernt Leer- und Doppeleinträge", () => {
    expect(telefonListeAusText("0171 2345678, +49 171 2345678, , 02401/12345")).toEqual(["+491712345678", "+49240112345"]);
    expect(telefonListeAusText(undefined)).toEqual([]);
  });
});
