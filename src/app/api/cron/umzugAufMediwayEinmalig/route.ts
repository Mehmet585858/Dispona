import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDemoTenant } from "@/core/demo/seedDemoTenant";
import { DEMO_TENANT_ID } from "@/core/demo/const";

/**
 * EINMALIG: Korrigiert ein Missverständnis - "Mediway Krankenfahrdienst" sollte der neue,
 * erfundene Name des ÖFFENTLICHEN Demo-Mandanten sein (bessere Außenwirkung als "Dispona
 * Live-Demo"), nicht ein zweiter, separater Testmandant. Verschiebt die Vapi-Testnummer
 * (+18583994019) auf den Demo-Mandanten. Der fälschlich angelegte separate
 * "Mediway Krankenfahrdienst (Live Test)"-Mandant bleibt vorerst unberührt stehen (0 Fahrten,
 * kein Risiko) - Aufräumen ist ein separater Schritt. Gleicher Cron-Ansatz wie die anderen
 * Einmal-Skripte, danach wieder aus vercel.json entfernen.
 */
const TESTNUMMER = "+18583994019";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const erlaubnis = request.headers.get("authorization");
  if (!secret || erlaubnis !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  // 1) Demo-Mandant umbenennen/self-healen (neuer Name, Begrüßung, Stimm-ID etc.).
  const demoErgebnis = await seedDemoTenant();

  // 2) Telefonnummer auf den Demo-Mandanten umziehen.
  const bestehendeNummer = await prisma.phoneNumber.findUnique({ where: { e164: TESTNUMMER } });
  if (bestehendeNummer && bestehendeNummer.tenantId !== DEMO_TENANT_ID) {
    await prisma.phoneNumber.update({ where: { e164: TESTNUMMER }, data: { tenantId: DEMO_TENANT_ID } });
  } else if (!bestehendeNummer) {
    await prisma.phoneNumber.create({ data: { tenantId: DEMO_TENANT_ID, e164: TESTNUMMER, provider: "VAPI" } });
  }

  return NextResponse.json({ demoErgebnis });
}
