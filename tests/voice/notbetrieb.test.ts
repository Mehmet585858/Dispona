import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { vapiProvider } from "@/providers/voice/vapi";
import type { TenantVoiceSettings } from "@/providers/voice/types";
import { POST } from "@/app/api/voice/webhook/route";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

const EINSTELLUNGEN: TenantVoiceSettings = {
  tenantId: "t1",
  firmenname: "Muster Krankenfahrten",
  ort: "Baesweiler",
  greeting: "Willkommen bei Muster Krankenfahrten, hier spricht eine KI.",
  voiceId: "stimme-1",
  escalationNumber: "",
  bestaetigungsweg: " in Kürze",
};

type Konfig = {
  assistant: {
    firstMessage: string;
    tools: { type: string; function?: { name: string }; destinations?: { number: string }[] }[];
    model: { messages: { content: string }[] };
  };
};

function werkzeugNamen(config: Konfig): string[] {
  return config.assistant.tools.map((t) => t.function?.name ?? t.type);
}

/** Alle Werkzeugnamen, die ein Text erwähnt: snake_case-Namen und das Vapi-Werkzeug transferCall. */
function genannteWerkzeuge(text: string): string[] {
  return [...new Set([...(text.match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? []), ...(text.match(/\btransferCall\b/g) ?? [])])];
}

/**
 * Entscheidung B1 des Auftraggebers zu M-47 (S2-019, V-015): Ist die KI ausgeschaltet (oder
 * außerhalb ihres Zeitplans) und keine gültige Weiterleitungsnummer hinterlegt, lehnte der Webhook
 * den Anruf gegenüber Vapi ab – was der Anrufer dann hört, war unbekannt. Jetzt wird der Anruf
 * im Notbetrieb angenommen: Hinweis auf die 112 bei Notfällen, Rückrufwunsch aufnehmen, sonst
 * nichts – keine Fahrt anlegen, ändern, stornieren, keine Auskunft.
 */
