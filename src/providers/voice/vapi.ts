// Vapi-Umsetzung der VoiceProvider-Schnittstelle (docs/04a-vapi-notizen.md, Stand 27.10.2026).
// Alle Nachrichten kommen als POST mit { message: { type, ... } } (docs.vapi.ai/server-url/events).
//
// ACHTUNG: Die genaue Form von buildAssistantConfig() (Modell/Stimme/Transcriber) und ein paar
// Feldnamen im Gesprächsbericht sind aus der Doku übernommen, aber noch nicht gegen einen echten
// Vapi-Anruf getestet (siehe docs/04a-vapi-notizen.md, Punkt 9 und 10/offene Punkte). Vor dem
// ersten Testanruf mit einem echten Webhook-Payload abgleichen.
import { geheimnisGleich } from "@/lib/geheimnis";
import { voiceSystemPrompt } from "@/core/notify/voicePrompt";
import { DOC_STATUS, TRANSPORT_TYPES } from "@/core/rides/validation";
import { WOCHENTAGE } from "@/core/shifts/rrule";
import type { CallReport, TenantVoiceSettings, ToolCall, ToolResult, VoiceProvider } from "./types";

type VapiNachricht = {
  type: string;
  call?: { id: string };
  phoneNumber?: { number?: string };
  customer?: { number?: string };
  toolCallList?: { id: string; function: { name: string; arguments: Record<string, unknown> } }[];
  artifact?: { recording?: { url?: string }; transcript?: string };
  endedReason?: string;
  startedAt?: string;
  endedAt?: string;
};

function nachricht(body: unknown): VapiNachricht | null {
  if (typeof body !== "object" || body === null || !("message" in body)) return null;
  const message = (body as { message?: unknown }).message;
  if (typeof message !== "object" || message === null || !("type" in message)) return null;
  return message as VapiNachricht;
}

const DOC_STATUS_FELD = { type: "string", enum: DOC_STATUS, description: "JA, NEIN, UNKLAR oder NICHT_NOETIG" };
const TRANSPORT_TYPE_FELD = { type: "string", enum: TRANSPORT_TYPES };
const FAHRGAST_FELDER = {
  passengerId: { type: "string", description: "Falls per fahrgast_suchen gefunden - sonst weglassen." },
  fahrgastVorname: { type: "string" },
  fahrgastNachname: { type: "string" },
  fahrgastGeburtsdatum: { type: "string", description: "JJJJ-MM-TT" },
  fahrgastTelefon: { type: "string" },
  fahrgastKrankenkasse: { type: "string" },
};

