import { NextResponse, type NextRequest } from "next/server";
import { voiceProvider } from "@/providers/voice";
import { mandantFuerNummerLaden } from "@/core/voice/mandant";
import { anrufSicherstellen } from "@/core/voice/anruf";
import { werkzeugAusfuehren } from "@/core/voice/werkzeuge";

/** Werkzeugaufrufe während des Gesprächs (docs/04-voice-agent.md). Antwort immer HTTP 200. */
export async function POST(request: NextRequest) {
  if (!(await voiceProvider.verifyWebhook(request))) {
    return NextResponse.json({ error: "Ungültige Signatur." }, { status: 401 });
  }

  const body = await request.json();
  const aufrufe = voiceProvider.parseToolCall(body);
  if (aufrufe.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const angerufeneNummer = voiceProvider.angerufeneNummer(body);
  const anrufId = voiceProvider.anrufId(body);
  if (!angerufeneNummer || !anrufId) {
    return NextResponse.json(
      voiceProvider.formatToolResult(aufrufe.map((a) => ({ id: a.id, error: "Anruf konnte nicht zugeordnet werden." }))),
    );
  }

  const mandant = await mandantFuerNummerLaden(angerufeneNummer, voiceProvider.anrufernummer(body));
  if (!mandant) {
    return NextResponse.json(
      voiceProvider.formatToolResult(aufrufe.map((a) => ({ id: a.id, error: "Kein Mandant gefunden." }))),
    );
  }

  const anruf = await anrufSicherstellen(mandant.tenantId, anrufId, {
    fromNumber: voiceProvider.anrufernummer(body),
    toNumber: angerufeneNummer,
  });

  const ergebnisse = await Promise.all(
    aufrufe.map((aufruf) => werkzeugAusfuehren(mandant.tenantId, anruf.id, aufruf)),
  );

  return NextResponse.json(voiceProvider.formatToolResult(ergebnisse));
}
