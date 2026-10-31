import { NextResponse, type NextRequest } from "next/server";
import { bearerErlaubt } from "@/lib/geheimnis";
import { prisma } from "@/lib/prisma";
import { bestaetigungenPruefen, keinFahrzeugAlarmPruefen } from "@/core/notify/eskalation";

/**
 * Für einen externen Scheduler (z. B. alle 1-2 Minuten), gesichert mit CRON_SECRET.
 * Mandantenübergreifend wie Job (siehe src/lib/db.ts) – deshalb hier direkt prisma statt withTenant.
 */
export async function GET(request: NextRequest) {
  if (!bearerErlaubt(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const mandanten = await prisma.tenant.findMany({ select: { id: true } });
  const bestaetigungen = await Promise.all(mandanten.map((m) => bestaetigungenPruefen(m.id)));
  const keinFahrzeug = await Promise.all(mandanten.map((m) => keinFahrzeugAlarmPruefen(m.id)));

  return NextResponse.json({ mandanten: mandanten.length, bestaetigungen, keinFahrzeug });
}