describe("Notbetrieb: KI aus und keine gültige Weiterleitungsnummer (B1 zu M-47)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("B1: der Notbetriebs-Assistent hat nur rueckruf_anlegen – kein Fahrt-Werkzeug, keine Weiterleitung", () => {
    const config = vapiProvider.buildAssistantConfig(EINSTELLUNGEN, { nurRueckruf: true }) as Konfig;
    expect(werkzeugNamen(config)).toEqual(["rueckruf_anlegen"]);
    expect(config.assistant.firstMessage).toBe(EINSTELLUNGEN.greeting);
  });

  it("B1: der Notbetriebs-Prompt nennt 112, verbietet Fahrtannahme und erwähnt nur Werkzeuge, die es gibt", () => {
    const config = vapiProvider.buildAssistantConfig(EINSTELLUNGEN, { nurRueckruf: true }) as Konfig;
    const prompt = config.assistant.model.messages[0].content;
    expect(prompt).toContain("112");
    expect(prompt).toMatch(/keine Fahrt/);
    expect(prompt).toMatch(/nicht erreichbar/);
    expect(prompt).toContain("rueckruf_anlegen");
    expect(prompt).not.toContain("fahrt_anlegen");
    expect(prompt).not.toContain("transferCall");
    expect(genannteWerkzeuge(prompt).filter((name) => !werkzeugNamen(config).includes(name))).toEqual([]);
    // Zeitbezug wie im Vollbetrieb (M-46), damit "morgen" im Rückrufwunsch stimmt.
    expect(prompt).toMatch(/Heute ist .*Europe\/Berlin/);
  });

  it("B1: ohne die Option bleibt der Vollbetrieb unverändert (fahrt_anlegen vorhanden)", () => {
    const config = vapiProvider.buildAssistantConfig(EINSTELLUNGEN) as Konfig;
    expect(werkzeugNamen(config)).toContain("fahrt_anlegen");
  });

  describe("gegen Postgres (echter Webhook)", () => {
    const kennung = randomUUID().slice(0, 8);
    const ziffern = kennung.replace(/\D/g, "").padEnd(6, "3").slice(0, 6);
    const NUMMER_AUS = `+4924097${ziffern}`;
    const NUMMER_ZEITPLAN = `+4924096${ziffern}`;
    let tenantAus: string;
    let tenantZeitplan: string;
    let zaehler = 0;
    const ALT = process.env.VAPI_WEBHOOK_SECRET;

    function webhook(body: unknown) {
      return POST(
        new NextRequest("http://localhost:3000/api/voice/webhook", {
          method: "POST",
          headers: { authorization: "Bearer pruef-geheim", "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    }

    function assistantRequest(nummer: string, callId: string) {
      return webhook({
        message: { type: "assistant-request", phoneNumber: { number: nummer }, customer: { number: "+491700000000" }, call: { id: callId } },
      });
    }

    function toolCall(nummer: string, callId: string, name: string, args: Record<string, unknown>) {
      zaehler += 1;
      return webhook({
        message: {
          type: "tool-calls",
          phoneNumber: { number: nummer },
          customer: { number: "+491700000000" },
          call: { id: callId },
          toolCallList: [{ id: `PRUEF_nb_tc_${kennung}_${zaehler}`, function: { name, arguments: args } }],
        },
      });
    }

    async function mandant(name: string, nummer: string, aiActive: boolean, aiSchedule?: { modus: "NACHTS_WOCHENENDE" }) {
      const id = (
        await prisma.tenant.create({
          data: {
            name: `PRUEF_Notbetrieb ${name} ${kennung}`,
            settings: {
              create: { greeting: "Hallo, hier spricht eine KI.", voiceId: "x", escalationNumber: "", aiActive, aiSchedule, openingHours: {}, serviceAreaCenter: { lat: 50.77, lng: 6.08 } },
            },
          },
        })
      ).id;
      await prisma.phoneNumber.create({ data: { tenantId: id, e164: nummer, provider: "VAPI" } });
      return id;
    }

    beforeAll(async () => {
      tenantAus = await mandant("aus", NUMMER_AUS, false);
      tenantZeitplan = await mandant("zeitplan", NUMMER_ZEITPLAN, true, { modus: "NACHTS_WOCHENENDE" });
    });

    beforeEach(() => {
      process.env.VAPI_WEBHOOK_SECRET = "pruef-geheim";
    });

    afterAll(async () => {
      process.env.VAPI_WEBHOOK_SECRET = ALT;
      await mandantKomplettLoeschen(tenantAus);
      await mandantKomplettLoeschen(tenantZeitplan);
    });

    it("B1: KI aus, Weiterleitungsnummer leer → Anruf wird im Notbetrieb angenommen (kein error, kein destination), Log nur mit IDs", async () => {
      const fehlerLog = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const antwort = await assistantRequest(NUMMER_AUS, `PRUEF_nb_${kennung}_aus`);
        expect(antwort.status).toBe(200);
        const body = (await antwort.json()) as Konfig & { error?: string; destination?: unknown };
        expect(body.error).toBeUndefined();
        expect(body.destination).toBeUndefined();
        expect(werkzeugNamen(body)).toEqual(["rueckruf_anlegen"]);
        expect(body.assistant.model.messages[0].content).toContain("112");
        // Der Betrieb soll die Lücke bemerken – aber ohne Rufnummern im Log.
        expect(fehlerLog).toHaveBeenCalled();
        for (const aufruf of fehlerLog.mock.calls) {
          const text = JSON.stringify(aufruf);
          expect(text).not.toContain("+491700000000");
          expect(text).toContain(tenantAus);
        }
      } finally {
        fehlerLog.mockRestore();
      }
    });

    it("B1: KI an, aber laut Zeitplan (nachts/Wochenende) gerade nicht erreichbar, keine Nummer → ebenfalls Notbetrieb", async () => {
      // Mittwoch, 04.11.2026, 14:00 Uhr Berlin (13:00 UTC): weder Nacht noch Wochenende.
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-04T13:00:00.000Z"));
      const fehlerLog = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const antwort = await assistantRequest(NUMMER_ZEITPLAN, `PRUEF_nb_${kennung}_zp`);
        const body = (await antwort.json()) as Konfig & { error?: string };
        expect(body.error).toBeUndefined();
        expect(werkzeugNamen(body)).toEqual(["rueckruf_anlegen"]);
      } finally {
        fehlerLog.mockRestore();
      }
    });

    it("B1: KI aus mit gültiger Nummer → weiterhin direkte Weiterleitung, kein Notbetrieb", async () => {
      await prisma.tenantSettings.update({ where: { tenantId: tenantAus }, data: { escalationNumber: "+4924112345" } });
      try {
        const antwort = await assistantRequest(NUMMER_AUS, `PRUEF_nb_${kennung}_nr`);
        const body = (await antwort.json()) as { destination?: { type: string; number: string }; assistant?: unknown };
        expect(body.destination).toEqual(expect.objectContaining({ type: "number", number: "+4924112345" }));
        expect(body.assistant).toBeUndefined();
      } finally {
        await prisma.tenantSettings.update({ where: { tenantId: tenantAus }, data: { escalationNumber: "" } });
      }
    });

    it("B1: im Notbetrieb wird fahrt_anlegen auch serverseitig abgewiesen – nichts gespeichert; rueckruf_anlegen funktioniert", async () => {
      const callId = `PRUEF_nb_${kennung}_tools`;
      const fehlerLog = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await assistantRequest(NUMMER_AUS, callId);
      } finally {
        fehlerLog.mockRestore();
      }
      const morgen = new Date(Date.now() + 24 * 60 * 60_000).toISOString().slice(0, 10);
      const abgelehnt = await toolCall(NUMMER_AUS, callId, "fahrt_anlegen", {
        fahrgastVorname: "PRUEF", fahrgastNachname: "Notbetrieb", fahrgastTelefon: "+491700000000",
        pickupPlaceId: "x", dropoffPlaceId: "y", datum: morgen, abholzeit: "09:00",
        transportType: "SITZEND", prescription: "UNKLAR", approval: "UNKLAR",
      });
      const ergebnis = (await abgelehnt.json()) as { results: { error?: string; result?: string }[] };
      expect(ergebnis.results[0].result).toBeUndefined();
      expect(ergebnis.results[0].error).toMatch(/rueckruf_anlegen/);
      expect(await prisma.ride.count({ where: { tenantId: tenantAus } })).toBe(0);
      expect(await prisma.passenger.count({ where: { tenantId: tenantAus } })).toBe(0);

      const rueckruf = await toolCall(NUMMER_AUS, callId, "rueckruf_anlegen", { telefon: "+491700000000", anliegen: "Fahrt morgen früh" });
      const rueckrufErgebnis = (await rueckruf.json()) as { results: { error?: string; result?: string }[] };
      expect(rueckrufErgebnis.results[0].error).toBeUndefined();
      expect(rueckrufErgebnis.results[0].result).toMatch(/Rückruf/);
      const anruf = await prisma.call.findFirstOrThrow({ where: { tenantId: tenantAus, providerCallId: callId } });
      expect(anruf.summary).toBeTruthy();
    });
  });
});