// Deckt sich 1:1 mit den Fällen in werkzeugAusfuehren() (src/core/voice/werkzeuge.ts) - Name,
// Beschreibung und Parameter müssen zu den dortigen Zod-Schemas passen, sonst kann das
// Sprachmodell die Werkzeuge entweder gar nicht erst aufrufen oder schickt ungültige Argumente.
const WERKZEUGE = [
  {
    type: "function",
    function: {
      name: "fahrgast_suchen",
      description:
        "Bekannten Fahrgast finden und seine Identität für dieses Gespräch bestätigen. Die echte Anrufernummer prüft das System selbst; " +
        "ruft jemand von einer anderen Nummer an, sind Nachname UND Geburtsdatum nötig.",
      parameters: {
        type: "object",
        properties: {
          telefon: { type: "string", description: "Nur als Zusatzangabe; allein findet sie niemanden." },
          nachname: { type: "string" },
          geburtsdatum: { type: "string", description: "JJJJ-MM-TT" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ort_suchen",
      description: "Eine Adresse oder einen bekannten Ortsnamen (z. B. Klinik, Pflegeheim) in eine placeId auflösen.",
      parameters: {
        type: "object",
        properties: { text: { type: "string", description: "Adresse oder Ortsname, wie vom Anrufer genannt." } },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fahrt_anlegen",
      description: "Eine einzelne Fahrt anlegen, nachdem alle nötigen Angaben erfasst und vom Anrufer bestätigt wurden.",
      parameters: {
        type: "object",
        properties: {
          ...FAHRGAST_FELDER,
          pickupPlaceId: { type: "string" },
          dropoffPlaceId: { type: "string" },
          datum: { type: "string", description: "JJJJ-MM-TT, z. B. 2026-11-03 (aus dem heutigen Datum in den Anweisungen ausrechnen)" },
          abholzeit: { type: "string", description: "HH:MM im 24-Stunden-Format, z. B. 07:30" },
          terminzeit: { type: "string", description: "HH:MM im 24-Stunden-Format, optional" },
          rueckfahrt: { type: "boolean" },
          rueckfahrtzeit: {
            type: "string",
            description: "HH:MM, falls Rückfahrt. Weglassen, wenn der Anrufer die Zeit noch nicht weiß – die Rückfahrt wird dann mit offener Zeit vermerkt und das Team stimmt sie ab.",
          },
          transportType: TRANSPORT_TYPE_FELD,
          companion: { type: "boolean", description: "Begleitperson dabei?" },
          assistanceNotes: { type: "string" },
          prescription: DOC_STATUS_FELD,
          approval: DOC_STATUS_FELD,
        },
        required: ["pickupPlaceId", "dropoffPlaceId", "datum", "abholzeit", "transportType", "prescription", "approval"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "serie_anlegen",
      description: "Eine regelmäßige Serienfahrt (z. B. Dialyse dreimal pro Woche) anlegen.",
      parameters: {
        type: "object",
        properties: {
          ...FAHRGAST_FELDER,
          pickupPlaceId: { type: "string" },
          dropoffPlaceId: { type: "string" },
          wochentage: { type: "array", items: { type: "string", enum: WOCHENTAGE } },
          abholzeit: { type: "string", description: "HH:MM" },
          terminzeit: { type: "string", description: "HH:MM, optional" },
          rueckfahrt: { type: "boolean" },
          rueckfahrtzeit: { type: "string", description: "HH:MM, falls Rückfahrt" },
          bis: { type: "string", description: "JJJJ-MM-TT, Enddatum der Serie" },
          transportType: TRANSPORT_TYPE_FELD,
          companion: { type: "boolean" },
          assistanceNotes: { type: "string" },
          prescription: DOC_STATUS_FELD,
          approval: DOC_STATUS_FELD,
        },
        required: ["pickupPlaceId", "dropoffPlaceId", "wochentage", "abholzeit", "bis", "transportType", "prescription", "approval"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fahrt_finden",
      description: "Kommende Fahrten eines in diesem Gespräch bestätigten Fahrgasts nachschlagen, z. B. für Änderungen oder Stornierungen.",
      parameters: {
        type: "object",
        properties: { passengerId: { type: "string" }, datum: { type: "string", description: "JJJJ-MM-TT, optional" } },
        required: ["passengerId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fahrt_aendern",
      description: "Details einer bereits erfassten Fahrt ändern (Zeit, Adresse, Transportart, Begleitung).",
      parameters: {
        type: "object",
        properties: {
          rideId: { type: "string" },
          abholzeit: { type: "string", description: "HH:MM" },
          terminzeit: { type: "string", description: "HH:MM" },
          pickupPlaceId: { type: "string" },
          dropoffPlaceId: { type: "string" },
          transportType: TRANSPORT_TYPE_FELD,
          companion: { type: "boolean" },
          assistanceNotes: { type: "string" },
        },
        required: ["rideId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fahrt_stornieren",
      description: "Eine Fahrt stornieren.",
      parameters: {
        type: "object",
        properties: { rideId: { type: "string" }, grund: { type: "string" } },
        required: ["rideId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "serie_beenden",
      description:
        "Eine regelmäßige Fahrt (Serie, z. B. Dialyse) eines in diesem Gespräch bestätigten Fahrgasts beenden. " +
        "Alle geplanten Fahrten ab dem Datum werden storniert.",
      parameters: {
        type: "object",
        properties: {
          passengerId: { type: "string" },
          seriesId: { type: "string", description: "Nur nötig, wenn mehrere Serien laufen." },
          ab: { type: "string", description: "JJJJ-MM-TT, erster Tag ohne Fahrt; ohne Angabe ab heute." },
        },
        required: ["passengerId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "abholzeit_auskunft",
      description: "Auskunft zum aktuellen Status/der Abholzeit einer Fahrt geben, z. B. ob der Fahrer schon unterwegs ist.",
      parameters: {
        type: "object",
        properties: { rideId: { type: "string" } },
        required: ["rideId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rueckruf_anlegen",
      description: "Wenn das Anliegen nicht direkt gelöst werden kann: Rückrufwunsch für das Team hinterlegen.",
      parameters: {
        type: "object",
        properties: { telefon: { type: "string" }, anliegen: { type: "string" } },
        required: ["telefon", "anliegen"],
      },
    },
  },
] as const;

export const vapiProvider: VoiceProvider = {
  name: "vapi",

  async verifyWebhook(req) {
    // Maßnahme M-14 Punkt 3 (S4-007): zeitkonstanter Vergleich. Eine HMAC-Signatur mit Zeitstempel
    // (Schutz gegen Wiederholung) folgt, sobald der Anbieter sie anbietet.
    const header = req.headers.get("authorization") ?? req.headers.get("x-vapi-secret");
    const token = header?.replace(/^Bearer\s+/i, "").trim();
    return geheimnisGleich(token, process.env.VAPI_WEBHOOK_SECRET);
  },

  buildAssistantConfig(settings: TenantVoiceSettings) {
    // Dieselbe URL für alles Weitere in diesem Anruf (Werkzeugaufrufe, Gesprächsbericht) - Vapi
    // schickt "assistant-request" an die auf Organisationsebene hinterlegte Server-URL (da zu
    // diesem Zeitpunkt noch kein Assistent existiert), aber alle Nachrichten danach an die
    // server.url, die wir hier mitgeben (docs/04a-vapi-notizen.md Punkt 2 und 6).
    const serverUrl = process.env.APP_URL ? `${process.env.APP_URL}/api/voice/webhook` : undefined;
    // "an_mensch_weiterleiten": fest hinterlegtes Ziel, kein eigener Werkzeugaufruf bei uns nötig
    // (docs/04a-vapi-notizen.md Punkt 4). Ohne escalationNumber (z. B. Live-Demo auf der
    // Marketing-Seite, die an niemanden weiterleiten soll) gibt es das Werkzeug gar nicht erst –
    // voiceSystemPrompt() weist die KI dann an, stattdessen freundlich abzusagen.
    const tools: unknown[] = [...WERKZEUGE];
    if (settings.escalationNumber) {
      tools.push({
        type: "transferCall",
        destinations: [{ type: "number", number: settings.escalationNumber, message: "Einen Moment, ich verbinde." }],
      });
    }
    return {
      assistant: {
        firstMessage: settings.greeting,
        model: {
          provider: "openai",
          model: "gpt-4o",
          // Maßnahme M-46 (S1-007): Datum/Uhrzeit des Anrufs – die Konfiguration entsteht je Anruf neu.
          messages: [{ role: "system", content: voiceSystemPrompt(settings, { jetzt: new Date() }) }],
        },
        // "vapi" (Vapis eigener Sprachanbieter, "Vapi Voices"), nicht "11labs" - wir haben keinen
        // eigenen ElevenLabs-Account/Stimm-IDs, settings.voiceId sind echte Vapi-Stimmnamen (z. B.
        // "Clara"), siehe STIMMEN in src/app/einrichtung/[schritt]/konstanten.ts.
        voice: { provider: "vapi", voiceId: settings.voiceId },
        transcriber: { provider: "deepgram", language: "de" },
        tools,
        ...(serverUrl ? { server: { url: serverUrl } } : {}),
      },
    };
  },

  parseToolCall(body: unknown): ToolCall[] {
    const msg = nachricht(body);
    if (!msg || msg.type !== "tool-calls" || !msg.toolCallList) return [];
    return msg.toolCallList.map((t) => ({ id: t.id, name: t.function.name, arguments: t.function.arguments }));
  },

  formatToolResult(results: ToolResult[]) {
    return {
      results: results.map((r) =>
        r.error ? { toolCallId: r.id, error: r.error } : { toolCallId: r.id, result: r.result ?? "" },
      ),
    };
  },

  parseEndOfCall(body: unknown): CallReport | null {
    const msg = nachricht(body);
    if (!msg || msg.type !== "end-of-call-report") return null;
    const startedAt = msg.startedAt ? new Date(msg.startedAt) : new Date();
    const endedAt = msg.endedAt ? new Date(msg.endedAt) : undefined;
    return {
      providerCallId: msg.call?.id ?? "",
      fromNumber: msg.customer?.number,
      toNumber: msg.phoneNumber?.number ?? "",
      startedAt,
      durationSec: endedAt ? Math.round((endedAt.getTime() - startedAt.getTime()) / 1000) : undefined,
      transcript: msg.artifact?.transcript,
      recordingUrl: msg.artifact?.recording?.url,
      endedReason: msg.endedReason,
    };
  },

  istAssistantRequest(body: unknown): boolean {
    return nachricht(body)?.type === "assistant-request";
  },

  angerufeneNummer(body: unknown): string | null {
    return nachricht(body)?.phoneNumber?.number ?? null;
  },

  anrufernummer(body: unknown): string | null {
    return nachricht(body)?.customer?.number ?? null;
  },

  anrufId(body: unknown): string | null {
    return nachricht(body)?.call?.id ?? null;
  },
};
