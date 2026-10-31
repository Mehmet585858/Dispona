import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { firmaRegistrieren } from "@/app/(auth)/registrieren/actions";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/** Prüfbericht S2-011 (verschärft, S3-020): zwei gleichzeitige Registrierungen mit derselben
 * E-Mail hinterließen 2 Mandanten und 1 Nutzer, der zweite Aufruf endete im Serverfehler. */
describe("firmaRegistrieren (S2-011)", () => {
  const kennung = randomUUID().slice(0, 8);
  const email = `pruef-${kennung}@test.invalid`;
  const firmenname = `PRUEF_Firma ${kennung}`;

  afterAll(async () => {
    const tenants = await prisma.tenant.findMany({ where: { name: { startsWith: `PRUEF_Firma ${kennung}` } }, select: { id: true } });
    for (const t of tenants) await mandantKomplettLoeschen(t.id);
  });

  it("S2-011: parallele Registrierung derselben E-Mail legt genau einen Mandanten und einen Nutzer an", async () => {
    const eingabe = { firmenname, vorname: "PRUEF", nachname: "Test", email, handynummer: "+491700000000" };
    const ergebnisse = await Promise.allSettled([firmaRegistrieren(eingabe), firmaRegistrieren({ ...eingabe, firmenname: `${firmenname} B` })]);
    expect(ergebnisse.every((e) => e.status === "fulfilled")).toBe(true);
    const werte = ergebnisse.map((e) => (e as PromiseFulfilledResult<Awaited<ReturnType<typeof firmaRegistrieren>>>).value);
    expect(werte.filter((w) => w.ok)).toHaveLength(1);
    expect(werte.filter((w) => !w.ok)).toHaveLength(1);

    expect(await prisma.user.count({ where: { email } })).toBe(1);
    expect(await prisma.tenant.count({ where: { name: { startsWith: `PRUEF_Firma ${kennung}` } } })).toBe(1);
  });

  it("S2-011: lehnt eine ungültige E-Mail-Adresse ab", async () => {
    const ergebnis = await firmaRegistrieren({ firmenname: `${firmenname} C`, vorname: "P", nachname: "T", email: "keine-adresse", handynummer: "+491700000000" });
    expect(ergebnis.ok).toBe(false);
  });
});
