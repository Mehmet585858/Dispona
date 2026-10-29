import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/** EINMALIGER Fix: Mediway-Testmandant wurde vor der voiceId-Korrektur (siehe vapi.ts) mit der
 * ungueltigen Platzhalter-ID "de-freundlich-1" angelegt. Gleicher Cron-Ansatz wie bei den
 * anderen Einmal-Skripten. Nach dem ersten Lauf wieder aus vercel.json entfernen. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const erlaubnis = request.headers.get("authorization");
  if (!secret || erlaubnis !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const tenant = await prisma.tenant.findFirst({ where: { name: "Mediway Krankenfahrdienst (Live Test)" } });
  if (!tenant) {
    return NextResponse.json({ error: "Mediway-Mandant nicht gefunden." }, { status: 404 });
  }

  await prisma.tenantSettings.update({ where: { tenantId: tenant.id }, data: { voiceId: "Clara" } });
  return NextResponse.json({ tenantId: tenant.id, voiceId: "Clara" });
}
