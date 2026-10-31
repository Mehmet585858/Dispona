import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testSitzung } from "../hilfen/sitzungsMock";
import { voiceSystemPrompt } from "@/core/notify/voicePrompt";
import { werkzeugAusfuehren } from "@/core/voice/werkzeuge";
import { weiterleitungsnummerE164 } from "@/core/einrichtung/rufnummer";
import { vapiProvider } from "@/providers/voice/vapi";
import type { TenantVoiceSettings } from "@/providers/voice/types";
import { POST } from "@/app/api/voice/webhook/route";
import { kiEinstellungenSpeichern } from "@/app/einrichtung/[schritt]/actions";
import { firmaRegistrieren } from "@/app/(auth)/registrieren/actions";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth", async () => (await import("../hilfen/sitzungsMock")).authMock);

const EINSTELLUNGEN: TenantVoiceSettings = {
  tenantId: "t1",
  firmenname: "Muster Krankenfahrten",
  ort: "Baesweiler",
  greeting: "Willkommen.",
  voiceId: "stimme-1",
  escalationNumber: "+4924041234",
  bestaetigungsweg: " in Kürze",
};

type Konfig = { assistant: { tools: { type: string; function?: { name: string }; destinations?: { number: string }[] }[]; model: { messages: { content: string }[] } } };

function werkzeugNamen(config: Konfig): string[] {
  return config.assistant.tools.map((t) => t.function?.name ?? t.type);
}

/** Alle Werkzeugnamen, die ein Text erwähnt: snake_case-Namen und das Vapi-Werkzeug transferCall. */
function genannteWerkzeuge(text: string): string[] {
  return [...new Set([...(text.match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? []), ...(text.match(/\btransferCall\b/g) ?? [])])];
}

/**
 * Maßnahme M-47 (Prüfbericht S2-019): Der Prompt befahl für Notfall und "Ich will einen Menschen"
 * das Werkzeug an_mensch_weiterleiten – in der an Vapi gesendeten Konfiguration heißt es aber
 * transferCall. Kam der Aufruf trotzdem bei uns an, antwortete das System "Wird weitergeleitet.",
 * ohne etwas zu tun. Leere oder national geschriebene Weiterleitungsnummern gingen ungeprüft an Vapi.
 */
