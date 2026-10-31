/**
 * Findet den Mandanten anhand der angerufenen Nummer (docs/04-voice-agent.md,
 * POST /api/voice/webhook). PhoneNumber, Tenant und TenantSettings direkt über prisma
 * statt withTenant(): das ist genau die Abfrage, über die wir den Mandanten erst herausfinden,
 * withTenant() setzt eine schon bekannte tenantId voraus (wie beim Cron-Job, src/app/api/cron/).
 */
import { prisma } from "@/lib/prisma";
import type { TenantVoiceSettings } from "@/providers/voice/types";
import { weiterleitungsnummerE164 } from "@/core/einrichtung/rufnummer";
import { aiJetztErreichbar } from "./zeitplan";

export type MandantFuerAnruf = {
  tenantId: string;
  aiAktiv: boolean;
  /** aiActive UND (falls gesetzt) innerhalb des Zeitplans aus Einrichtungsschritt 8. */
  aiErreichbarJetzt: boolean;
  settings: TenantVoiceSettings;
};

export async function mandantFuerNummerLaden(
  angerufeneNummer: string,
  anrufernummer: string | null,
): Promise<MandantFuerAnruf | null> {
  const nummer = await prisma.phoneNumber.findUnique({
    where: { e164: angerufeneNummer },
    select: { tenantId: true },
  });
  if (!nummer) return null;

  const [tenant, settings] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: nummer.tenantId } }),
    prisma.tenantSettings.findUnique({ where: { tenantId: nummer.tenantId } }),
  ]);
  if (!tenant || !settings) return null;

  return {
    tenantId: nummer.tenantId,
    aiAktiv: settings.aiActive,
    aiErreichbarJetzt: aiJetztErreichbar(settings.aiActive, settings.aiSchedule, new Date()),
    settings: {
      tenantId: nummer.tenantId,
      firmenname: tenant.name,
      ort: tenant.city ?? "",
      greeting: settings.greeting,
      voiceId: settings.voiceId,
      // Maßnahme M-47 (S2-019): Bestandsdaten wie "0241 12345" als E.164, Unbrauchbares als "" –
      // damit geht nie eine leere oder national geschriebene Nummer als Weiterleitungsziel hinaus.
      escalationNumber: weiterleitungsnummerE164(settings.escalationNumber) ?? "",
      anrufernummer: anrufernummer ?? undefined,
      bestaetigungsweg: " in Kürze",
    },
  };
}
