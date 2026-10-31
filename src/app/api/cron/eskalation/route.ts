import { NextResponse, type NextRequest } from "next/server";
import { bearerErlaubt } from "@/lib/geheimnis";
import { cronLaufMitSperre, cronUeberwachen, fuerAlleMandanten } from "@/core/betrieb/cronLauf";
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

  // Maßnahme M-16: je Mandant mit Laufsperre und Laufprotokoll; ein Mandant blockiert die anderen
  // nicht (vorher Promise.all). Dazu die Überwachung des Automodus-Crons.
  const mandanten = await prisma.tenant.findMany({ select: { id: true } });
  const ergebnisse = await fuerAlleMandanten(
    mandanten.map((m) => m.id),
    async (tenantId) => {
      const lauf = await cronLaufMitSperre(tenantId, "eskalation", async () => ({
        bestaetigungen: await bestaetigungenPruefen(tenantId),
        keinFahrzeug: await keinFahrzeugAlarmPruefen(tenantId),
      }));
      const ueberwachung = await cronUeberwachen(tenantId);
      return { lauf, ueberwachung };
    },
  );

  return NextResponse.json({ mandanten: mandanten.length, ergebnisse });
}