describe("Weiterleitung an einen Menschen (M-47, S2-019)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("M-47: jedes Werkzeug, das der Prompt nennt, ist in der Vapi-Konfiguration vorhanden", () => {
    const config = vapiProvider.buildAssistantConfig(EINSTELLUNGEN) as Konfig;
    const prompt = config.assistant.model.messages[0].content;
    const angeboten = werkzeugNamen(config);
    const fehlend = genannteWerkzeuge(prompt).filter((name) => !angeboten.includes(name));
    expect(fehlend).toEqual([]);
    expect(prompt).toContain("transferCall");
  });

  it("M-47: der Notfall-Absatz nennt 112 und das tatsächlich angebotene Weiterleitungswerkzeug", () => {
    const config = vapiProvider.buildAssistantConfig(EINSTELLUNGEN) as Konfig;
    const notfall = config.assistant.model.messages[0].content.split("NOTFALL")[1]?.split("\n\n")[0] ?? "";
    expect(notfall).toContain("112");
    expect(notfall).toContain("transferCall");
    expect(werkzeugNamen(config)).toContain("transferCall");
  });

  it("M-47: Notfall-Liste nennt auch Sturz, Schlaganfall-Zeichen und Suizidgedanken – und gilt im Zweifel", () => {
    const text = voiceSystemPrompt(EINSTELLUNGEN, { jetzt: new Date(), weiterleitenWerkzeug: "transferCall" });
    expect(text).toMatch(/Sturz/);
    expect(text).toMatch(/Schlaganfall/);
    expect(text).toMatch(/das Leben nehmen|Suizid/);
    expect(text).toMatch(/Im Zweifel/);
  });

  it("M-47: ohne Weiterleitungsnummer (Live-Demo) nennt der Prompt kein Weiterleitungswerkzeug, der 112-Satz bleibt", () => {
    const config = vapiProvider.buildAssistantConfig({ ...EINSTELLUNGEN, escalationNumber: "" }) as Konfig;
    const prompt = config.assistant.model.messages[0].content;
    const angeboten = werkzeugNamen(config);
    expect(genannteWerkzeuge(prompt).filter((name) => !angeboten.includes(name))).toEqual([]);
    expect(prompt).not.toContain("transferCall");
    expect(prompt).toContain("112");
  });

  it("M-47: eine national geschriebene Nummer kommt bei Vapi als E.164 an, eine ungültige gar nicht", () => {
    const national = vapiProvider.buildAssistantConfig({ ...EINSTELLUNGEN, escalationNumber: "0241 12345" }) as Konfig;
    expect(national.assistant.tools.find((t) => t.type === "transferCall")?.destinations?.[0].number).toBe("+4924112345");
    const kaputt = vapiProvider.buildAssistantConfig({ ...EINSTELLUNGEN, escalationNumber: "Handy Chef" }) as Konfig;
    expect(werkzeugNamen(kaputt)).not.toContain("transferCall");
    expect(kaputt.assistant.model.messages[0].content).not.toContain("transferCall");
  });

  it.each([
    ["0241 12345", "+4924112345"],
    ["0171 2345678", "+491712345678"],
    ["+49 (0) 171 2345678", "+491712345678"],
    ["0049 171 2345678", "+491712345678"],
    ["", null],
    ["Handy Chef", null],
    ["112", null],
  ])("M-47: weiterleitungsnummerE164(%j) → %j", (eingabe, erwartet) => {
    expect(weiterleitungsnummerE164(eingabe)).toBe(erwartet);
  });

  describe("gegen Postgres", () => {
    const kennung = randomUUID().slice(0, 8);
    const NUMMER_AUS = `+4924099${kennung.replace(/\D/g, "").padEnd(6, "1").slice(0, 6)}`;
    const NUMMER_AN = `+4924098${kennung.replace(/\D/g, "").padEnd(6, "2").slice(0, 6)}`;
    let tenantAus: string;
    let tenantAn: string;
    let callId: string;
    let userId: string;
    let zaehler = 0;
    const ALT = process.env.VAPI_WEBHOOK_SECRET;
    const testBeginn = new Date();

    function webhook(body: unknown) {
      return POST(
        new NextRequest("http://localhost:3000/api/voice/webhook", {
          method: "POST",
          headers: { authorization: "Bearer pruef-geheim", "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    }

    function assistantRequest(nummer: string) {
      zaehler += 1;
      return webhook({
        message: { type: "assistant-request", phoneNumber: { number: nummer }, customer: { number: "+491700000000" }, call: { id: `PRUEF_wl_${kennung}_${zaehler}` } },
      });
    }

    async function mandant(name: string, nummer: string, aiActive: boolean) {
      const id = (
        await prisma.tenant.create({
          data: {
            name: `PRUEF_Weiterleitung ${name} ${kennung}`,
            settings: { create: { greeting: "x", voiceId: "x", escalationNumber: "", aiActive, openingHours: {}, serviceAreaCenter: { lat: 50.77, lng: 6.08 } } },
          },
        })
      ).id;
      await prisma.phoneNumber.create({ data: { tenantId: id, e164: nummer, provider: "VAPI" } });
      return id;
    }

    beforeAll(async () => {
      tenantAus = await mandant("aus", NUMMER_AUS, false);
      tenantAn = await mandant("an", NUMMER_AN, true);
      callId = (
        await prisma.call.create({ data: { tenantId: tenantAn, providerCallId: `PRUEF_wl_call_${kennung}`, fromNumber: "+491700000000", toNumber: NUMMER_AN, startedAt: new Date() } })
      ).id;
      userId = (
        await prisma.user.create({ data: { id: randomUUID(), tenantId: tenantAn, email: `pruef-${randomUUID()}@test.invalid`, name: "PRUEF", role: "ADMIN" } })
      ).id;
    });

    beforeEach(() => {
      process.env.VAPI_WEBHOOK_SECRET = "pruef-geheim";
    });

    afterAll(async () => {
      process.env.VAPI_WEBHOOK_SECRET = ALT;
      testSitzung.wert = null;
      await mandantKomplettLoeschen(tenantAus);
      await mandantKomplettLoeschen(tenantAn);
      const registriert = await prisma.tenant.findMany({ where: { name: { startsWith: `PRUEF_Reg ${kennung}` } }, select: { id: true } });
      for (const t of registriert) await mandantKomplettLoeschen(t.id);
      // Eigene Registrierungsversuche entfernen, damit wiederholte Läufe die Ratenbegrenzung (M-23) nicht ausschöpfen.
      await prisma.registrierungsversuch.deleteMany({ where: { at: { gte: testBeginn } } });
    });

    it.each(["an_mensch_weiterleiten", "transferCall"])(
      "M-47: kommt %s doch bei uns an, meldet das System einen Fehler statt \"Wird weitergeleitet.\"",
      async (name) => {
        zaehler += 1;
        const ergebnis = await werkzeugAusfuehren(tenantAn, callId, { id: `PRUEF_tc_${kennung}_${zaehler}`, name, arguments: { grund: "Notfall" } });
        expect(ergebnis.result).toBeUndefined();
        expect(ergebnis.error).toMatch(/Weiterleitung.*nicht/);
        expect(ergebnis.error).toContain("112");
      },
    );

    it("M-47: KI aus und keine gültige Weiterleitungsnummer → kein Weiterleitungsziel mit leerer Nummer", async () => {
      await prisma.tenantSettings.update({ where: { tenantId: tenantAus }, data: { escalationNumber: "" } });
      const antwort = await assistantRequest(NUMMER_AUS);
      const body = (await antwort.json()) as { destination?: { number?: string }; error?: string };
      expect(body.destination).toBeUndefined();
      expect(body.error).toBeTruthy();
    });

    it("M-47: KI aus und Bestandsnummer \"0241 12345\" → Weiterleitung an +4924112345", async () => {
      await prisma.tenantSettings.update({ where: { tenantId: tenantAus }, data: { escalationNumber: "0241 12345" } });
      const antwort = await assistantRequest(NUMMER_AUS);
      const body = (await antwort.json()) as { destination?: { type: string; number: string } };
      expect(body.destination).toEqual(expect.objectContaining({ type: "number", number: "+4924112345" }));
    });

    it("M-47: KI an und Bestandsnummer \"0241 12345\" → transferCall-Ziel +4924112345, Prompt nennt transferCall", async () => {
      await prisma.tenantSettings.update({ where: { tenantId: tenantAn }, data: { escalationNumber: "0241 12345" } });
      const antwort = await assistantRequest(NUMMER_AN);
      const config = (await antwort.json()) as Konfig;
      expect(config.assistant.tools.find((t) => t.type === "transferCall")?.destinations?.[0].number).toBe("+4924112345");
      expect(config.assistant.model.messages[0].content).toContain("transferCall");
    });

    it("M-47: fahrt_stornieren einer laufenden Fahrt verweist nur auf Werkzeuge, die es gibt", async () => {
      const passengerId = (await prisma.passenger.create({ data: { tenantId: tenantAn, firstName: "PRUEF", lastName: "Lauf", phones: ["+491700000000"] } })).id;
      const ortId = (
        await prisma.place.create({ data: { tenantId: tenantAn, label: "PRUEF Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" } })
      ).id;
      const rideId = (
        await prisma.ride.create({
          data: { tenantId: tenantAn, passengerId, pickupPlaceId: ortId, dropoffPlaceId: ortId, pickupAt: new Date(), transportType: "SITZEND", status: "AN_BORD", source: "ANRUF" },
        })
      ).id;
      zaehler += 1;
      const ergebnis = await werkzeugAusfuehren(tenantAn, callId, { id: `PRUEF_tc_${kennung}_${zaehler}`, name: "fahrt_stornieren", arguments: { rideId } });
      const angeboten = werkzeugNamen(vapiProvider.buildAssistantConfig(EINSTELLUNGEN) as Konfig);
      const text = ergebnis.result ?? ergebnis.error ?? "";
      expect(text).toMatch(/kann ich nicht stornieren/);
      expect(genannteWerkzeuge(text).filter((name) => !angeboten.includes(name))).toEqual([]);
    });

    it("M-47: Einrichtung speichert die Weiterleitungsnummer als E.164 und lehnt leere/ungültige ab", async () => {
      testSitzung.wert = { tenantId: tenantAn, userId, role: "ADMIN" };
      const ok = await kiEinstellungenSpeichern({ voiceId: "Clara", greeting: "Hallo.", escalationNumber: "0171 2345678" });
      expect(ok).toEqual({ ok: true, escalationNumber: "+491712345678" });
      expect((await prisma.tenantSettings.findUniqueOrThrow({ where: { tenantId: tenantAn } })).escalationNumber).toBe("+491712345678");

      for (const falsch of ["", "Handy Chef", "112"]) {
        const ergebnis = await kiEinstellungenSpeichern({ voiceId: "Clara", greeting: "Hallo.", escalationNumber: falsch });
        expect(ergebnis.ok).toBe(false);
      }
      expect((await prisma.tenantSettings.findUniqueOrThrow({ where: { tenantId: tenantAn } })).escalationNumber).toBe("+491712345678");
    });

    it("M-47: Registrierung lehnt eine ungültige Handynummer ab und speichert eine gültige als E.164", async () => {
      const basis = { vorname: "PRUEF", nachname: "Reg" };
      const falsch = await firmaRegistrieren({ ...basis, firmenname: `PRUEF_Reg ${kennung} A`, email: `pruef-reg-a-${kennung}@test.invalid`, handynummer: "Handy Chef" });
      expect(falsch.ok).toBe(false);
      expect(await prisma.tenant.count({ where: { name: `PRUEF_Reg ${kennung} A` } })).toBe(0);

      const gut = await firmaRegistrieren({ ...basis, firmenname: `PRUEF_Reg ${kennung} B`, email: `pruef-reg-b-${kennung}@test.invalid`, handynummer: "0171 2345678" });
      expect(gut.ok).toBe(true);
      const tenant = await prisma.tenant.findFirstOrThrow({ where: { name: `PRUEF_Reg ${kennung} B` }, include: { settings: true } });
      expect(tenant.settings?.escalationNumber).toBe("+491712345678");
    });
  });
});
