"use server";

import { withTenant } from "@/lib/db";
import { requireBueroSession } from "@/lib/session";
import { decrypt } from "@/lib/crypto";
import { telefonMaskiert } from "@/core/notify/telefonMaskierung";

export async function anrufeLaden() {
  const { tenantId } = await requireBueroSession();
  const anrufe = await withTenant(tenantId).call.findMany({
    orderBy: { startedAt: "desc" },
    take: 100,
    include: {
      rides: {
        select: { id: true, pickupAt: true, passenger: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  return anrufe.map((a) => ({
    id: a.id,
    startedAt: a.startedAt,
    durationSec: a.durationSec,
    fromNumber: a.fromNumber ? telefonMaskiert(a.fromNumber) : null,
    summary: a.summary,
    outcome: a.outcome,
    audioUrl: a.audioUrl,
    hatTranskript: Boolean(a.transcript),
    fahrten: a.rides.map((r) => ({
      id: r.id,
      pickupAt: r.pickupAt,
      name: `${r.passenger.firstName} ${r.passenger.lastName}`,
    })),
  }));
}

export async function anrufTranskriptLaden(callId: string): Promise<string | null> {
  const { tenantId, userId } = await requireBueroSession();
  const db = withTenant(tenantId);
  const anruf = await db.call.findUnique({ where: { id: callId }, select: { transcript: true } });
  if (!anruf?.transcript) return null;
  await db.auditLog.create({
    data: { tenantId, userId, action: "call.transkript_angesehen", entity: "Call", entityId: callId },
  });
  return decrypt(anruf.transcript);
}
