import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serieAendern, serieAnlegen, serieBeenden, seriePausieren, serienVerlaengern } from "@/core/rides/serie";
import { werkzeugAusfuehren } from "@/core/voice/werkzeuge";
import { berlinerMitternacht, datumIso, tagVerschieben } from "@/core/shifts/week";
import { wochentageAusRrule } from "@/core/shifts/rrule";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";
import type { SerieEingabe } from "@/core/rides/validation";

/**
 * Maßnahme M-22 (Prüfbericht S2-005, docs/13 R2-10): Eine Dialyse-Serie lief nach Anlage bis zum
 * Enddatum weiter – auch nach Umzug, Zentrumswechsel oder Tod. Es gab weder in der Oberfläche noch
 * für die KI eine Funktion, sie zu beenden, zu pausieren oder zu ändern.
 */
describe("Serien beenden, pausieren, ändern (M-22)", () => {
  const kennung = randomUUID().slice(0, 8);
  const heute = datumIso(new Date());
  let tenantId: string;
  let passengerId: string;
  let ortA: string;
  let ortB: string;

  function eingabe(teil: Partial<SerieEingabe> = {}): SerieEingabe {
    return {
      passengerId,
      pickupPlaceId: ortA,
      dropoffPlaceId: ortB,
      wochentage: ["MO", "DI", "MI", "DO", "FR", "SA", "SO"],
      abholzeit: "07:00",
      terminzeit: "",
      rueckfahrt: false,
      rueckfahrtzeit: "",
      bis: tagVerschieben(heute, 60),
      transportType: "SITZEND",
      companion: false,
      assistanceNotes: "",
      prescription: "JA",
      approval: "NICHT_NOETIG",
      ...teil,
    };
  }

  async function kuenftigeFahrten(seriesId: string) {
    return prisma.ride.findMany({
      where: { seriesId, pickupAt: { gte: berlinerMitternacht(tagVerschieben(heute, 1)) } },
      orderBy: { pickupAt: "asc" },
    });
  }

  beforeAll(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: {
          name: `PRUEF_SerieVerwalten ${kennung}`,
          settings: {
            create: {
              greeting: "x", voiceId: "x", escalationNumber: "+4900", openingHours: {},
              serviceAreaCenter: { lat: 50.77, lng: 6.08 },
            },
          },
        },
      })
    ).id;
    passengerId = (await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Serie", phones: [] } })).id;
    const ort = (lat: number) =>
      prisma.place.create({
        data: { tenantId, label: "PRUEF Ort", street: "A 1", zip: "52062", city: "Aachen", lat, lng: 6.08, type: "SONSTIGES" },
      });
    ortA = (await ort(50.77)).id;
    ortB = (await ort(50.78)).id;
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  it("M-22 (S2-005): Serie beenden → künftige Fahrten STORNIERT, serienVerlaengern erzeugt keine neuen", async () => {
    const { seriesId } = await serieAnlegen(tenantId, eingabe(), { source: "MANUELL" });
    expect((await kuenftigeFahrten(seriesId)).length).toBeGreaterThan(5);

    const ab = tagVerschieben(heute, 1);
    await serieBeenden(tenantId, seriesId, ab);
    const nachher = await kuenftigeFahrten(seriesId);
    expect(nachher.every((f) => f.status === "STORNIERT")).toBe(true);

    const vorher = await prisma.ride.count({ where: { seriesId } });
    await serienVerlaengern(tenantId);
    expect(await prisma.ride.count({ where: { seriesId } })).toBe(vorher);
    expect(datumIso((await prisma.rideSeries.findUniqueOrThrow({ where: { id: seriesId } })).until) < ab).toBe(true);
  });

  it("M-22/M-19: eine schon laufende Fahrt der Serie bleibt beim Beenden stehen", async () => {
    const { seriesId } = await serieAnlegen(tenantId, eingabe(), { source: "MANUELL" });
    const [erste] = await kuenftigeFahrten(seriesId);
    await prisma.ride.update({ where: { id: erste.id }, data: { status: "UNTERWEGS" } });
    await serieBeenden(tenantId, seriesId, heute);
    expect((await prisma.ride.findUniqueOrThrow({ where: { id: erste.id } })).status).toBe("UNTERWEGS");
  });

  it("M-22: Pausieren storniert Fahrten im Zeitraum; serienVerlaengern legt dort keine neuen an, danach schon", async () => {
    const { seriesId } = await serieAnlegen(tenantId, eingabe(), { source: "MANUELL" });
    const von = tagVerschieben(heute, 3);
    const bis = tagVerschieben(heute, 5);
    await seriePausieren(tenantId, seriesId, von, bis);

    const fahrten = await prisma.ride.findMany({ where: { seriesId } });
    const imZeitraum = fahrten.filter((f) => datumIso(f.pickupAt) >= von && datumIso(f.pickupAt) <= bis);
    expect(imZeitraum.length).toBe(3);
    expect(imZeitraum.every((f) => f.status === "STORNIERT")).toBe(true);
    expect(fahrten.filter((f) => datumIso(f.pickupAt) > bis).every((f) => f.status !== "STORNIERT")).toBe(true);

    // Stornierte Fahrten im Zeitraum entfernen und verlängern: keine neuen im Zeitraum.
    const ids = imZeitraum.map((f) => f.id);
    await prisma.rideStatusEvent.deleteMany({ where: { rideId: { in: ids } } });
    await prisma.suggestion.deleteMany({ where: { rideId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { rideId: { in: ids } } });
    await prisma.ride.deleteMany({ where: { id: { in: ids } } });
    await serienVerlaengern(tenantId);
    const danach = await prisma.ride.findMany({ where: { seriesId } });
    expect(danach.filter((f) => datumIso(f.pickupAt) >= von && datumIso(f.pickupAt) <= bis)).toHaveLength(0);
  });

  it("M-22: Ändern – neue Abholzeit gilt für künftige Fahrten, entfernte Wochentage werden storniert, neue erzeugt", async () => {
    const { seriesId } = await serieAnlegen(tenantId, eingabe({ wochentage: ["MO", "MI", "FR"] }), { source: "MANUELL" });
    await serieAendern(tenantId, seriesId, { abholzeit: "09:30", wochentage: ["DI", "DO"] });

    const serie = await prisma.rideSeries.findUniqueOrThrow({ where: { id: seriesId } });
    expect(serie.pickupTime).toBe("09:30");
    expect(wochentageAusRrule(serie.rrule)).toEqual(["DI", "DO"]);

    const aktiv = (await kuenftigeFahrten(seriesId)).filter((f) => f.status !== "STORNIERT");
    expect(aktiv.length).toBeGreaterThan(0);
    for (const f of aktiv) {
      const uhrzeit = f.pickupAt.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
      expect(uhrzeit).toBe("09:30");
      // Wochentag des Berliner Kalendertags: 2 = Dienstag, 4 = Donnerstag.
      const wochentag = new Date(`${datumIso(f.pickupAt)}T12:00:00Z`).getUTCDay();
      expect([2, 4]).toContain(wochentag);
    }
  });

  it("M-22: KI-Werkzeug serie_beenden – nur für den im Anruf bestätigten Fahrgast", async () => {
    const { seriesId } = await serieAnlegen(tenantId, eingabe(), { source: "MANUELL" });
    const fremderAnruf = (
      await prisma.call.create({ data: { tenantId, providerCallId: `PRUEF_sb1_${kennung}`, toNumber: "+490", startedAt: new Date() } })
    ).id;
    const abgelehnt = await werkzeugAusfuehren(tenantId, fremderAnruf, {
      id: `PRUEF_sb1_${kennung}`,
      name: "serie_beenden",
      arguments: { passengerId },
    });
    expect(abgelehnt.result ?? abgelehnt.error).toMatch(/nicht bestätigt/);
    expect((await kuenftigeFahrten(seriesId)).some((f) => f.status !== "STORNIERT")).toBe(true);

    const eigenerAnruf = (
      await prisma.call.create({
        data: { tenantId, providerCallId: `PRUEF_sb2_${kennung}`, toNumber: "+490", startedAt: new Date(), identifiedPassengerIds: [passengerId] },
      })
    ).id;
    const ergebnis = await werkzeugAusfuehren(tenantId, eigenerAnruf, {
      id: `PRUEF_sb2_${kennung}`,
      name: "serie_beenden",
      arguments: { passengerId, seriesId, ab: tagVerschieben(heute, 1) },
    });
    expect(ergebnis.error).toBeUndefined();
    expect(ergebnis.result).toMatch(/beendet/);
    expect((await kuenftigeFahrten(seriesId)).every((f) => f.status === "STORNIERT")).toBe(true);
  });
});
