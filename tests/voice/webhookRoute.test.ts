import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/voice/webhook/route";

/** Prüfbericht S2-014 / S3-016: kaputtes JSON → 500, 6-MB-Body → 200 ohne Limit. */
describe("POST /api/voice/webhook – Eingabegrenzen (S2-014)", () => {
  const ALT = process.env.VAPI_WEBHOOK_SECRET;
  beforeEach(() => {
    process.env.VAPI_WEBHOOK_SECRET = "pruef-geheim";
  });
  afterEach(() => {
    process.env.VAPI_WEBHOOK_SECRET = ALT;
  });

  function anfrage(body: string, headers: Record<string, string> = {}) {
    return new NextRequest("http://localhost:3000/api/voice/webhook", {
      method: "POST",
      headers: { authorization: "Bearer pruef-geheim", "content-type": "application/json", ...headers },
      body,
    });
  }

  it("ohne gültiges Geheimnis weiterhin 401", async () => {
    const antwort = await POST(anfrage("{}", { authorization: "Bearer falsch" }));
    expect(antwort.status).toBe(401);
  });

  it("S2-014: ungültiges JSON → 400 statt 500", async () => {
    const antwort = await POST(anfrage("{nicht json"));
    expect(antwort.status).toBe(400);
  });

  it("S2-014: zu großer Body → 413", async () => {
    const gross = JSON.stringify({ message: { type: "status-update", fuellung: "x".repeat(1_100_000) } });
    const antwort = await POST(anfrage(gross));
    expect(antwort.status).toBe(413);
  });

  it("unbekannte Nachrichtentypen werden weiterhin mit 200 bestätigt", async () => {
    const antwort = await POST(anfrage(JSON.stringify({ message: { type: "status-update" } })));
    expect(antwort.status).toBe(200);
  });
});
