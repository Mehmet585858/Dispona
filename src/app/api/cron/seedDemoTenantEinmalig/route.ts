import { NextResponse, type NextRequest } from "next/server";
import { seedDemoTenant } from "@/core/demo/seedDemoTenant";

/**
 * EINMALIGER Produktions-Seed für den Demo-Mandanten, über Vercel Cron (CRON_SECRET) statt per
 * Hand mit der echten DATABASE_URL ausgeführt - so muss das Produktions-Secret nie lokal
 * auftauchen. Nach dem ersten erfolgreichen Lauf wieder aus vercel.json entfernen; seedDemoTenant
 * selbst ist idempotent (Upserts), ein versehentlicher zweiter Lauf schadet also nicht.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const erlaubnis = request.headers.get("authorization");
  if (!secret || erlaubnis !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const ergebnis = await seedDemoTenant();
  return NextResponse.json(ergebnis);
}
