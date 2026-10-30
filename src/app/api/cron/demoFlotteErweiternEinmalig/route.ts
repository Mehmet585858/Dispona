import { NextResponse, type NextRequest } from "next/server";
import { seedDemoTenant } from "@/core/demo/seedDemoTenant";

/** Einmaliger Lauf: erweitert die Demo-Flotte des öffentlichen Live-Mandanten von 4 auf 10
 * Fahrzeuge (seedDemoTenant.ts ist ein sicheres Upsert, legt keine Fahrten/Anrufe an). Route und
 * der zugehörige vercel.json-Eintrag werden danach wieder entfernt. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const erlaubnis = request.headers.get("authorization");
  if (!secret || erlaubnis !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }
  const ergebnis = await seedDemoTenant();
  return NextResponse.json(ergebnis);
}
