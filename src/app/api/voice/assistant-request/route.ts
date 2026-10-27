import { NextResponse, type NextRequest } from "next/server";
import { voiceProvider } from "@/providers/voice";
import { mandantFuerNummerLaden } from "@/core/voice/mandant";
import { anrufSicherstellen } from "@/core/voice/anruf";

/**
 * Anruf kommt rein: Mandant anhand der angerufenen Nummer finden, Konfiguration zurückgeben
 * (docs/04-voice-agent.md). KI aus (TenantSettings.aiActive=false) → sofort weiterleiten.
 */
export async function POST(request: NextRequest) {
  if (!(await voiceProvider.verifyWebhook(request))) {
    return NextResponse.json({ error: "Ungültige Signatur." }, { status: 401 });
  }

  const body = await request.json();
  if (!voiceProvider.istAssistantRequest(body)) {
    return NextResponse.json({});
  }

  const angerufeneNummer = voiceProvider.angerufeneNummer(body);
  if (!angerufeneNummer) {
    return NextResponse.json({ error: "Angerufene Nummer fehlt im Anfrage-Körper." }, { status: 400 });
  }
  const anrufernummer = voiceProvider.anrufernummer(body);

  const mandant = await mandantFuerNummerLaden(angerufeneNummer, anrufernummer);
  if (!mandant) {
    return NextResponse.json({ error: "Kein Mandant für diese Nummer hinterlegt." }, { status: 404 });
  }

  const anrufId = voiceProvider.anrufId(body);
  if (anrufId) {
    await anrufSicherstellen(mandant.tenantId, anrufId, { fromNumber: anrufernummer, toNumber: angerufeneNummer });
  }

  if (!mandant.aiErreichbarJetzt) {
    return NextResponse.json({ destination: { type: "number", number: mandant.settings.escalationNumber } });
  }

  return NextResponse.json(voiceProvider.buildAssistantConfig(mandant.settings));
}
