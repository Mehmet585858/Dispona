import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { serienVerlaengern } from "@/core/rides/serie";

/**
 * Für einen externen Scheduler (z. B. einmal täglich), gesichert mit CRON_SECRET. Verlängert
 * jede laufende Serie auf den 14-Tage-Horizont (docs/09-bauplan.md Phase 8); ist von sich aus
 * harmlos bei mehrfachem Aufruf am selben Tag, da bereits erzeugte Termine übersprungen werden.
 * Mandantenübergreifend wie Job (siehe src/lib/db.ts) – deshalb hier direkt prisma statt withTenant.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const erlaubnis = request.headers.get("authorization");
  if (!secret || erlaubnis !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const mandanten = await prisma.tenant.findMany({ select: { id: true } });
  const ergebnisse = await Promise.all(mandanten.map((m) => serienVerlaengern(m.id)));

  return NextResponse.json({ mandanten: mandanten.length, ergebnisse });
}
