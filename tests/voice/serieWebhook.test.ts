import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { werkzeugAusfuehren } from "@/core/voice/werkzeuge";
import { routingProvider } from "@/providers/routing";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";
import { datumIso, tagVerschieben } from "@/core/shifts/week";

/**
 * Maßnahme M-14 Punkt 4 (Prüfbericht V-005/S3-016): serie_anlegen erzeugte im Webhook alle Termine
 * samt Vorschlagsrechnung – rund 500 Routing-Aufrufe, 50–150 s, länger als das Zeitlimit des
 * Telefonanbieters, der dann wiederholt. Jetzt antwortet der Webhook sofort; die Termine entstehen
 * in einer Hintergrundaufgabe nach der Antwort.
 */
describe("serie_anlegen im Webhook (M-14)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let callId: string;
  let passengerId: string;
  let ortId: string;

  beforeAll(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: {
          name: `PRUEF_SerieWebhook ${kennung}`,
          settings: {
            create: {
              greeting: "x", voiceId: "x", escalationNumber: "+4900", openingHours: {},
              serviceAreaCenter: { lat: 50.77, lng: 6.08 },
              depotAddress: { street: "Hof 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08 },
            },
          },
        },
      })
    ).id;
    callId = (await prisma.call.create({ data: { tenantId, providerCallId: `PRUEF_serie_${kennung}`, toNumber: "+490", startedAt: new Date() } })).id;
    passengerId = (await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Serie", phones: [] } })).id;
    await prisma.call.update({ where: { id: callId }, data: { identifiedPassengerIds: [passengerId] } });
    ortId = (
      await prisma.place.create({
        data: { tenantId, label: "PRUEF Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
      })
    ).id;
    await prisma.vehicle.create({ data: { tenantId, plate: `PRUEF-${kennung}` } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await mandantKomplettLoeschen(tenantId);
  });

  it("M-14: der Webhook antwortet ohne Routing-Aufrufe; die Termine entstehen erst in der Hintergrundaufgabe", async () => {
    const matrix = vi.spyOn(routingProvider, "matrix");
    const fahrzeit = vi.spyOn(routingProvider, "travelTimeMinutes");
    const aufgaben: (() => Promise<unknown>)[] = [];

    const ergebnis = await werkzeugAusfuehren(
      tenantId,
      callId,
      {
        id: `PRUEF_tc_${kennung}`,
        name: "serie_anlegen",
        arguments: {
          passengerId,
          pickupPlaceId: ortId,
          dropoffPlaceId: ortId,
          wochentage: ["MO", "MI", "FR"],
          abholzeit: "07:00",
          bis: tagVerschieben(datumIso(new Date()), 30),
          transportType: "SITZEND",
          prescription: "JA",
          approval: "JA",
        },
      },
      { hintergrund: (aufgabe) => aufgaben.push(aufgabe) },
    );

    expect(ergebnis.error).toBeUndefined();
    expect(ergebnis.result).toMatch(/Serie angelegt/);
    expect(matrix.mock.calls.length + fahrzeit.mock.calls.length).toBe(0);
    expect(await prisma.ride.count({ where: { tenantId } })).toBe(0);
    expect(aufgaben).toHaveLength(1);

    await aufgaben[0]();
    expect(await prisma.ride.count({ where: { tenantId } })).toBeGreaterThan(0);
  });
});
