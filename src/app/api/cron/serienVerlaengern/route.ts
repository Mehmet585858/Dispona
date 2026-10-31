import { NextResponse, type NextRequest } from "next/server";
import { bearerErlaubt } from "@/lib/geheimnis";
import { fuerAlleMandanten } from "@/core/betrieb/cronLauf";
import { prisma } from "@/lib/prisma";
import { serienVerlaengern } from "@/core/rides/serie";

/**
 * Für einen externen Scheduler (z. B. einmal täglich), gesichert mit CRON_SECRET. Verlängert
 * jede laufende Serie auf den 14-Tage-Horizont (docs/09-bauplan.md Phase 8); ist von sich aus
 * harmlos bei mehrfachem Aufruf am selben Tag, da bereits erzeugte Termine übersprungen werden.
 * Mandantenübergreifend wie Job (siehe src/lib/db.ts) – deshalb hier direkt prisma statt withTenant.
 */
export async function GET(request: NextRequest) {
  if (!bearerErlaubt(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const mandanten = await prisma.tenant.findMany({ select: { id: true } });
  // Maßnahme M-16 Punkt 5: ein Mandant blockiert die anderen nicht (vorher Promise.all).
  const ergebnisse = await fuerAlleMandanten(
    mandanten.map((m) => m.id),
    (tenantId) => serienVerlaengern(tenantId),
  );

  return NextResponse.json({ mandanten: mandanten.length, ergebnisse });
}
