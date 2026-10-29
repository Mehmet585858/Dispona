import { NextResponse, type NextRequest } from "next/server";
import { voiceProvider } from "@/providers/voice";
import { withTenant } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { mandantFuerNummerLaden } from "@/core/voice/mandant";
import { anrufSicherstellen, anrufAbschliessen } from "@/core/voice/anruf";
import { werkzeugAusfuehren } from "@/core/voice/werkzeuge";
import { anrufZusammenfassen } from "@/core/notify/anrufZusammenfassung";
import { outcomeKlassifizieren } from "@/core/voice/outcome";

/**
 * Einziger Vapi-Webhook für alles (docs/04a-vapi-notizen.md Punkt 2 und 6): Vapi schickt
 * "assistant-request", "tool-calls", "end-of-call-report" und weitere Nachrichtentypen alle an
 * dieselbe, auf Organisationsebene hinterlegte Server-URL - es gibt keine separate URL je
 * Nachrichtentyp. Früher als drei getrennte Routen gebaut (assistant-request/tools/events), das
 * hätte in Vapi aber bedeutet, nur eine davon zu hinterlegen und die anderen beiden nie zu
 * erreichen. Jetzt an einer Stelle, nach Nachrichtentyp verzweigt.
 */
export async function POST(request: NextRequest) {
  if (!(await voiceProvider.verifyWebhook(request))) {
    return NextResponse.json({ error: "Ungültige Signatur." }, { status: 401 });
  }

  const body = await request.json();

  if (voiceProvider.istAssistantRequest(body)) {
    return assistantRequestBehandeln(body);
  }

  const aufrufe = voiceProvider.parseToolCall(body);
  if (aufrufe.length > 0) {
    return toolCallsBehandeln(body, aufrufe);
  }

  const bericht = voiceProvider.parseEndOfCall(body);
  if (bericht) {
    return endOfCallBehandeln(bericht);
  }

  // Alle übrigen Nachrichtentypen (status-update, transcript, hang, …) sind "Feuer und
  // vergessen" (docs/04a-vapi-notizen.md Punkt 2) - einfach bestätigen.
  return NextResponse.json({ ok: true });
}

async function assistantRequestBehandeln(body: unknown) {
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

async function toolCallsBehandeln(body: unknown, aufrufe: ReturnType<typeof voiceProvider.parseToolCall>) {
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

async function endOfCallBehandeln(bericht: NonNullable<ReturnType<typeof voiceProvider.parseEndOfCall>>) {
  // toNumber ist die angerufene Nummer des Mandanten – mandantenübergreifende Suche wie bei
  // core/voice/mandant.ts, da wir noch keine tenantId haben.
  const nummer = await prisma.phoneNumber.findUnique({ where: { e164: bericht.toNumber }, select: { tenantId: true } });
  if (!nummer) {
    return NextResponse.json({ ok: true });
  }

  const zusammenfassung = await anrufZusammenfassen(bericht.transcript);
  const callId = await anrufAbschliessen(nummer.tenantId, bericht, zusammenfassung);

  const fahrten = await withTenant(nummer.tenantId).ride.findMany({ where: { callId }, select: { status: true } });
  const outcome = outcomeKlassifizieren({
    endedReason: bericht.endedReason,
    hatFahrt: fahrten.length > 0,
    fahrtStorniert: fahrten.length > 0 && fahrten.every((f) => f.status === "STORNIERT"),
  });
  await withTenant(nummer.tenantId).call.update({ where: { id: callId }, data: { outcome } });

  return NextResponse.json({ ok: true });
}
