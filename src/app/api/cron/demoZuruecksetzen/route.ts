import { NextResponse, type NextRequest } from "next/server";
import { demoZuruecksetzen } from "@/core/demo/aufraeumen";

/** Für einen externen Scheduler (stündlich), gesichert mit CRON_SECRET - siehe src/core/demo/aufraeumen.ts. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const erlaubnis = request.headers.get("authorization");
  if (!secret || erlaubnis !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const ergebnis = await demoZuruecksetzen();
  return NextResponse.json(ergebnis);
}
