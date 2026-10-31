// Ein Call-Datensatz entsteht beim ersten Kontakt (assistant-request oder erster Werkzeugaufruf)
// und wird beim Gesprächsende vervollständigt – so kann fahrt_anlegen während des Gesprächs schon
// auf die (unsere) Call-ID verweisen (Ride.callId), bevor der Gesprächsbericht da ist.
import type { CallOutcome } from "@/generated/prisma/enums";
import { istEindeutigkeitsFehler, withTenant } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { zusammenfassungLesbar, zusammenfassungMitRueckrufen } from "@/core/notify/anrufZusammenfassung";
import type { CallReport } from "@/providers/voice/types";

export async function anrufSicherstellen(
  tenantId: string,
  providerCallId: string,
  angaben: { fromNumber?: string | null; toNumber: string },
): Promise<{ id: string }> {
  const db = withTenant(tenantId);
  const bestehend = await db.call.findFirst({ where: { providerCallId }, select: { id: true } });
  if (bestehend) return bestehend;
  try {
    return await db.call.create({
      data: {
        tenantId,
        providerCallId,
        fromNumber: angaben.fromNumber ?? undefined,
        toNumber: angaben.toNumber,
        startedAt: new Date(),
      },
      select: { id: true },
    });
  } catch (fehler) {
    // Prüfbericht S2-014: zwei gleichzeitige Erstkontakte (assistant-request und erster
    // Werkzeugaufruf, oder ein Vapi-Retry) – Call.providerCallId ist eindeutig, der Verlierer
    // nimmt die Zeile des Gewinners statt mit einem Fehler den ganzen Webhook scheitern zu lassen.
    if (istEindeutigkeitsFehler(fehler)) {
      const gewinner = await db.call.findFirst({ where: { providerCallId }, select: { id: true } });
      if (gewinner) return gewinner;
    }
    throw fehler;
  }
}

export async function anrufAbschliessen(
  tenantId: string,
  bericht: CallReport,
  zusammenfassung: string | null,
  outcome?: CallOutcome,
): Promise<string> {
  const db = withTenant(tenantId);
  const call = await anrufSicherstellen(tenantId, bericht.providerCallId, {
    fromNumber: bericht.fromNumber,
    toNumber: bericht.toNumber,
  });
  // Maßnahme M-13 Punkt 4: Rückrufwünsche aus dem Gespräch (rueckruf_anlegen) bleiben neben der
  // KI-Zusammenfassung stehen, statt von ihr überschrieben zu werden.
  const bisher = await db.call.findUnique({ where: { id: call.id }, select: { summary: true } });
  const gesamt = zusammenfassungMitRueckrufen(zusammenfassung, zusammenfassungLesbar(bisher?.summary));
  await db.call.update({
    where: { id: call.id },
    data: {
      startedAt: bericht.startedAt,
      durationSec: bericht.durationSec,
      transcript: bericht.transcript ? encrypt(bericht.transcript) : undefined,
      // Maßnahme M-10 (S3-012): Zusammenfassung verschlüsselt wie das Transkript.
      summary: gesamt ? encrypt(gesamt) : undefined,
      audioUrl: bericht.recordingUrl,
      outcome,
    },
  });
  return call.id;
}
