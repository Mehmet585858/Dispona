// Vapi-Umsetzung der VoiceProvider-Schnittstelle (docs/04a-vapi-notizen.md, Stand 27.10.2026).
// Alle Nachrichten kommen als POST mit { message: { type, ... } } (docs.vapi.ai/server-url/events).
//
// ACHTUNG: Die genaue Form von buildAssistantConfig() (Modell/Stimme/Transcriber) und ein paar
// Feldnamen im Gesprächsbericht sind aus der Doku übernommen, aber noch nicht gegen einen echten
// Vapi-Anruf getestet (siehe docs/04a-vapi-notizen.md, Punkt 9 und 10/offene Punkte). Vor dem
// ersten Testanruf mit einem echten Webhook-Payload abgleichen.
import { voiceSystemPrompt } from "@/core/notify/voicePrompt";
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

export const vapiProvider: VoiceProvider = {
  name: "vapi",

  async verifyWebhook(req) {
    const secret = process.env.VAPI_WEBHOOK_SECRET;
    if (!secret) return false;
    const header = req.headers.get("authorization") ?? req.headers.get("x-vapi-secret");
    const token = header?.replace(/^Bearer\s+/i, "").trim();
    return token === secret;
  },

  buildAssistantConfig(settings: TenantVoiceSettings) {
    return {
      assistant: {
        firstMessage: settings.greeting,
        model: {
          provider: "openai",
          model: "gpt-4o",
          messages: [{ role: "system", content: voiceSystemPrompt(settings) }],
        },
        voice: { provider: "11labs", voiceId: settings.voiceId },
        transcriber: { provider: "deepgram", language: "de" },
        // "an_mensch_weiterleiten": fest hinterlegtes Ziel, kein eigener Werkzeugaufruf bei uns nötig
        // (docs/04a-vapi-notizen.md Punkt 4).
        tools: [
          {
            type: "transferCall",
            destinations: [{ type: "number", number: settings.escalationNumber, message: "Einen Moment, ich verbinde." }],
          },
        ],
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
