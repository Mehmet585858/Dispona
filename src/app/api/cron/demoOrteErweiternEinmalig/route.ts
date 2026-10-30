import { NextResponse, type NextRequest } from "next/server";
import { seedDemoTenant } from "@/core/demo/seedDemoTenant";

/**
 * Einmaliger, manuell ausgelöster Aufruf (CRON_SECRET-gesichert, derselbe Mechanismus wie die
 * laufenden Cron-Jobs) - führt seedDemoTenant() erneut aus, damit die neu ergänzten Kliniken/
 * Praxen/Pflegeheime/Dialysezentren (src/core/demo/seedDemoTenant.ts) auch in der Produktions-DB
 * entstehen. seedDemoTenant() ist ein reines Upsert, also gefahrlos mehrfach ausführbar. Nach
 * einmaligem Gebrauch wieder entfernt (siehe vorheriges, ebenso einmaliges Muster in dieser
 * Session), kein dauerhafter Bestandteil des Crons.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const erlaubnis = request.headers.get("authorization");
  if (!secret || erlaubnis !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const ergebnis = await seedDemoTenant();
  return NextResponse.json({ ok: true, ergebnis });
}
