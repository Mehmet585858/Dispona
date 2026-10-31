import { NextResponse, type NextRequest } from "next/server";
import { bearerErlaubt } from "@/lib/geheimnis";
import { prisma } from "@/lib/prisma";
import { datumIso } from "@/core/shifts/week";
import { planFuerMorgenBerechnen } from "@/core/disposition/planFuerMorgen";

/**
 * Für einen externen Scheduler (alle 1-2 Minuten), gesichert mit CRON_SECRET. Läuft pro Mandant
 * nur einmal am Tag, sobald die Berliner Uhrzeit die eingestellte planFuerMorgenZeit erreicht hat
 * (Standard 18:00, docs/05-disposition.md "Vorausplanung"). Mandantenübergreifend wie Job
 * (siehe src/lib/db.ts) – deshalb hier direkt prisma statt withTenant.
 */
export async function GET(request: NextRequest) {
  if (!bearerErlaubt(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const jetztBerlin = new Date().toLocaleTimeString("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const heuteIso = datumIso(new Date());

  const mandanten = await prisma.tenantSettings.findMany({
    select: { tenantId: true, planFuerMorgenZeit: true, planFuerMorgenLauf: true },
  });

  const ergebnisse = [];
  for (const mandant of mandanten) {
    const schonHeuteGelaufen = mandant.planFuerMorgenLauf && datumIso(mandant.planFuerMorgenLauf) === heuteIso;
    if (schonHeuteGelaufen || jetztBerlin < mandant.planFuerMorgenZeit) continue;

    const ergebnis = await planFuerMorgenBerechnen(mandant.tenantId);
    await prisma.tenantSettings.update({
      where: { tenantId: mandant.tenantId },
      data: { planFuerMorgenLauf: new Date() },
    });
    ergebnisse.push({ tenantId: mandant.tenantId, ...ergebnis });
  }

  return NextResponse.json({ mandanten: mandanten.length, gelaufen: ergebnisse.length, ergebnisse });
}
