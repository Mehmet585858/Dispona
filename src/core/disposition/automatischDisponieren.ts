/**
 * Automatische Disposition (docs/05-disposition.md "Automodus"): prüft alle vorgeschlagenen
 * Fahrten eines Mandanten gegen die 5 Sicherheitsbedingungen und disponiert, wenn alle erfüllt
 * sind – sonst bleibt die Fahrt mit `autoSkipReason` beim Disponenten. Für einen Cron-Job gedacht
 * (alle 1–2 Minuten, wie die Bestätigungs-Eskalation).
 */
import { withTenant } from "@/lib/db";
import { sicherheitsbedingungenPruefen } from "./automodus";
import { fahrzeugZuweisen } from "./zuweisen";

type SuggestionOption = { vehicleId: string; plate: string; etaMin: number; onTime: boolean; score: number; reason: string };

export async function automatischDisponieren(tenantId: string) {
  const db = withTenant(tenantId);
  const settings = await db.tenantSettings.findUnique({ where: { tenantId } });
  if (!settings || settings.autoMode === "AUS") {
    return { geprueft: 0, automatischDisponiert: 0, uebersprungen: 0 };
  }

  const fahrten = await db.ride.findMany({
    where: { status: "VORGESCHLAGEN" },
    select: { id: true, pickupAt: true, problems: true, prescription: true },
    orderBy: { pickupAt: "asc" },
  });

  const jetzt = new Date();
  let automatischDisponiert = 0;
  let uebersprungen = 0;

  for (const fahrt of fahrten) {
    const vorschlag = await db.suggestion.findFirst({
      where: { rideId: fahrt.id, decision: "OFFEN" },
      orderBy: { createdAt: "desc" },
    });
    const optionen = vorschlag?.options as SuggestionOption[] | undefined;
    const bester = optionen?.[0];
    if (!bester) {
      uebersprungen += 1;
      continue;
    }

    const effektiveProbleme = [...fahrt.problems];
    if (settings.requireDocsForAuto && fahrt.prescription !== "JA") {
      effektiveProbleme.push("TRANSPORTSCHEIN_FEHLT");
    }

    const [letztePosition, schicht, fruehereFahrtHeute] = await Promise.all([
      db.vehicleLocation.findFirst({ where: { vehicleId: bester.vehicleId }, orderBy: { at: "desc" } }),
      db.shift.findFirst({
        where: { vehicleId: bester.vehicleId, start: { lte: fahrt.pickupAt }, end: { gte: fahrt.pickupAt } },
        select: { onBreak: true, unavailable: true, start: true, end: true },
      }),
      db.ride.findFirst({
        where: {
          vehicleId: bester.vehicleId,
          pickupAt: { lt: fahrt.pickupAt, gte: new Date(fahrt.pickupAt.getFullYear(), fahrt.pickupAt.getMonth(), fahrt.pickupAt.getDate()) },
          status: { notIn: ["STORNIERT"] },
        },
        select: { id: true },
      }),
    ]);

    const gpsAlterMinuten = letztePosition ? (jetzt.getTime() - letztePosition.at.getTime()) / 60_000 : null;

    const ergebnis = sicherheitsbedingungenPruefen({
      problems: effektiveProbleme,
      bester: { zuSpaet: !bester.onTime, score: bester.score },
      zweitbesterScore: optionen && optionen.length > 1 ? optionen[1].score : null,
      minMarge: settings.autoModeMinMargin,
      gpsAlterMinuten,
      startetVomBetriebshof: !fruehereFahrtHeute,
      schicht: schicht ?? undefined,
      pickupAt: fahrt.pickupAt,
      autoMode: settings.autoMode,
      jetzt,
      maxTageVoraus: settings.autoModeMaxDaysAhead,
    });

    if (ergebnis.erlaubt) {
      await fahrzeugZuweisen(tenantId, fahrt.id, bester.vehicleId, { dispatchMode: "AUTO" });
      automatischDisponiert += 1;
    } else {
      await db.ride.update({ where: { id: fahrt.id }, data: { autoSkipReason: ergebnis.grund } });
      uebersprungen += 1;
    }
  }

  return { geprueft: fahrten.length, automatischDisponiert, uebersprungen };
}
