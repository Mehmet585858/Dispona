/**
 * Automatische Disposition (docs/05-disposition.md "Automodus"): prüft alle vorgeschlagenen
 * Fahrten eines Mandanten gegen die Sicherheitsbedingungen und disponiert, wenn alle erfüllt
 * sind – sonst bleibt die Fahrt mit `autoSkipReason` beim Disponenten. Seit dem Schichtplan
 * (02.11.2026) gehört dazu Bedingung 6 "Besatzung passt zur Fahrt". Für einen Cron-Job gedacht
 * (alle 1–2 Minuten, wie die Bestätigungs-Eskalation).
 */
import { withTenant } from "@/lib/db";
import { sicherheitsbedingungenPruefen } from "./automodus";
import { fahrzeugZuweisen, FahrzeugKonfliktError, KeinFahrerError } from "./zuweisen";
import { fehlerArt, jeEintragIsoliert } from "@/core/betrieb/cronLauf";
import { besatzungPruefen, fahrtAnforderung } from "@/core/shifts/besatzung";
import { BESATZUNG_ALLEIN, findeEinsatzSchicht } from "./kandidaten";
import { schichtenMitBesatzungLaden } from "./schichtenLaden";

/** Vermerk an einer Fahrt, deren Prüfung unerwartet scheiterte (Maßnahme M-16). */
export const AUTO_TECHNISCHER_FEHLER =
  "Technischer Fehler bei der automatischen Planung – bitte von Hand disponieren.";

type SuggestionOption = {
  vehicleId: string;
  plate: string;
  etaMin: number;
  onTime: boolean;
  score: number;
  reason: string;
};

