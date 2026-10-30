import { NextResponse, type NextRequest } from "next/server";
import { seedDemoTenant } from "@/core/demo/seedDemoTenant";

/** Einmaliger Cron, um die schon in Produktion angelegten Wohnadressen von "Wohnung X" auf die
 * vollständige Adresse umzuschreiben (seedDemoTenant() ist dafür self-healing) - danach Route und
 * vercel.json-Eintrag wieder entfernen, siehe die anderen "...Einmalig"-Routen in diesem Ordner. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const erlaubnis = request.headers.get("authorization");
  if (!secret || erlaubnis !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const ergebnis = await seedDemoTenant();
  return NextResponse.json(ergebnis);
}
