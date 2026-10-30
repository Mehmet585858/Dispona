/**
 * "Plan für morgen" (docs/05-disposition.md "Vorausplanung"): am Vorabend alle noch
 * unzugewiesenen Fahrten des nächsten Tages der Reihe nach nach Abholzeit einplanen (gierig,
 * wie bei einer einzelnen Fahrt), als Sammel-Vorschlag. Eindeutige Fälle, die im Automodus die
 * Sicherheitsbedingungen erfüllen, werden sofort disponiert; der Rest bleibt als normaler
 * Vorschlag (Suggestion, Status VORGESCHLAGEN) für den Disponenten stehen.
 */
import { withTenant } from "@/lib/db";
import { berlinerMitternacht, datumIso, tagVerschieben } from "@/core/shifts/week";
import { routingProvider } from "@/providers/routing";
import { fahrtStatusAendern } from "@/core/rides/status";
import { fahrzeugZuweisen, FahrzeugKonfliktError } from "./zuweisen";
import { sicherheitsbedingungenPruefen } from "./automodus";
import { vorschlaegeBerechnen, type GeplanteFahrt } from "./vorschlagen";

export async function planFuerMorgenBerechnen(tenantId: string) {
  const db = withTenant(tenantId);
  const settings = await db.tenantSettings.findUnique({ where: { tenantId } });
  const depot = settings?.depotAddress as { lat: number; lng: number } | null;
  if (!settings || !depot) {
    return { geprueft: 0, automatischDisponiert: 0, vorgeschlagen: 0, keinKandidat: 0 };
  }

  const heuteIso = datumIso(new Date());
  const morgenIso = tagVerschieben(heuteIso, 1);
  const morgenStart = berlinerMitternacht(morgenIso);
  const morgenEnde = new Date(morgenStart);
  morgenEnde.setDate(morgenEnde.getDate() + 1);

  const fahrzeuge = await db.vehicle.findMany({ where: { active: true } });
  const schichten = await db.shift.findMany({ where: { start: { lt: morgenEnde }, end: { gte: morgenStart } } });

  const bereitsGeplantRoh = await db.ride.findMany({
    where: { pickupAt: { gte: morgenStart, lt: morgenEnde }, vehicleId: { not: null }, status: { notIn: ["STORNIERT"] } },
    include: { pickupPlace: true, dropoffPlace: true },
  });
  const tagesplan: GeplanteFahrt[] = bereitsGeplantRoh.map((r) => ({
    vehicleId: r.vehicleId!,
    pickupAt: r.pickupAt,
    appointmentAt: r.appointmentAt,
    pickupOrt: { lat: r.pickupPlace.lat, lng: r.pickupPlace.lng },
    dropoffOrt: { lat: r.dropoffPlace.lat, lng: r.dropoffPlace.lng },
    transportType: r.transportType,
  }));

  const unzugewiesen = await db.ride.findMany({
    where: { pickupAt: { gte: morgenStart, lt: morgenEnde }, vehicleId: null, status: { in: ["ERFASST", "VORGESCHLAGEN"] } },
    include: { pickupPlace: true, dropoffPlace: true },
    orderBy: { pickupAt: "asc" },
  });

  const jetzt = new Date();
  let automatischDisponiert = 0;
  let vorgeschlagen = 0;
  let keinKandidat = 0;

  for (const fahrt of unzugewiesen) {
    const pickupOrt = { lat: fahrt.pickupPlace.lat, lng: fahrt.pickupPlace.lng };
    const dropoffOrt = { lat: fahrt.dropoffPlace.lat, lng: fahrt.dropoffPlace.lng };

    const { vorschlaege, keinKandidat: keiner } = await vorschlaegeBerechnen({
      fahrt: {
        transportType: fahrt.transportType,
        companion: fahrt.companion,
        pickupAt: fahrt.pickupAt,
        appointmentAt: fahrt.appointmentAt,
        pickupOrt,
        dropoffOrt,
      },
      fahrzeuge,
      schichten,
      tagesplan,
      depot,
      routing: routingProvider,
    });

    if (vorschlaege.length === 0) {
      if (keiner) {
        await db.ride.update({ where: { id: fahrt.id }, data: { problems: { push: "KEIN_FAHRZEUG" } } });
        keinKandidat += 1;
      }
      continue;
    }

    await db.suggestion.create({
      data: {
        tenantId,
        rideId: fahrt.id,
        options: vorschlaege.map((v) => ({
          vehicleId: v.vehicleId,
          plate: v.plate,
          etaMin: v.etaMin,
          onTime: !v.zuSpaet,
          score: Math.round(v.score * 10) / 10,
          reason: v.begruendung,
        })),
        decision: "OFFEN",
      },
    });
    if (fahrt.status !== "VORGESCHLAGEN") {
      await fahrtStatusAendern(tenantId, fahrt.id, "VORGESCHLAGEN");
    }

    const bester = vorschlaege[0];
    const startetVomBetriebshof = !tagesplan.some(
      (g) => g.vehicleId === bester.vehicleId && g.pickupAt < fahrt.pickupAt,
    );

    // In den (nur für diesen Lauf gültigen) Tagesplan aufnehmen, damit nachfolgende Fahrten in
    // derselben Reihenfolge dieses Fahrzeug als belegt sehen (docs/05-disposition.md "gierig").
    tagesplan.push({ vehicleId: bester.vehicleId, pickupAt: fahrt.pickupAt, appointmentAt: fahrt.appointmentAt, pickupOrt, dropoffOrt, transportType: fahrt.transportType });

    const [letztePosition, schicht] = await Promise.all([
      db.vehicleLocation.findFirst({ where: { vehicleId: bester.vehicleId }, orderBy: { at: "desc" } }),
      db.shift.findFirst({
        where: { vehicleId: bester.vehicleId, start: { lte: fahrt.pickupAt }, end: { gte: fahrt.pickupAt } },
        select: { onBreak: true, unavailable: true, start: true, end: true },
      }),
    ]);
    const gpsAlterMinuten = letztePosition ? (jetzt.getTime() - letztePosition.at.getTime()) / 60_000 : null;

    const effektiveProbleme = [...fahrt.problems];
    if (settings.requireDocsForAuto && fahrt.prescription !== "JA") {
      effektiveProbleme.push("TRANSPORTSCHEIN_FEHLT");
    }

    const automodeErgebnis = sicherheitsbedingungenPruefen({
      problems: effektiveProbleme,
      bester: { zuSpaet: bester.zuSpaet, score: bester.score },
      zweitbesterScore: vorschlaege.length > 1 ? vorschlaege[1].score : null,
      minMarge: settings.autoModeMinMargin,
      gpsAlterMinuten,
      startetVomBetriebshof,
      schicht: schicht ?? undefined,
      pickupAt: fahrt.pickupAt,
      autoMode: settings.autoMode,
      jetzt,
      maxTageVoraus: settings.autoModeMaxDaysAhead,
    });

    if (automodeErgebnis.erlaubt) {
      try {
        await fahrzeugZuweisen(tenantId, fahrt.id, bester.vehicleId, { dispatchMode: "AUTO" });
        automatischDisponiert += 1;
      } catch (fehler) {
        // Der im eigenen tagesplan reservierte Slot schützt nur gegen Fahrten aus diesem Lauf -
        // eine zeitgleich von anderswo (z. B. einem echten Anruf) zugewiesene Fahrt sieht
        // fahrzeugZuweisen trotzdem; dann bleibt die Fahrt als normaler Vorschlag stehen statt
        // den ganzen Lauf abzubrechen.
        if (!(fehler instanceof FahrzeugKonfliktError)) throw fehler;
        vorgeschlagen += 1;
      }
    } else {
      vorgeschlagen += 1;
    }
  }

  return { geprueft: unzugewiesen.length, automatischDisponiert, vorgeschlagen, keinKandidat };
}
