/**
 * Serienfahrten (docs/09-bauplan.md Phase 8, docs/05-disposition.md "Vorausplanung"): eine
 * RideSeries legt eine Vorlage + Wochentags-Regel fest, einzelne Ride-Zeilen entstehen daraus –
 * immer 14 Tage im Voraus (GENERIERUNGS_HORIZONT_TAGE), begrenzt durch `until`. Erzeugung läuft
 * über fahrtErfassen (gleiche Prüfungen, gleicher Vorschlag wie bei jeder anderen Fahrt).
 */
import { referenzenPruefen, withTenant } from "@/lib/db";
import { berlinerMitternacht, datumIso, tagVerschieben } from "@/core/shifts/week";
import { rruleAusWochentagen, terminePlanen } from "@/core/shifts/rrule";
import { istFeiertagNrw } from "@/core/shifts/feiertageNrw";
import { fahrtErfassen, type FahrtErfassenOptionen } from "./erfassen";
import { serieSchema, type FahrtEingabe, type SerieEingabe } from "./validation";

const GENERIERUNGS_HORIZONT_TAGE = 14;

type SerienVorlage = {
  pickupPlaceId: string;
  dropoffPlaceId: string;
  rueckfahrt: boolean;
  rueckfahrtzeit: string;
  transportType: FahrtEingabe["transportType"];
  companion: boolean;
  assistanceNotes: string;
  prescription: FahrtEingabe["prescription"];
  approval: FahrtEingabe["approval"];
};

type SerienZeile = {
  id: string;
  passengerId: string;
  rrule: string;
  pickupTime: string;
  appointmentTime: string | null;
  template: unknown;
};

/** Erzeugt fehlende Ride-Zeilen einer Serie zwischen `von` und `bis` (JJJJ-MM-TT, beide inklusive). */
async function termineErzeugen(
  tenantId: string,
  serie: SerienZeile,
  von: string,
  bis: string,
  optionen: Omit<FahrtErfassenOptionen, "seriesId">,
): Promise<string[]> {
  const db = withTenant(tenantId);
  const termine = terminePlanen(serie.rrule, von, bis);
  if (termine.length === 0) return [];

  const vorhandeneFahrten = await db.ride.findMany({ where: { seriesId: serie.id }, select: { pickupAt: true } });
  const vorhandeneDaten = new Set(vorhandeneFahrten.map((f) => datumIso(f.pickupAt)));
  const vorlage = serie.template as SerienVorlage;

  const neueRideIds: string[] = [];
  for (const termin of termine) {
    if (vorhandeneDaten.has(termin)) continue;
    const { rideId } = await fahrtErfassen(
      tenantId,
      {
        passengerId: serie.passengerId,
        pickupPlaceId: vorlage.pickupPlaceId,
        dropoffPlaceId: vorlage.dropoffPlaceId,
        datum: termin,
        abholzeit: serie.pickupTime,
        terminzeit: serie.appointmentTime ?? "",
        rueckfahrt: vorlage.rueckfahrt,
        rueckfahrtzeit: vorlage.rueckfahrtzeit,
        transportType: vorlage.transportType,
        companion: vorlage.companion,
        assistanceNotes: vorlage.assistanceNotes,
        prescription: vorlage.prescription,
        approval: vorlage.approval,
      },
      { ...optionen, seriesId: serie.id },
    );
    neueRideIds.push(rideId);
  }
  return neueRideIds;
}

export async function serieAnlegen(
  tenantId: string,
  eingabe: SerieEingabe,
  optionen: Omit<FahrtErfassenOptionen, "seriesId">,
): Promise<{
  seriesId: string;
  erzeugteFahrten: string[];
  feiertagsHinweise: { datum: string; name: string }[];
  genehmigungsWarnung: string | null;
}> {
  const daten = serieSchema.parse(eingabe);
  const db = withTenant(tenantId);

  const rrule = rruleAusWochentagen(daten.wochentage);
  const bis = berlinerMitternacht(daten.bis);

  // Prüfbericht S2-008: Fahrgast und Orte müssen diesem Mandanten gehören, bevor die Serie entsteht.
  await referenzenPruefen(tenantId, { passenger: [daten.passengerId], place: [daten.pickupPlaceId, daten.dropoffPlaceId] });

  const serie = await db.rideSeries.create({
    data: {
      tenantId,
      passengerId: daten.passengerId,
      rrule,
      pickupTime: daten.abholzeit,
      appointmentTime: daten.terminzeit || null,
      until: bis,
      template: {
        pickupPlaceId: daten.pickupPlaceId,
        dropoffPlaceId: daten.dropoffPlaceId,
        rueckfahrt: daten.rueckfahrt,
        rueckfahrtzeit: daten.rueckfahrtzeit ?? "",
        transportType: daten.transportType,
        companion: daten.companion,
        assistanceNotes: daten.assistanceNotes ?? "",
        prescription: daten.prescription,
        approval: daten.approval,
      } satisfies SerienVorlage,
    },
  });

  const heute = datumIso(new Date());
  const horizont = tagVerschieben(heute, GENERIERUNGS_HORIZONT_TAGE - 1);
  const bisGenerierung = horizont < daten.bis ? horizont : daten.bis;
  const erzeugteFahrten = await termineErzeugen(tenantId, serie, heute, bisGenerierung, optionen);

  const feiertagsHinweise = terminePlanen(rrule, heute, bisGenerierung)
    .map((datum) => ({ datum, name: istFeiertagNrw(datum) }))
    .filter((f): f is { datum: string; name: string } => f.name !== null);

  const fahrgast = await db.passenger.findUnique({ where: { id: daten.passengerId }, include: { approvals: true } });
  let genehmigungsWarnung: string | null = null;
  if (fahrgast && fahrgast.approvals.length > 0) {
    const spaetesteGenehmigung = fahrgast.approvals.reduce(
      (spaeteste, g) => (g.validUntil > spaeteste ? g.validUntil : spaeteste),
      fahrgast.approvals[0].validUntil,
    );
    if (spaetesteGenehmigung < bis) {
      genehmigungsWarnung = `Die Genehmigung der Krankenkasse läuft am ${datumIso(spaetesteGenehmigung)} ab, vor Ende der Serie am ${daten.bis}.`;
    }
  }

  return { seriesId: serie.id, erzeugteFahrten, feiertagsHinweise, genehmigungsWarnung };
}

/** Für den täglichen Cron: verlängert jede noch laufende Serie auf den 14-Tage-Horizont. */
export async function serienVerlaengern(tenantId: string): Promise<{ serien: number; erzeugteFahrten: number }> {
  const db = withTenant(tenantId);
  const heute = datumIso(new Date());
  const serien = await db.rideSeries.findMany({ where: { until: { gte: berlinerMitternacht(heute) } } });

  let erzeugteFahrten = 0;
  for (const serie of serien) {
    const horizont = tagVerschieben(heute, GENERIERUNGS_HORIZONT_TAGE - 1);
    const bisIso = datumIso(serie.until);
    const bisGenerierung = horizont < bisIso ? horizont : bisIso;
    const neu = await termineErzeugen(tenantId, serie, heute, bisGenerierung, { source: "SERIE" });
    erzeugteFahrten += neu.length;
  }
  return { serien: serien.length, erzeugteFahrten };
}
