"use server";

// Öffentliche Server Action für den Mediway-Live-Test (/live-mediway) - wie src/app/live/actions.ts
// für die Demo, aber auf den Testmandanten "Mediway Krankenfahrdienst (Live Test)" beschränkt.
// Bewusst per Name statt per externer tenantId aufgelöst: der Mandant wird serverseitig
// festgelegt, eine von außen übergebene tenantId wird hier nie entgegengenommen - gleiche
// Absicherung wie beim Demo-Mandanten. Nur für den Testanruf gedacht, danach wieder entfernen.
import { fahrplanFuerMandantLaden } from "@/app/dispo/fahrten/actions";
import { withTenant } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

const MEDIWAY_NAME = "Mediway Krankenfahrdienst (Live Test)";

async function mediwayTenantId(): Promise<string> {
  const tenant = await prisma.tenant.findFirst({ where: { name: MEDIWAY_NAME }, select: { id: true } });
  if (!tenant) throw new Error("Mediway-Testmandant nicht gefunden.");
  return tenant.id;
}

export async function liveMediwayLaden() {
  const tenantId = await mediwayTenantId();
  return fahrplanFuerMandantLaden(tenantId, undefined, "tag");
}

export async function liveMediwayTranskriptLaden(callId: string): Promise<string | null> {
  const tenantId = await mediwayTenantId();
  const db = withTenant(tenantId);
  const anruf = await db.call.findUnique({ where: { id: callId }, select: { transcript: true } });
  if (!anruf?.transcript) return null;
  return decrypt(anruf.transcript);
}
