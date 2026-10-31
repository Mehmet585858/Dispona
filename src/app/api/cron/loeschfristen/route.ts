import { NextResponse, type NextRequest } from "next/server";
import { bearerErlaubt } from "@/lib/geheimnis";
import { fuerAlleMandanten } from "@/core/betrieb/cronLauf";
import { prisma } from "@/lib/prisma";
import { loeschfristenDurchsetzen } from "@/core/datenschutz/loeschfristen";

/**
 * Für einen externen Scheduler (einmal nachts), gesichert mit CRON_SECRET. Löscht Audio,
 * Transkripte, alte Fahrten und alte GPS-Punkte je Mandant nach den Fristen aus
 * TenantSettings (docs/08-datenschutz-sicherheit.md). Mandantenübergreifend wie Job
 * (siehe src/lib/db.ts) – deshalb hier direkt prisma statt withTenant.
 */
export async function GET(request: NextRequest) {
  if (!bearerErlaubt(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const mandanten = await prisma.tenant.findMany({ select: { id: true } });
  // Maßnahme M-16 Punkt 5: ein Mandant, dessen Löschlauf scheitert, blockiert die anderen nicht.
  const ergebnisse = await fuerAlleMandanten(
    mandanten.map((m) => m.id),
    async (tenantId) => {
      const ergebnis = await loeschfristenDurchsetzen(tenantId);
      if (ergebnis.audioGeloescht + ergebnis.fahrtenGeloescht + ergebnis.transkripteGeloescht + ergebnis.gpsGeloescht > 0) {
        await prisma.auditLog.create({
          data: {
            tenantId,
            action: "datenschutz.loeschfristen_durchgesetzt",
            entity: "Tenant",
            entityId: tenantId,
          },
        });
      }
      return ergebnis;
    },
  );

  return NextResponse.json({ mandanten: mandanten.length, ergebnisse });
}
