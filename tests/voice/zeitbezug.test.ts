import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { voiceSystemPrompt } from "@/core/notify/voicePrompt";
import { werkzeugAusfuehren } from "@/core/voice/werkzeuge";
import { vapiProvider } from "@/providers/voice/vapi";
import type { TenantVoiceSettings } from "@/providers/voice/types";
import { datumIso, tagVerschieben } from "@/core/shifts/week";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

const EINSTELLUNGEN: TenantVoiceSettings = {
  tenantId: "t1",
  firmenname: "Muster Krankenfahrten",
  ort: "Baesweiler",
  greeting: "Willkommen.",
  voiceId: "stimme-1",
  escalationNumber: "+4924041234",
  bestaetigungsweg: " in Kürze",
};

/**
 * Maßnahme M-46 Punkt 1 (Prüfbericht S1-007): Die Anweisungen an die KI enthielten weder Datum noch
 * Uhrzeit noch Zeitzone, das Werkzeug verlangt aber "JJJJ-MM-TT". Ein Sprachmodell kennt das
 * heutige Datum nicht – "morgen", "übermorgen", "nächsten Montag" waren nicht auflösbar.
 */
describe("Zeitbezug im Prompt (M-46, S1-007)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("M-46: Prompt nennt Wochentag, Datum, Uhrzeit und Zeitzone – Montag 23:40 Berliner Zeit", () => {
    const text = voiceSystemPrompt(EINSTELLUNGEN, { jetzt: new Date("2026-11-02T22:40:00Z") });
    expect(text).toContain("Heute ist Montag, der 02.11.2026 (2026-11-02)");
    expect(text).toContain("23:40 Uhr");
    expect(text).toContain("Europe/Berlin");
    // Relative Angaben vorgerechnet: morgen und die nächsten Wochentage.
    expect(text).toContain("Dienstag 03.11.2026 = 2026-11-03");
    expect(text).toContain("Montag 09.11.2026 = 2026-11-09");
  });

  it("M-46: Datum nach Berliner Zeit, nicht nach Serverzeit – 00:30 Berlin ist in UTC noch der Vortag", () => {
    const text = voiceSystemPrompt(EINSTELLUNGEN, { jetzt: new Date("2026-11-02T23:30:00Z") });
    expect(text).toContain("Heute ist Dienstag, der 03.11.2026 (2026-11-03)");
    expect(text).toContain("00:30 Uhr");
  });

  it("M-46: die an Vapi ausgelieferte Konfiguration enthält das Datum des Anrufzeitpunkts", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T22:40:00Z"));
    const config = vapiProvider.buildAssistantConfig(EINSTELLUNGEN) as { assistant: { model: { messages: { content: string }[] } } };
    expect(config.assistant.model.messages[0].content).toContain("Heute ist Montag, der 02.11.2026");
  });
});

/**
 * Maßnahme M-46 Punkte 2 und 3 (Prüfbericht S1-007, S2-020): Was die KI rät, nahm das System
 * ungeprüft – eine Fahrt für gestern wurde angelegt und vorgeschlagen, "halb acht" wurde 00:00 Uhr,
 * "2026-02-30" der 2. März; "morgen" kam als rohes "Invalid time value" zurück.
 */
