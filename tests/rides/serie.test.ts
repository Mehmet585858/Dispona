import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serieAnlegen, serienVerlaengern } from "@/core/rides/serie";
import { istFeiertagNrw } from "@/core/shifts/feiertageNrw";
import { rruleAusWochentagen, terminePlanen, WOCHENTAGE } from "@/core/shifts/rrule";
import { berlinerMitternacht, datumIso, tagVerschieben } from "@/core/shifts/week";
import { prisma } from "@/lib/prisma";
import type { SerieEingabe } from "@/core/rides/validation";

describe("serieAnlegen / serienVerlaengern", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let ortAId: string;
  let ortBId: string;
  let passengerId: string;

  const heute = datumIso(new Date());
  const weitInDerZukunft = tagVerschieben(heute, 60);

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Test-Serie ${kennung}`,
        settings: {
          create: {
            greeting: "Test",
            voiceId: "test",
            escalationNumber: "+4924019999999",
            openingHours: {},
            serviceAreaCenter: { lat: 50.77, lng: 6.08 },
            depotAddress: { street: "Betriebshof 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08 },
          },
        },
      },
    });
    tenantId = tenant.id;

    const ortA = await prisma.place.create({
      data: { tenantId, label: "Ort A", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
    });
    ortAId = ortA.id;
    const ortB = await prisma.place.create({
      data: { tenantId, label: "Ort B", street: "B 1", zip: "52062", city: "Aachen", lat: 50.78, lng: 6.09, type: "SONSTIGES" },
    });
    ortBId = ortB.id;

    const passenger = await prisma.passenger.create({
      data: { tenantId, firstName: "Test", lastName: "Fahrgast", phones: [] },
    });
    passengerId = passenger.id;
  });

  afterAll(async () => {
    await prisma.rideStatusEvent.deleteMany({ where: { tenantId } });
    await prisma.suggestion.deleteMany({ where: { tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.ride.deleteMany({ where: { tenantId } });
    await prisma.rideSeries.deleteMany({ where: { tenantId } });
    await prisma.approval.deleteMany({ where: { tenantId } });
    await prisma.place.deleteMany({ where: { tenantId } });
    await prisma.passenger.deleteMany({ where: { tenantId } });
    await prisma.tenantSettings.delete({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  function basisEingabe(overrides: Partial<SerieEingabe> = {}): SerieEingabe {
    return {
      passengerId,
      pickupPlaceId: ortAId,
      dropoffPlaceId: ortBId,
      wochentage: [...WOCHENTAGE],
      abholzeit: "09:00",
      terminzeit: "",
      rueckfahrt: false,
      rueckfahrtzeit: "",
      bis: weitInDerZukunft,
      transportType: "SITZEND",
      companion: false,
      assistanceNotes: "",
      prescription: "NICHT_NOETIG",
      approval: "NICHT_NOETIG",
      ...overrides,
    };
  }

  it(
    "erzeugt für jeden Wochentag eine Fahrt bis zum 14-Tage-Horizont",
    async () => {
      const ergebnis = await serieAnlegen(tenantId, basisEingabe(), { source: "MANUELL" });
      expect(ergebnis.erzeugteFahrten).toHaveLength(14);

      const fahrten = await prisma.ride.findMany({ where: { seriesId: ergebnis.seriesId } });
      expect(fahrten).toHaveLength(14);
      expect(fahrten.every((f) => f.seriesId === ergebnis.seriesId)).toBe(true);
    },
    20000,
  );

  it("legt bei Rückfahrt doppelt so viele Fahrten an", async () => {
    const kurzeZukunft = tagVerschieben(heute, 2);
    const ergebnis = await serieAnlegen(
      tenantId,
      basisEingabe({ rueckfahrt: true, rueckfahrtzeit: "17:00", bis: kurzeZukunft }),
      { source: "MANUELL" },
    );
    const erwarteteTage = terminePlanen(rruleAusWochentagen([...WOCHENTAGE]), heute, kurzeZukunft).length;
    const fahrten = await prisma.ride.findMany({ where: { seriesId: ergebnis.seriesId } });
    expect(fahrten).toHaveLength(erwarteteTage * 2);
  }, 15000);

  it("meldet Feiertage im Erzeugungszeitraum korrekt als Hinweis", { timeout: 20000 }, async () => {
    const ergebnis = await serieAnlegen(tenantId, basisEingabe(), { source: "MANUELL" });
    const horizont = tagVerschieben(heute, 13);
    const erwarteteTermine = terminePlanen(rruleAusWochentagen([...WOCHENTAGE]), heute, horizont);
    const erwarteteHinweise = erwarteteTermine
      .map((datum) => ({ datum, name: istFeiertagNrw(datum) }))
      .filter((f): f is { datum: string; name: string } => f.name !== null);
    expect(ergebnis.feiertagsHinweise).toEqual(erwarteteHinweise);
  });

  it("warnt, wenn die Genehmigung der Kasse vor Serienende abläuft", { timeout: 20000 }, async () => {
    const baldAblaufend = tagVerschieben(heute, 5);
    await prisma.approval.create({
      data: { tenantId, passengerId, validFrom: berlinerMitternacht(heute), validUntil: berlinerMitternacht(baldAblaufend) },
    });

    const ergebnis = await serieAnlegen(tenantId, basisEingabe({ bis: weitInDerZukunft }), { source: "MANUELL" });
    expect(ergebnis.genehmigungsWarnung).not.toBeNull();
    expect(ergebnis.genehmigungsWarnung).toContain(baldAblaufend);
  });

  it("serienVerlaengern erzeugt keine doppelten Fahrten für bereits gefüllte Serien", async () => {
    const vorher = await prisma.ride.count({ where: { tenantId } });
    const ergebnis = await serienVerlaengern(tenantId);
    const nachher = await prisma.ride.count({ where: { tenantId } });
    expect(ergebnis.erzeugteFahrten).toBe(0);
    expect(nachher).toBe(vorher);
  });

  it("serienVerlaengern lässt bereits beendete Serien unberührt", async () => {
    const gestern = tagVerschieben(heute, -1);
    const beendeteSerie = await prisma.rideSeries.create({
      data: {
        tenantId,
        passengerId,
        rrule: rruleAusWochentagen([...WOCHENTAGE]),
        pickupTime: "09:00",
        until: berlinerMitternacht(gestern),
        template: {
          pickupPlaceId: ortAId,
          dropoffPlaceId: ortBId,
          rueckfahrt: false,
          rueckfahrtzeit: "",
          transportType: "SITZEND",
          companion: false,
          assistanceNotes: "",
          prescription: "NICHT_NOETIG",
          approval: "NICHT_NOETIG",
        },
      },
    });

    await serienVerlaengern(tenantId);
    const fahrten = await prisma.ride.findMany({ where: { seriesId: beendeteSerie.id } });
    expect(fahrten).toHaveLength(0);
  });
});
