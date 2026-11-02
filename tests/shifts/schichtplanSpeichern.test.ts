import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { beifahrerAusSchichtenNehmen, schichtenErsetzen, schichtplanDatenLaden } from "@/core/shifts/schichtplanSpeichern";
import { fahrerDeaktivieren } from "@/core/drivers/deaktivieren";
import { berlinerMitternacht, datumIso, mitUhrzeit, tagVerschieben } from "@/core/shifts/week";
import { SCHICHTPLAN_TEXTE } from "@/core/shifts/texte";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/**
 * Schichtplan (02.11.2026), Datenbank-Seite: Ersetzen je Fahrzeug und Tag, Mandantengrenze,
 * Hinweis vor dem Ändern, wenn schon Fahrten in der Schicht liegen, und Freigabe dieser Fahrten
 * wie bei "Ich falle aus".
 */
describe("schichtenErsetzen (Schichtplan speichern)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let fremderTenant: string;
  let fahrerA: string;
  let fahrerB: string;
  let aushilfe: string;
  let fremderFahrer: string;
  let fahrzeug: string;
  let liegendFahrzeug: string;
  let ort: string;
  let fahrgast: string;
  // Ein Tag in einer Woche: immer in der Zukunft, damit nichts als "vergangen" übersprungen wird.
  const tag = tagVerschieben(datumIso(new Date()), 7);

  async function person(name: string, extra: { istAushilfe?: boolean; tenant?: string } = {}) {
    const t = extra.tenant ?? tenantId;
    const user = await prisma.user.create({
      data: { id: randomUUID(), tenantId: t, email: `pruef-${randomUUID()}@test.invalid`, name, role: "FAHRER" },
    });
    return (await prisma.driver.create({ data: { tenantId: t, userId: user.id, istAushilfe: extra.istAushilfe ?? false } })).id;
  }

  beforeAll(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: {
          name: `PRUEF_Schichtplan ${kennung}`,
          settings: {
            create: {
              greeting: "x",
              voiceId: "x",
              escalationNumber: "+4900",
              openingHours: {},
              serviceAreaCenter: { lat: 50.77, lng: 6.08 },
              depotAddress: { lat: 50.77, lng: 6.08 },
              scalamobilAnzahl: 1,
            },
          },
        },
      })
    ).id;
    fremderTenant = (await prisma.tenant.create({ data: { name: `PRUEF_Schichtplan_fremd ${kennung}` } })).id;
    fahrerA = await person("PRUEF Anna");
    fahrerB = await person("PRUEF Bernd");
    aushilfe = await person("PRUEF Aushilfe", { istAushilfe: true });
    fremderFahrer = await person("PRUEF Fremd", { tenant: fremderTenant });
    fahrzeug = (await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-1-${kennung}`, carryChair: true } })).id;
    liegendFahrzeug = (await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-4-${kennung}`, stretcher: true, seats: 1 } })).id;
    ort = (
      await prisma.place.create({
        data: { tenantId, label: "PRUEF Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
      })
    ).id;
    fahrgast = (await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Fahrgast", phones: [] } })).id;
  });

  beforeEach(async () => {
    await prisma.rideStatusEvent.deleteMany({ where: { tenantId } });
    await prisma.suggestion.deleteMany({ where: { tenantId } });
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.ride.deleteMany({ where: { tenantId } });
    await prisma.shift.deleteMany({ where: { tenantId } });
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
    await mandantKomplettLoeschen(fremderTenant);
  });

  const entwurf = (extra: Record<string, unknown> = {}) => ({
    von: "06:00",
    bis: "14:00",
    fahrerId: fahrerA,
    beifahrerId: null as string | null,
    scalamobil: false,
    ...extra,
  });

  async function disponierteFahrt(vehicleId: string, driverId: string, uhrzeit: string, transportType: "SITZEND" | "LIEGEND" = "SITZEND") {
    return prisma.ride.create({
      data: {
        tenantId,
        passengerId: fahrgast,
        pickupPlaceId: ort,
        dropoffPlaceId: ort,
        pickupAt: mitUhrzeit(berlinerMitternacht(tag), uhrzeit),
        transportType,
        status: "DISPONIERT",
        source: "MANUELL",
        vehicleId,
        driverId,
      },
    });
  }

  it("legt Schichten an und ersetzt sie je Fahrzeug und Tag (Gilt für: mehrere Tage)", async () => {
    const tage = [tag, tagVerschieben(tag, 1)];
    const erst = await schichtenErsetzen(
      tenantId,
      tage.map((tagIso) => ({ vehicleId: fahrzeug, tagIso, entwuerfe: [entwurf({ beifahrerId: aushilfe, scalamobil: true })] })),
      { modus: "STRENG" },
    );
    expect(erst).toMatchObject({ ok: true, angelegt: 2, geloescht: 0 });
    const danach = await schichtenErsetzen(tenantId, [{ vehicleId: fahrzeug, tagIso: tag, entwuerfe: [entwurf({ fahrerId: fahrerB })] }], {
      modus: "STRENG",
    });
    expect(danach).toMatchObject({ ok: true, angelegt: 1, geloescht: 1 });
    const schichten = await prisma.shift.findMany({ where: { tenantId }, orderBy: { start: "asc" } });
    expect(schichten.map((s) => [s.driverId, s.beifahrerId, s.scalamobil])).toEqual([
      [fahrerB, null, false],
      [fahrerA, aushilfe, true],
    ]);
    const daten = await schichtplanDatenLaden(tenantId, tag, tagVerschieben(tag, 1));
    expect(daten.schichten.map((s) => s.tagIso)).toEqual(tage);
    expect(daten.personal.find((p) => p.id === aushilfe)?.istAushilfe).toBe(true);
    expect(daten.scalamobilAnzahl).toBe(1);
  });

  it("Prüffehler (Person doppelt verplant) – nichts wird geschrieben", async () => {
    await schichtenErsetzen(tenantId, [{ vehicleId: fahrzeug, tagIso: tag, entwuerfe: [entwurf()] }], { modus: "STRENG" });
    const ergebnis = await schichtenErsetzen(tenantId, [{ vehicleId: liegendFahrzeug, tagIso: tag, entwuerfe: [entwurf({ von: "10:00", bis: "18:00" })] }], {
      modus: "STRENG",
    });
    expect(ergebnis.ok).toBe(false);
    expect("fehler" in ergebnis && ergebnis.fehler).toMatch(/PRUEF Anna fährt am .* schon PRUEF-1-/);
    expect(await prisma.shift.count({ where: { tenantId } })).toBe(1);
  });

  it("fremde Mandanten-IDs werden abgewiesen (Fahrer und Beifahrer), nichts angelegt", async () => {
    const alsFahrer = await schichtenErsetzen(tenantId, [{ vehicleId: fahrzeug, tagIso: tag, entwuerfe: [entwurf({ fahrerId: fremderFahrer })] }], {
      modus: "STRENG",
    });
    expect(alsFahrer).toEqual({ ok: false, fehler: "Fahrer nicht gefunden." });
    const alsBeifahrer = await schichtenErsetzen(
      tenantId,
      [{ vehicleId: fahrzeug, tagIso: tag, entwuerfe: [entwurf({ beifahrerId: fremderFahrer })] }],
      { modus: "STRENG" },
    );
    expect(alsBeifahrer).toEqual({ ok: false, fehler: "Fahrer nicht gefunden." });
    expect(await prisma.shift.count({ where: { tenantId } })).toBe(0);
  });

  it("vergangene Tage werden übersprungen und gemeldet, nichts gelöscht", async () => {
    const gestern = tagVerschieben(datumIso(new Date()), -1);
    await prisma.shift.create({
      data: {
        tenantId,
        driverId: fahrerA,
        vehicleId: fahrzeug,
        start: mitUhrzeit(berlinerMitternacht(gestern), "06:00"),
        end: mitUhrzeit(berlinerMitternacht(gestern), "14:00"),
      },
    });
    const ergebnis = await schichtenErsetzen(tenantId, [{ vehicleId: fahrzeug, tagIso: gestern, entwuerfe: [] }], { modus: "STRENG" });
    expect(ergebnis).toMatchObject({ ok: true, geloescht: 0, uebersprungen: [{ tagIso: gestern, grund: SCHICHTPLAN_TEXTE.vergangenerTag }] });
    expect(await prisma.shift.count({ where: { tenantId } })).toBe(1);
  });

  it("Fahrten in der wegfallenden Zeit: erst Hinweis mit Uhrzeiten (nichts geändert), nach Bestätigung freigegeben", async () => {
    await schichtenErsetzen(tenantId, [{ vehicleId: fahrzeug, tagIso: tag, entwuerfe: [entwurf()] }], { modus: "STRENG" });
    const frueh = await disponierteFahrt(fahrzeug, fahrerA, "08:00");
    const spaet = await disponierteFahrt(fahrzeug, fahrerA, "12:30");
    const kuerzer = [{ vehicleId: fahrzeug, tagIso: tag, entwuerfe: [entwurf({ bis: "10:00" })] }];

    const hinweis = await schichtenErsetzen(tenantId, kuerzer, { modus: "STRENG" });
    expect(hinweis.ok).toBe(false);
    if (hinweis.ok || !("hinweis" in hinweis)) throw new Error("Hinweis erwartet");
    expect(hinweis.hinweis.map((f) => [f.id, f.uhrzeit])).toEqual([[spaet.id, "12:30"]]);
    expect(JSON.stringify(hinweis.hinweis)).not.toMatch(/PRUEF Fahrgast|Fahrgast/);
    // Nichts geändert: Schicht und Fahrt wie vorher.
    expect((await prisma.shift.findFirstOrThrow({ where: { tenantId } })).end.toISOString()).toBe(
      mitUhrzeit(berlinerMitternacht(tag), "14:00").toISOString(),
    );
    expect((await prisma.ride.findUniqueOrThrow({ where: { id: spaet.id } })).status).toBe("DISPONIERT");

    const bestaetigt = await schichtenErsetzen(tenantId, kuerzer, { modus: "STRENG", bestaetigteFahrten: [spaet.id] });
    expect(bestaetigt).toMatchObject({ ok: true, freigegeben: 1 });
    const freigegeben = await prisma.ride.findUniqueOrThrow({ where: { id: spaet.id } });
    expect(freigegeben.status).not.toBe("DISPONIERT");
    expect(freigegeben.vehicleId).toBeNull();
    expect(freigegeben.driverId).toBeNull();
    expect(freigegeben.problems).toContain(SCHICHTPLAN_TEXTE.hinweisSchichtGeaendert);
    expect(await prisma.notification.count({ where: { tenantId, rideId: spaet.id, kind: "FAHRT_ENTZOGEN" } })).toBe(1);
    const bleibt = await prisma.ride.findUniqueOrThrow({ where: { id: frueh.id } });
    expect([bleibt.status, bleibt.vehicleId, bleibt.driverId]).toEqual(["DISPONIERT", fahrzeug, fahrerA]);
  });

  it("Löschen einer Schicht mit Fahrten fragt nach; eine nicht bestätigte zusätzliche Fahrt löst erneut den Hinweis aus", async () => {
    await schichtenErsetzen(tenantId, [{ vehicleId: fahrzeug, tagIso: tag, entwuerfe: [entwurf()] }], { modus: "STRENG" });
    const eins = await disponierteFahrt(fahrzeug, fahrerA, "07:00");
    const loeschen = [{ vehicleId: fahrzeug, tagIso: tag, entwuerfe: [] }];
    const erst = await schichtenErsetzen(tenantId, loeschen, { modus: "STRENG" });
    expect("hinweis" in erst && erst.hinweis).toHaveLength(1);
    const zwei = await disponierteFahrt(fahrzeug, fahrerA, "11:00");
    const nochmal = await schichtenErsetzen(tenantId, loeschen, { modus: "STRENG", bestaetigteFahrten: [eins.id] });
    expect("hinweis" in nochmal && nochmal.hinweis.map((f) => f.id)).toEqual([eins.id, zwei.id]);
    const ok = await schichtenErsetzen(tenantId, loeschen, { modus: "STRENG", bestaetigteFahrten: [eins.id, zwei.id] });
    expect(ok).toMatchObject({ ok: true, geloescht: 1, freigegeben: 2 });
    expect(await prisma.shift.count({ where: { tenantId } })).toBe(0);
  });

  it("deaktivierter Beifahrer: aus Schichten ausgetragen, Liegend-Fahrt freigegeben, Sitzend-Fahrt bleibt", async () => {
    await schichtenErsetzen(
      tenantId,
      [{ vehicleId: liegendFahrzeug, tagIso: tag, entwuerfe: [entwurf({ fahrerId: fahrerB, beifahrerId: aushilfe })] }],
      { modus: "STRENG" },
    );
    const liegend = await disponierteFahrt(liegendFahrzeug, fahrerB, "09:00", "LIEGEND");
    const sitzend = await disponierteFahrt(liegendFahrzeug, fahrerB, "11:00", "SITZEND");
    const ergebnis = await fahrerDeaktivieren(tenantId, aushilfe);
    expect(ergebnis.beifahrerSchichten).toBe(1);
    expect(ergebnis.beifahrerFahrtenFreigegeben).toBe(1);
    expect((await prisma.shift.findFirstOrThrow({ where: { tenantId } })).beifahrerId).toBeNull();
    const l = await prisma.ride.findUniqueOrThrow({ where: { id: liegend.id } });
    expect(l.vehicleId).toBeNull();
    expect(l.problems).toContain(SCHICHTPLAN_TEXTE.hinweisBeifahrerDeaktiviert);
    expect((await prisma.ride.findUniqueOrThrow({ where: { id: sitzend.id } })).status).toBe("DISPONIERT");
    // Zweiter Aufruf: nichts mehr zu tun.
    expect(await beifahrerAusSchichtenNehmen(tenantId, aushilfe, new Date())).toMatchObject({ schichten: 0, freigegeben: 0 });
    await prisma.driver.update({ where: { id: aushilfe }, data: { active: true, deactivatedAt: null } });
  });
});