describe("KI-Werkzeuge prüfen Datum und Uhrzeit (M-46, S1-007, S2-020)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let callId: string;
  let ortA: string;
  let ortB: string;
  let zaehler = 0;
  const heute = datumIso(new Date());
  const morgen = tagVerschieben(heute, 1);

  function aufruf(name: string, args: Record<string, unknown>) {
    zaehler += 1;
    return werkzeugAusfuehren(tenantId, callId, { id: `PRUEF_tc_${kennung}_${zaehler}`, name, arguments: args });
  }

  function fahrt(args: Record<string, unknown>) {
    return aufruf("fahrt_anlegen", {
      fahrgastVorname: "PRUEF",
      fahrgastNachname: `Zeit${kennung}`,
      pickupPlaceId: ortA,
      dropoffPlaceId: ortB,
      datum: morgen,
      abholzeit: "06:30",
      transportType: "SITZEND",
      prescription: "JA",
      approval: "NICHT_NOETIG",
      ...args,
    });
  }

  async function anzahl() {
    return {
      fahrten: await prisma.ride.count({ where: { tenantId } }),
      fahrgaeste: await prisma.passenger.count({ where: { tenantId } }),
    };
  }

  beforeAll(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: {
          name: `PRUEF_Zeitbezug ${kennung}`,
          settings: { create: { greeting: "x", voiceId: "x", escalationNumber: "+4900", openingHours: {}, serviceAreaCenter: { lat: 50.77, lng: 6.08 } } },
        },
      })
    ).id;
    callId = (
      await prisma.call.create({
        data: { tenantId, providerCallId: `PRUEF_zeit_${kennung}`, fromNumber: "+4911100000009", toNumber: "+4924010000000", startedAt: new Date() },
      })
    ).id;
    ortA = (await prisma.place.create({ data: { tenantId, label: "PRUEF A", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" } })).id;
    ortB = (await prisma.place.create({ data: { tenantId, label: "PRUEF B", street: "B 2", zip: "52062", city: "Aachen", lat: 50.78, lng: 6.09, type: "SONSTIGES" } })).id;
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  it("M-46: fahrt_anlegen für gestern wird abgelehnt – keine Fahrt, kein neuer Fahrgast, klare Rückfrage", async () => {
    const vorher = await anzahl();
    const ergebnis = await fahrt({ datum: tagVerschieben(heute, -1) });
    expect(ergebnis.result ?? "").toMatch(/^Problem: .*Vergangenheit/);
    expect(ergebnis.result).toContain(heute);
    expect(await anzahl()).toEqual(vorher);
  });

  it("M-46: fahrt_anlegen mit Termin vor der Abholung wird abgelehnt", async () => {
    const vorher = await anzahl();
    const ergebnis = await fahrt({ abholzeit: "09:00", terminzeit: "08:00" });
    expect(ergebnis.result ?? "").toMatch(/^Problem: .*Termin/);
    expect(await anzahl()).toEqual(vorher);
  });

  it.each([
    ["abholzeit", "halb acht"],
    ["abholzeit", "6.30"],
    ["abholzeit", "0630"],
    ["abholzeit", "25:00"],
    ["abholzeit", ""],
    ["terminzeit", "acht Uhr"],
    ["rueckfahrtzeit", "14 Uhr"],
    ["datum", "2026-02-30"],
    ["datum", "morgen"],
    ["datum", "03.11.2026"],
    ["fahrgastGeburtsdatum", "03.05.1941"],
  ])("M-46 (S2-020): fahrt_anlegen mit %s = %j → verständlicher Fehler, nichts angelegt", async (feld, wert) => {
    const vorher = await anzahl();
    const ergebnis = await fahrt({ [feld]: wert, ...(feld === "rueckfahrtzeit" ? { rueckfahrt: true } : {}) });
    expect(ergebnis.result).toBeUndefined();
    expect(ergebnis.error).toContain(feld);
    expect(ergebnis.error).toMatch(/HH:MM|JJJJ-MM-TT/);
    expect(ergebnis.error).not.toContain("Invalid time value");
    expect(ergebnis.error).not.toContain('"code"');
    expect(await anzahl()).toEqual(vorher);
  });

  it("M-46: eine korrekte Fahrt wird weiterhin erfasst, die Antwort nennt Wochentag und Datum zum Gegenlesen", async () => {
    const ergebnis = await fahrt({ fahrgastNachname: `ZeitOk${kennung}` });
    expect(ergebnis.error).toBeUndefined();
    expect(ergebnis.result).toMatch(/^Fahrt erfasst für \w+, \d{2}\.\d{2}\.\d{4}\./);
  });

  it.each([
    ["serie_anlegen", { wochentage: ["MO"], abholzeit: "06:30", bis: "2026-13-45" }, "bis"],
    ["serie_anlegen", { wochentage: ["MO"], abholzeit: "halb sieben", bis: "2026-12-31" }, "abholzeit"],
    ["fahrt_finden", { passengerId: "x", datum: "morgen" }, "datum"],
    ["fahrgast_suchen", { nachname: "PRUEF", geburtsdatum: "03.05.1941" }, "geburtsdatum"],
    ["fahrt_aendern", { rideId: "x", abholzeit: "halb acht" }, "abholzeit"],
    ["fahrt_aendern", { rideId: "x", terminzeit: "25:00" }, "terminzeit"],
    ["serie_beenden", { passengerId: "x", ab: "2026-02-30" }, "ab"],
  ])("M-46 (S2-020): %s mit ungültiger Zeitangabe → verständlicher Fehler", async (name, args, feld) => {
    const ergebnis = await aufruf(name, {
      ...(name === "serie_anlegen"
        ? { fahrgastVorname: "PRUEF", fahrgastNachname: "Serie", pickupPlaceId: ortA, dropoffPlaceId: ortB, transportType: "SITZEND", prescription: "JA", approval: "NICHT_NOETIG" }
        : {}),
      ...args,
    });
    expect(ergebnis.result).toBeUndefined();
    expect(ergebnis.error).toContain(feld);
    expect(ergebnis.error).toMatch(/HH:MM|JJJJ-MM-TT/);
  });

  it("M-46: fahrt_aendern auf eine Uhrzeit in der Vergangenheit wird abgelehnt, die Fahrt bleibt unverändert", async () => {
    const passengerId = (
      await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: `Aendern${kennung}`, phones: ["+4911100000009"] } })
    ).id;
    // Fahrt heute um 23:59 – eine Änderung auf 00:01 heute liegt in der Vergangenheit (außer der Test läuft um Mitternacht).
    const pickupAt = new Date(Date.now() + 5 * 60_000);
    const rideId = (
      await prisma.ride.create({
        data: { tenantId, passengerId, pickupPlaceId: ortA, dropoffPlaceId: ortB, pickupAt, transportType: "SITZEND", status: "ERFASST", source: "ANRUF" },
      })
    ).id;
    const zweiStundenFrueher = new Date(pickupAt.getTime() - 2 * 3600_000);
    if (datumIso(zweiStundenFrueher) !== datumIso(pickupAt)) return; // kurz nach Mitternacht nicht sinnvoll prüfbar
    const uhrzeit = zweiStundenFrueher.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
    const ergebnis = await aufruf("fahrt_aendern", { rideId, abholzeit: uhrzeit });
    expect(ergebnis.result ?? "").toMatch(/^Problem: .*Vergangenheit/);
    expect((await prisma.ride.findUniqueOrThrow({ where: { id: rideId } })).pickupAt.toISOString()).toBe(pickupAt.toISOString());
  });
});
