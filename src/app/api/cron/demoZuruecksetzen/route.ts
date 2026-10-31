import { NextResponse, type NextRequest } from "next/server";
import { bearerErlaubt } from "@/lib/geheimnis";
import { demoZuruecksetzen } from "@/core/demo/aufraeumen";
import { DEMO_TENANT_ID } from "@/core/demo/const";

/** Für einen externen Scheduler (stündlich), gesichert mit CRON_SECRET - siehe src/core/demo/aufraeumen.ts. */
export async function GET(request: NextRequest) {
  if (!bearerErlaubt(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const ergebnis = await demoZuruecksetzen(DEMO_TENANT_ID);
  return NextResponse.json(ergebnis);
}
