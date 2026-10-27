// Ein Call-Datensatz entsteht beim ersten Kontakt (assistant-request oder erster Werkzeugaufruf)
// und wird beim Gesprächsende vervollständigt – so kann fahrt_anlegen während des Gesprächs schon
// auf die (unsere) Call-ID verweisen (Ride.callId), bevor der Gesprächsbericht da ist.
import type { CallOutcome } from "@/generated/prisma/enums";
import { withTenant } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import type { CallReport } from "@/providers/voice/types";

export async function anrufSicherstellen(
  tenantId: string,
  providerCallId: string,
  angaben: { fromNumber?: string | null; toNumber: string },
): Promise<{ id: string }> {
  const db = withTenant(tenantId);
  const bestehend = await db.call.findFirst({ where: { providerCallId }, select: { id: true } });
  if (bestehend) return bestehend;
  return db.call.create({
    data: {
      tenantId,
      providerCallId,
      fromNumber: angaben.fromNumber ?? undefined,
      toNumber: angaben.toNumber,
      startedAt: new Date(),
    },
    select: { id: true },
  });
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
  await db.call.update({
    where: { id: call.id },
    data: {
      startedAt: bericht.startedAt,
      durationSec: bericht.durationSec,
      transcript: bericht.transcript ? encrypt(bericht.transcript) : undefined,
      summary: zusammenfassung ?? undefined,
      audioUrl: bericht.recordingUrl,
      outcome,
    },
  });
  return call.id;
}
