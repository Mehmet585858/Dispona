import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { loeschfristenDurchsetzen } from "@/core/datenschutz/loeschfristen";

/**
 * Für einen externen Scheduler (einmal nachts), gesichert mit CRON_SECRET. Löscht Audio,
 * Transkripte, alte Fahrten und alte GPS-Punkte je Mandant nach den Fristen aus
 * TenantSettings (docs/08-datenschutz-sicherheit.md). Mandantenübergreifend wie Job
 * (siehe src/lib/db.ts) – deshalb hier direkt prisma statt withTenant.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const erlaubnis = request.headers.get("authorization");
  if (!secret || erlaubnis !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const mandanten = await prisma.tenant.findMany({ select: { id: true } });
  const ergebnisse = [];
  for (const mandant of mandanten) {
    const ergebnis = await loeschfristenDurchsetzen(mandant.id);
    if (ergebnis.audioGeloescht + ergebnis.fahrtenGeloescht + ergebnis.transkripteGeloescht + ergebnis.gpsGeloescht > 0) {
      await prisma.auditLog.create({
        data: {
          tenantId: mandant.id,
          action: "datenschutz.loeschfristen_durchgesetzt",
          entity: "Tenant",
          entityId: mandant.id,
        },
      });
    }
    ergebnisse.push({ tenantId: mandant.id, ...ergebnis });
  }

  return NextResponse.json({ mandanten: mandanten.length, ergebnisse });
}