export async function automatischDisponieren(tenantId: string) {
  const db = withTenant(tenantId);
  const settings = await db.tenantSettings.findUnique({ where: { tenantId } });
  if (!settings || settings.autoMode === "AUS") {
    return { geprueft: 0, automatischDisponiert: 0, uebersprungen: 0, fehler: 0 };
  }

  const fahrten = await db.ride.findMany({
    where: { status: "VORGESCHLAGEN" },
    select: {
      id: true,
      pickupAt: true,
      problems: true,
      prescription: true,
      transportType: true,
      pickupPlace: { select: { treppe: true } },
      dropoffPlace: { select: { treppe: true } },
    },
    orderBy: { pickupAt: "asc" },
  });

  const jetzt = new Date();
  let automatischDisponiert = 0;
  let uebersprungen = 0;

  // Maßnahme M-16 (S2-010): jede Fahrt für sich – wirft eine unerwartet, bekommt sie einen Vermerk
  // und landet beim Disponenten, die übrigen werden weiter geprüft.
  const { fehler } = await jeEintragIsoliert(
    fahrten,
    async (fahrt) => {
      const vorschlag = await db.suggestion.findFirst({
        where: { rideId: fahrt.id, decision: "OFFEN" },
        orderBy: { createdAt: "desc" },
      });
      const optionen = vorschlag?.options as SuggestionOption[] | undefined;
      if (!optionen || optionen.length === 0) {
        uebersprungen += 1;
        return;
      }

      const effektiveProbleme = [...fahrt.problems];
      if (settings.requireDocsForAuto && fahrt.prescription !== "JA") {
        effektiveProbleme.push("TRANSPORTSCHEIN_FEHLT");
      }

      // Reiht der Reihe nach alle gespeicherten Kandidaten durch (nicht nur den besten): seit der
      // Vorschlagsberechnung kann genau dieses eine Fahrzeug durch eine andere, inzwischen
      // zugewiesene Fahrt überholt worden sein (siehe fahrzeugZuweisen/FahrzeugKonfliktError) oder
      // eine Sicherheitsbedingung erfüllt nicht mehr (z. B. GPS veraltet) - vorher wurde dann direkt
      // aufgegeben, obwohl der zweit- oder drittbeste Vorschlag oft noch passt. Jeder Kandidat
      // bekommt dafür eine eigene, frische Prüfung (eigene GPS-/Schicht-/Vortagesfahrt-Daten).
      let erfolgreich = false;
      let letzterGrund: string | null = null;

      for (let i = 0; i < optionen.length; i++) {
        const kandidat = optionen[i];
        const [letztePosition, schichten, fahrzeug, fruehereFahrtHeute] = await Promise.all([
          db.vehicleLocation.findFirst({
            where: { vehicleId: kandidat.vehicleId },
            orderBy: { at: "desc" },
          }),
          schichtenMitBesatzungLaden(db, {
            vehicleId: kandidat.vehicleId,
            start: { lte: fahrt.pickupAt },
            end: { gte: fahrt.pickupAt },
          }),
          db.vehicle.findUnique({
            where: { id: kandidat.vehicleId },
            select: { id: true, wheelchairSpots: true, carryChair: true, stretcher: true },
          }),
          db.ride.findFirst({
            where: {
              vehicleId: kandidat.vehicleId,
              pickupAt: {
                lt: fahrt.pickupAt,
                gte: new Date(
                  fahrt.pickupAt.getFullYear(),
                  fahrt.pickupAt.getMonth(),
                  fahrt.pickupAt.getDate(),
                ),
              },
              status: { notIn: ["STORNIERT"] },
            },
            select: { id: true },
          }),
        ]);

        // Bedingung 6: Schicht mit passender Besatzung bevorzugen; sonst die erste Schicht (dann
        // scheitert Bedingung 4 oder 6 mit Grund).
        const anforderung = fahrtAnforderung(fahrt);
        const schicht = (fahrzeug && findeEinsatzSchicht(schichten, fahrzeug, fahrt.pickupAt, anforderung)) || schichten[0];

        const gpsAlterMinuten = letztePosition
          ? (jetzt.getTime() - letztePosition.at.getTime()) / 60_000
          : null;

        const ergebnis = sicherheitsbedingungenPruefen({
          problems: effektiveProbleme,
          bester: { zuSpaet: !kandidat.onTime, score: kandidat.score },
          // Marge gegen den jeweils nächstschwächeren Kandidaten in der Liste - bei einem
          // Ausweich-Kandidaten also nicht mehr gegen den (schon gescheiterten) besten verglichen.
          zweitbesterScore: optionen.length > i + 1 ? optionen[i + 1].score : null,
          minMarge: settings.autoModeMinMargin,
          gpsAlterMinuten,
          startetVomBetriebshof: !fruehereFahrtHeute,
          schicht: schicht ?? undefined,
          pickupAt: fahrt.pickupAt,
          autoMode: settings.autoMode,
          jetzt,
          maxTageVoraus: settings.autoModeMaxDaysAhead,
          besatzung:
            schicht && fahrzeug
              ? besatzungPruefen(anforderung, fahrzeug, schicht.besatzung ?? BESATZUNG_ALLEIN)
              : { passt: false, grund: "Keine Schicht mit Besatzung zur Abholzeit" },
        });

        if (!ergebnis.erlaubt) {
          letzterGrund = ergebnis.grund ?? null;
          continue;
        }

        try {
          await fahrzeugZuweisen(tenantId, fahrt.id, kandidat.vehicleId, { dispatchMode: "AUTO" });
          automatischDisponiert += 1;
          erfolgreich = true;
          break;
        } catch (fehler) {
          // Maßnahme M-72: die Schichtprüfung oben und die in fahrzeugZuweisen können auseinander-
          // laufen ("Ich falle aus" dazwischen) – dann nächster Kandidat, kein technischer Fehler.
          if (!(fehler instanceof FahrzeugKonfliktError) && !(fehler instanceof KeinFahrerError)) throw fehler;
          letzterGrund = fehler.message;
        }
      }

      if (!erfolgreich) {
        await db.ride.update({
          where: { id: fahrt.id },
          data: { autoSkipReason: letzterGrund ?? "Kein passendes Fahrzeug verfügbar" },
        });
        uebersprungen += 1;
      }
    },
    async (fahrt, ausnahme) => {
      console.error("Automodus: Fahrt übersprungen nach Fehler", {
        tenantId,
        rideId: fahrt.id,
        fehler: fehlerArt(ausnahme),
      });
      await db.ride.update({
        where: { id: fahrt.id },
        data: { autoSkipReason: AUTO_TECHNISCHER_FEHLER },
      });
      uebersprungen += 1;
    },
  );

  return { geprueft: fahrten.length, automatischDisponiert, uebersprungen, fehler };
}
