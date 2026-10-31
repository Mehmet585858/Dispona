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

/**
 * Maßnahme M-23 Punkt 2 (Prüfbericht S2-011): Jeder konnte ohne Begrenzung beliebig viele
 * Fahrdienste anlegen. Jetzt höchstens REGISTRIERUNGEN_JE_STUNDE je Anschluss (IP, gehasht).
 */
describe("firmaRegistrieren – Ratenbegrenzung (M-23)", () => {
  const kennung = randomUUID().slice(0, 8);

  afterAll(async () => {
    const tenants = await prisma.tenant.findMany({ where: { name: { startsWith: `PRUEF_Rate ${kennung}` } }, select: { id: true } });
    for (const t of tenants) await mandantKomplettLoeschen(t.id);
  });

  it("M-23: nach fünf Registrierungen vom selben Anschluss innerhalb einer Stunde wird die sechste abgelehnt", async () => {
    const { REGISTRIERUNGEN_JE_STUNDE, registrierungErlaubt } = await import("@/core/einrichtung/registrierungsLimit");
    const anschluss = `PRUEF-${kennung}`;
    for (let i = 0; i < REGISTRIERUNGEN_JE_STUNDE; i += 1) expect(await registrierungErlaubt(anschluss)).toBe(true);
    expect(await registrierungErlaubt(anschluss)).toBe(false);
    expect(await registrierungErlaubt(`PRUEF-anders-${kennung}`)).toBe(true);
  });

  it("M-23: firmaRegistrieren meldet die Begrenzung verständlich und legt nichts an", async () => {
    const { registrierungErlaubt, REGISTRIERUNGEN_JE_STUNDE } = await import("@/core/einrichtung/registrierungsLimit");
    // Ohne Request-Kontext gilt der Anschluss "unbekannt"; vorher ausschöpfen.
    for (let i = 0; i < REGISTRIERUNGEN_JE_STUNDE; i += 1) await registrierungErlaubt("unbekannt");
    const ergebnis = await firmaRegistrieren({
      firmenname: `PRUEF_Rate ${kennung}`, vorname: "P", nachname: "T", email: `pruef-rate-${kennung}@test.invalid`, handynummer: "+491700000000",
    });
    expect(ergebnis).toEqual({ ok: false, fehler: expect.stringMatching(/später/) });
    expect(await prisma.tenant.count({ where: { name: `PRUEF_Rate ${kennung}` } })).toBe(0);
    await prisma.registrierungsversuch.deleteMany({});
  });
});
