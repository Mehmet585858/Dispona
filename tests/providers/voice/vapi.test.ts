import { afterEach, describe, expect, it } from "vitest";
import { vapiProvider } from "@/providers/voice/vapi";

describe("vapiProvider.parseToolCall", () => {
  it("liest Werkzeugaufrufe aus einer tool-calls-Nachricht", () => {
    const body = {
      message: {
        type: "tool-calls",
        toolCallList: [
          { id: "call_1", function: { name: "fahrgast_suchen", arguments: { telefon: "+491701234567" } } },
        ],
      },
    };
    expect(vapiProvider.parseToolCall(body)).toEqual([
      { id: "call_1", name: "fahrgast_suchen", arguments: { telefon: "+491701234567" } },
    ]);
  });

  it("gibt ein leeres Array für andere Nachrichtentypen zurück", () => {
    expect(vapiProvider.parseToolCall({ message: { type: "status-update" } })).toEqual([]);
    expect(vapiProvider.parseToolCall({})).toEqual([]);
    expect(vapiProvider.parseToolCall(null)).toEqual([]);
  });
});

describe("vapiProvider.formatToolResult", () => {
  it("formt Erfolg und Fehler ins Vapi-Format", () => {
    expect(
      vapiProvider.formatToolResult([
        { id: "call_1", result: "Fahrt angelegt." },
        { id: "call_2", error: "Fahrgast nicht gefunden." },
      ]),
    ).toEqual({
      results: [
        { toolCallId: "call_1", result: "Fahrt angelegt." },
        { toolCallId: "call_2", error: "Fahrgast nicht gefunden." },
      ],
    });
  });
});

describe("vapiProvider.parseEndOfCall", () => {
  it("liest den Gesprächsbericht", () => {
    const body = {
      message: {
        type: "end-of-call-report",
        call: { id: "call-123" },
        customer: { number: "+491701234567" },
        phoneNumber: { number: "+4924011112222" },
        startedAt: "2026-10-27T10:00:00.000Z",
        endedAt: "2026-10-27T10:03:00.000Z",
        endedReason: "customer-ended-call",
        artifact: { transcript: "Anrufer: Hallo…", recording: { url: "https://example.com/r.wav" } },
      },
    };
    const bericht = vapiProvider.parseEndOfCall(body);
    expect(bericht).not.toBeNull();
    expect(bericht?.providerCallId).toBe("call-123");
    expect(bericht?.fromNumber).toBe("+491701234567");
    expect(bericht?.toNumber).toBe("+4924011112222");
    expect(bericht?.durationSec).toBe(180);
    expect(bericht?.transcript).toContain("Anrufer");
    expect(bericht?.recordingUrl).toBe("https://example.com/r.wav");
  });

  it("gibt null für andere Nachrichtentypen zurück", () => {
    expect(vapiProvider.parseEndOfCall({ message: { type: "tool-calls" } })).toBeNull();
  });
});

describe("vapiProvider.istAssistantRequest / angerufeneNummer", () => {
  it("erkennt eine assistant-request-Nachricht und liest die angerufene Nummer", () => {
    const body = {
      message: {
        type: "assistant-request",
        phoneNumber: { number: "+4924011112222" },
        customer: { number: "+491701234567" },
        call: { id: "call-abc" },
      },
    };
    expect(vapiProvider.istAssistantRequest(body)).toBe(true);
    expect(vapiProvider.angerufeneNummer(body)).toBe("+4924011112222");
    expect(vapiProvider.anrufernummer(body)).toBe("+491701234567");
    expect(vapiProvider.anrufId(body)).toBe("call-abc");
  });

  it("liefert false/null für andere Nachrichten", () => {
    expect(vapiProvider.istAssistantRequest({ message: { type: "tool-calls" } })).toBe(false);
    expect(vapiProvider.angerufeneNummer({ message: { type: "tool-calls" } })).toBeNull();
    expect(vapiProvider.anrufernummer({ message: { type: "tool-calls" } })).toBeNull();
    expect(vapiProvider.anrufId({ message: { type: "tool-calls" } })).toBeNull();
  });
});

describe("vapiProvider.verifyWebhook", () => {
  const ALT = process.env.VAPI_WEBHOOK_SECRET;
  afterEach(() => {
    process.env.VAPI_WEBHOOK_SECRET = ALT;
  });

  it("akzeptiert das richtige Bearer-Token", async () => {
    process.env.VAPI_WEBHOOK_SECRET = "geheim123";
    const req = new Request("https://example.com/api/voice/tools", {
      headers: { authorization: "Bearer geheim123" },
    });
    expect(await vapiProvider.verifyWebhook(req)).toBe(true);
  });

  it("lehnt ein falsches oder fehlendes Token ab", async () => {
    process.env.VAPI_WEBHOOK_SECRET = "geheim123";
    const falsch = new Request("https://example.com/api/voice/tools", {
      headers: { authorization: "Bearer falsch" },
    });
    const ohne = new Request("https://example.com/api/voice/tools");
    expect(await vapiProvider.verifyWebhook(falsch)).toBe(false);
    expect(await vapiProvider.verifyWebhook(ohne)).toBe(false);
  });

  it("lehnt ab, wenn kein Geheimnis konfiguriert ist", async () => {
    delete process.env.VAPI_WEBHOOK_SECRET;
    const req = new Request("https://example.com/api/voice/tools", {
      headers: { authorization: "Bearer irgendwas" },
    });
    expect(await vapiProvider.verifyWebhook(req)).toBe(false);
  });
});
