import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { werkzeugAusfuehren } from "@/core/voice/werkzeuge";
import { anrufSicherstellen } from "@/core/voice/anruf";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/**
 * Prüfbericht S2-014: Ein identisch wiederholter tool-calls-Webhook (Vapi-Retry nach Timeout)
 * legte dieselbe Fahrt zweimal an. Jeder toolCallId darf genau einmal wirken.
 */
describe("werkzeugAusfuehren – Idempotenz je toolCallId (S2-014)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let callId: string;
  let passengerId: string;
  let ortId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: `PRUEF_Replay ${kennung}`,
        settings: {
          create: {
            greeting: "x", voiceId: "x", escalationNumber: "+4900", openingHours: {},
            serviceAreaCenter: { lat: 50.77, lng: 6.08 },
            depotAddress: { street: "Hof 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08 },
          },
        },
      },
    });
    tenantId = tenant.id;
    const call = await prisma.call.create({
      data: { tenantId, providerCallId: `PRUEF_replay_call_${kennung}`, toNumber: "+4924010000000", startedAt: new Date() },
    });
    callId = call.id;
    passengerId = (await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Replay", phones: [] } })).id;
    // Maßnahme M-13: gebucht wird nur für einen im Anruf bestätigten Fahrgast (wie nach einem
    // erfolgreichen fahrgast_suchen im selben Gespräch).
    await prisma.call.update({ where: { id: callId }, data: { identifiedPassengerIds: [passengerId] } });
    ortId = (
      await prisma.place.create({
        data: { tenantId, label: "PRUEF Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
      })
    ).id;
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  function fahrtAnlegenAufruf(toolCallId: string) {
    return {
      id: toolCallId,
      name: "fahrt_anlegen",
      arguments: {
        passengerId,
        pickupPlaceId: ortId,
        dropoffPlaceId: ortId,
        datum: "2026-11-03",
        abholzeit: "09:00",
        transportType: "SITZEND",
        prescription: "JA",
        approval: "NICHT_NOETIG",
      },
    };
  }

  it("S2-014: derselbe fahrt_anlegen-Aufruf zweimal → eine Fahrt, zweite Antwort ist die erste", async () => {
    const aufruf = fahrtAnlegenAufruf(`PRUEF_tc_${kennung}`);
    const erste = await werkzeugAusfuehren(tenantId, callId, aufruf);
    const zweite = await werkzeugAusfuehren(tenantId, callId, aufruf);
    expect(erste.error).toBeUndefined();
    expect(zweite).toEqual(erste);
    expect(await prisma.ride.count({ where: { callId } })).toBe(1);
  });

  it("S2-014: zwei gleichzeitig eintreffende Wiederholungen legen trotzdem nur eine Fahrt an", async () => {
    const aufruf = fahrtAnlegenAufruf(`PRUEF_tc2_${kennung}`);
    const vorher = await prisma.ride.count({ where: { callId } });
    const ergebnisse = await Promise.all([
      werkzeugAusfuehren(tenantId, callId, { ...aufruf, arguments: { ...aufruf.arguments, abholzeit: "14:00" } }),
      werkzeugAusfuehren(tenantId, callId, { ...aufruf, arguments: { ...aufruf.arguments, abholzeit: "14:00" } }),
    ]);
    expect(ergebnisse.every((e) => !e.error)).toBe(true);
    expect(await prisma.ride.count({ where: { callId } })).toBe(vorher + 1);
  });

  it("verschiedene toolCallIds wirken weiterhin unabhängig", async () => {
    const vorher = await prisma.ride.count({ where: { callId } });
    const a = fahrtAnlegenAufruf(`PRUEF_tc3a_${kennung}`);
    const b = fahrtAnlegenAufruf(`PRUEF_tc3b_${kennung}`);
    await werkzeugAusfuehren(tenantId, callId, { ...a, arguments: { ...a.arguments, abholzeit: "16:00" } });
    await werkzeugAusfuehren(tenantId, callId, { ...b, arguments: { ...b.arguments, abholzeit: "18:00" } });
    expect(await prisma.ride.count({ where: { callId } })).toBe(vorher + 2);
  });

  it("S2-014: anrufSicherstellen übersteht zwei gleichzeitige Erstkontakte (eine Call-Zeile, kein Fehler)", async () => {
    const providerCallId = `PRUEF_parallel_${kennung}`;
    const ergebnis = await Promise.allSettled([
      anrufSicherstellen(tenantId, providerCallId, { toNumber: "+4924010000000" }),
      anrufSicherstellen(tenantId, providerCallId, { toNumber: "+4924010000000" }),
    ]);
    expect(ergebnis.map((e) => e.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(await prisma.call.count({ where: { providerCallId } })).toBe(1);
  });
});
