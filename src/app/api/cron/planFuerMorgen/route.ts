import { NextResponse, type NextRequest } from "next/server";
import { bearerErlaubt } from "@/lib/geheimnis";
import { cronLaufMitSperre, fuerAlleMandanten, planFuerMorgenBeanspruchen } from "@/core/betrieb/cronLauf";
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

  // Maßnahme M-16 Punkt 3 (S3-011, R2-3): "heute gelaufen" wird VOR dem Lauf atomar beansprucht –
  // ein zweiter Takt während eines langen Laufs (oder nach einem Fehler) rechnet nicht noch einmal.
  // Ein fehlgeschlagener Lauf steht im Laufprotokoll (CronLauf "planFuerMorgen").
  const faellig = mandanten
    .filter((m) => !(m.planFuerMorgenLauf && datumIso(m.planFuerMorgenLauf) === heuteIso))
    .filter((m) => jetztBerlin >= m.planFuerMorgenZeit)
    .map((m) => m.tenantId);
  const ergebnisse = await fuerAlleMandanten(faellig, async (tenantId) => {
    if (!(await planFuerMorgenBeanspruchen(tenantId, heuteIso))) return { status: "schon gelaufen" as const };
    return cronLaufMitSperre(tenantId, "planFuerMorgen", () => planFuerMorgenBerechnen(tenantId));
  });

  return NextResponse.json({ mandanten: mandanten.length, gelaufen: ergebnisse.length, ergebnisse });
}
