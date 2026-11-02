import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testSitzung } from "../hilfen/sitzungsMock";
import { aenderungenZuruecknehmen, schichtenSpeichern, schichtplanLaden, wocheKopieren } from "@/app/dispo/schichtplan/actions";
import { entwuerfeAus, ladeBereich } from "@/app/dispo/schichtplan/anzeige";
import { fahrzeugZuweisen } from "@/core/disposition/zuweisen";
import { berlinerMitternacht, datumIso, mitUhrzeit, montagVonIso, tagVerschieben } from "@/core/shifts/week";
import { SCHICHTPLAN_TEXTE } from "@/core/shifts/texte";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth", async () => (await import("../hilfen/sitzungsMock")).authMock);

/**
 * Schichtplan Schritt 5 – Schutz beim Ändern, so wie die Oberfläche ihn nutzt (Server Actions des
 * Seitenfensters): erst Hinweis mit Uhrzeiten, nichts geändert; dann mit Bestätigung speichern und
 * die Fahrten freigeben. Laufende Schichten werden nie zu Entwürfen; „Rückgängig“ gibt Fahrten nie
 * ungefragt frei; Fahrer dürfen den Schichtplan nicht ändern.
 */
describe("Schichtplan-Oberfläche: Schutz beim Ändern", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let dispoId: string;
  let fahrerUserId: string;
  let fahrer: string;
  let fahrzeug: string;
  let ort: string;
  let fahrgast: string;
  const tag = tagVerschieben(datumIso(new Date()), 7);
  const entwurf = (bis = "14:00") => ({ von: "06:00", bis, fahrerId: fahrer, beifahrerId: null, scalamobil: false });

  beforeAll(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: {
          name: `PRUEF_SchichtplanUI ${kennung}`,
          settings: {
            create: {
              greeting: "x",
              voiceId: "x",
              escalationNumber: "+4900",
              openingHours: {},
              serviceAreaCenter: { lat: 50.77, lng: 6.08 },
              depotAddress: { lat: 50.77, lng: 6.08 },
            },
          },
        },
      })
    ).id;
    dispoId = randomUUID();
    await prisma.user.create({ data: { id: dispoId, tenantId, email: `pruef-${dispoId}@test.invalid`, name: "PRUEF Dispo", role: "DISPONENT" } });
    fahrerUserId = randomUUID();
    await prisma.user.create({ data: { id: fahrerUserId, tenantId, email: `pruef-${fahrerUserId}@test.invalid`, name: "PRUEF Fahrer", role: "FAHRER" } });
    fahrer = (await prisma.driver.create({ data: { tenantId, userId: fahrerUserId } })).id;
    fahrzeug = (await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-UI-${kennung}` } })).id;
    ort = (
      await prisma.place.create({
        data: { tenantId, label: "PRUEF Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
      })
    ).id;
    fahrgast = (await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Fahrgast", phones: [] } })).id;
  });

  beforeEach(async () => {
    testSitzung.wert = { tenantId, userId: dispoId, role: "DISPONENT" };
    await prisma.rideStatusEvent.deleteMany({ where: { tenantId } });
    await prisma.suggestion.deleteMany({ where: { tenantId } });
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.ride.deleteMany({ where: { tenantId } });
    await prisma.shift.deleteMany({ where: { tenantId } });
  });

  afterAll(async () => {
    testSitzung.wert = null;
    await mandantKomplettLoeschen(tenantId);
  });

  async function zugewieseneFahrt(uhrzeit: string) {
    const fahrt = await prisma.ride.create({
      data: {
        tenantId,
        passengerId: fahrgast,
        pickupPlaceId: ort,
        dropoffPlaceId: ort,
        pickupAt: mitUhrzeit(berlinerMitternacht(tag), uhrzeit),
        transportType: "SITZEND",
        status: "ERFASST",
        source: "MANUELL",
      },
    });
    await fahrzeugZuweisen(tenantId, fahrt.id, fahrzeug, { dispatchMode: "MANUELL", benachrichtigen: false });
    return fahrt.id;
  }

  it("Seitenfenster: Hinweis mit Uhrzeit → nichts geändert; „Trotzdem speichern“ → gespeichert und Fahrt freigegeben", async () => {
    await schichtenSpeichern({ vehicleId: fahrzeug, tagIso: tag, giltFuer: "TAG", entwuerfe: [entwurf()] });
    const fahrt = await zugewieseneFahrt("12:00");

    const erst = await schichtenSpeichern({ vehicleId: fahrzeug, tagIso: tag, giltFuer: "TAG", entwuerfe: [entwurf("10:00")] });
    expect("hinweis" in erst && erst.hinweis.map((f) => f.uhrzeit)).toEqual(["12:00"]);
    expect((await prisma.ride.findUniqueOrThrow({ where: { id: fahrt } })).status).toBe("DISPONIERT");

    const dann = await schichtenSpeichern({
      vehicleId: fahrzeug,
      tagIso: tag,
      giltFuer: "TAG",
      entwuerfe: [entwurf("10:00")],
      bestaetigteFahrten: "hinweis" in erst ? erst.hinweis.map((f) => f.id) : [],
    });
    expect(dann).toMatchObject({ ok: true, freigegeben: 1 });
    const danach = await prisma.ride.findUniqueOrThrow({ where: { id: fahrt } });
    expect(danach.problems).toContain(SCHICHTPLAN_TEXTE.hinweisSchichtGeaendert);
    expect(danach.vehicleId).toBeNull();
  });

  it("„Gilt für: Montag bis Freitag“ legt 5 Schichten an (vergangene Tage übersprungen); Löschen fragt bei Fahrten nach", async () => {
    const montag = montagVonIso(tag);
    const ergebnis = await schichtenSpeichern({ vehicleId: fahrzeug, tagIso: montag, giltFuer: "WOCHE", entwuerfe: [entwurf()] });
    expect(ergebnis).toMatchObject({ ok: true, angelegt: 5 });
    await zugewieseneFahrt("09:00");
    const loeschen = await schichtenSpeichern({ vehicleId: fahrzeug, tagIso: montag, giltFuer: "WOCHE", entwuerfe: [] });
    expect("hinweis" in loeschen && loeschen.hinweis).toHaveLength(1);
    expect(await prisma.shift.count({ where: { tenantId } })).toBe(5);
  });

  it("„Rückgängig“ gibt Fahrten nie ungefragt frei: liegen inzwischen Fahrten in den Schichten, kommt der Hinweis zurück", async () => {
    const gespeichert = await schichtenSpeichern({ vehicleId: fahrzeug, tagIso: tag, giltFuer: "TAG", entwuerfe: [entwurf()] });
    if (!gespeichert.ok) throw new Error("Speichern erwartet");
    const fahrt = await zugewieseneFahrt("08:00");
    const zurueck = await aenderungenZuruecknehmen(gespeichert.vorher);
    expect("hinweis" in zurueck).toBe(true);
    expect((await prisma.ride.findUniqueOrThrow({ where: { id: fahrt } })).status).toBe("DISPONIERT");
    expect(await prisma.shift.count({ where: { tenantId } })).toBe(1);
  });

  it("Woche kopieren mit Fahrten im Ziel: erst Hinweis, nichts geändert", async () => {
    const quelle = montagVonIso(tag);
    const zielTag = tagVerschieben(tag, 7);
    await schichtenSpeichern({ vehicleId: fahrzeug, tagIso: zielTag, giltFuer: "TAG", entwuerfe: [entwurf()] });
    const fahrt = await prisma.ride.create({
      data: {
        tenantId,
        passengerId: fahrgast,
        pickupPlaceId: ort,
        dropoffPlaceId: ort,
        pickupAt: mitUhrzeit(berlinerMitternacht(zielTag), "09:00"),
        transportType: "SITZEND",
        status: "ERFASST",
        source: "MANUELL",
      },
    });
    await fahrzeugZuweisen(tenantId, fahrt.id, fahrzeug, { dispatchMode: "MANUELL", benachrichtigen: false });
    const ergebnis = await wocheKopieren({ quellMontagIso: quelle, ziel: "NAECHSTE_WOCHE" });
    expect("hinweis" in ergebnis && ergebnis.hinweis.map((f) => f.id)).toEqual([fahrt.id]);
    expect(await prisma.shift.count({ where: { tenantId } })).toBe(1);
  });

  it("laufende Schichten werden nie zu Entwürfen (bleiben im Seitenfenster nur zum Lesen)", async () => {
    const bereich = ladeBereich(montagVonIso(tag), tag.slice(0, 7));
    await schichtenSpeichern({ vehicleId: fahrzeug, tagIso: tag, giltFuer: "TAG", entwuerfe: [entwurf("10:00"), { ...entwurf("14:00"), von: "10:00" }] });
    await prisma.shift.updateMany({ where: { tenantId, end: mitUhrzeit(berlinerMitternacht(tag), "10:00") }, data: { startedAt: new Date() } });
    const daten = await schichtplanLaden(bereich.vonIso, bereich.bisIso);
    const amTag = daten.schichten.filter((s) => s.tagIso === tag);
    expect(amTag).toHaveLength(2);
    expect(entwuerfeAus(amTag).map((e) => [e.von, e.bis])).toEqual([["10:00", "14:00"]]);
  });

  it("Fahrer dürfen den Schichtplan weder laden noch ändern", async () => {
    testSitzung.wert = { tenantId, userId: fahrerUserId, role: "FAHRER" };
    await expect(schichtenSpeichern({ vehicleId: fahrzeug, tagIso: tag, giltFuer: "TAG", entwuerfe: [entwurf()] })).rejects.toThrow();
    await expect(schichtplanLaden(tag, tag)).rejects.toThrow();
    expect(await prisma.shift.count({ where: { tenantId } })).toBe(0);
  });
});
