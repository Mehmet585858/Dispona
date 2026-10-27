import { NextResponse, type NextRequest } from "next/server";
import { voiceProvider } from "@/providers/voice";
import { withTenant } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { anrufAbschliessen } from "@/core/voice/anruf";
import { anrufZusammenfassen } from "@/core/notify/anrufZusammenfassung";

/**
 * Statusmeldungen und Gesprächsbericht (docs/04-voice-agent.md). Nur end-of-call-report wird
 * ausgewertet, alle anderen Nachrichten einfach bestätigen (Vapi erwartet keine Antwortdaten).
 */
export async function POST(request: NextRequest) {
  if (!(await voiceProvider.verifyWebhook(request))) {
    return NextResponse.json({ error: "Ungültige Signatur." }, { status: 401 });
  }

  const body = await request.json();
  const bericht = voiceProvider.parseEndOfCall(body);
  if (!bericht) {
    return NextResponse.json({ ok: true });
  }

  // toNumber ist die angerufene Nummer des Mandanten – mandantenübergreifende Suche wie bei
  // core/voice/mandant.ts, da wir noch keine tenantId haben.
  const nummer = await prisma.phoneNumber.findUnique({ where: { e164: bericht.toNumber }, select: { tenantId: true } });
  if (!nummer) {
    return NextResponse.json({ ok: true });
  }

  const zusammenfassung = await anrufZusammenfassen(bericht.transcript);
  const callId = await anrufAbschliessen(nummer.tenantId, bericht, zusammenfassung);

  const hatFahrt = await withTenant(nummer.tenantId).ride.findFirst({ where: { callId }, select: { id: true } });
  if (hatFahrt) {
    await withTenant(nummer.tenantId).call.update({ where: { id: callId }, data: { outcome: "FAHRT_ERFASST" } });
  }

  return NextResponse.json({ ok: true });
}
