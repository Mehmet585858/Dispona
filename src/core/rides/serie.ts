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
import { fahrtAendern, type FahrtAenderung } from "./aendern";
import { fahrtStornieren } from "./stornieren";
import { datumIsoSchema, serieSchema, TRANSPORT_TYPES, UHRZEIT_HHMM, type FahrtEingabe, type SerieEingabe } from "./validation";
import { WOCHENTAGE } from "@/core/shifts/rrule";
import { z } from "zod";

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
  pausedFrom?: Date | null;
  pausedUntil?: Date | null;
};

/** Maßnahme M-22: liegt der Tag (JJJJ-MM-TT) in der Pause der Serie? */
function inPause(serie: SerienZeile, tag: string): boolean {
  if (!serie.pausedFrom || !serie.pausedUntil) return false;
  return tag >= datumIso(serie.pausedFrom) && tag <= datumIso(serie.pausedUntil);
}

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
    if (inPause(serie, termin)) continue;
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

export type SerieAnlegenOptionen = Omit<FahrtErfassenOptionen, "seriesId"> & {
  /**
   * Maßnahme M-14 Punkt 4: false = nur die Serie anlegen, die Termine erzeugt der Aufrufer danach
   * mit serieTermineErzeugen() (z. B. nach der Antwort an den Telefonanbieter). Standard: sofort.
   */
  termineSofort?: boolean;
};

export async function serieAnlegen(
  tenantId: string,
  eingabe: SerieEingabe,
  { termineSofort = true, ...optionen }: SerieAnlegenOptionen,
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
  const erzeugteFahrten = termineSofort ? await termineErzeugen(tenantId, serie, heute, bisGenerierung, optionen) : [];

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

/**
 * Erzeugt die fehlenden Termine EINER Serie bis zum 14-Tage-Horizont (bzw. Serienende). Für die
 * Hintergrundaufgabe nach serieAnlegen({ termineSofort: false }) – Maßnahme M-14 Punkt 4. Ist wie
 * serienVerlaengern wiederholbar: vorhandene Termine werden übersprungen; fällt die Aufgabe aus,
 * holt der tägliche Cron die Termine nach.
 */
export async function serieTermineErzeugen(
  tenantId: string,
  seriesId: string,
  optionen: Omit<FahrtErfassenOptionen, "seriesId">,
): Promise<string[]> {
  const serie = await withTenant(tenantId).rideSeries.findUnique({ where: { id: seriesId } });
  if (!serie) return [];
  const heute = datumIso(new Date());
  const horizont = tagVerschieben(heute, GENERIERUNGS_HORIZONT_TAGE - 1);
  const bisIso = datumIso(serie.until);
  return termineErzeugen(tenantId, serie, heute, horizont < bisIso ? horizont : bisIso, optionen);
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

/**
 * Fahrten einer Serie, die noch nicht begonnen haben – nur diese werden beim Beenden, Pausieren oder
 * Ändern storniert bzw. angepasst (Maßnahme M-19: laufende Fahrten nie). PROBLEM-Fahrten bleiben
 * beim Büro (z. B. eine abgebrochene Fahrt).
 */
const NICHT_BEGONNEN = ["ENTWURF", "ERFASST", "VORGESCHLAGEN", "DISPONIERT"] as const;

async function serienFahrtenAbTag(tenantId: string, seriesId: string, abIso: string) {
  return withTenant(tenantId).ride.findMany({
    where: { seriesId, status: { in: [...NICHT_BEGONNEN] }, pickupAt: { gte: berlinerMitternacht(abIso) } },
    select: { id: true, pickupAt: true, returnOfId: true },
    orderBy: { pickupAt: "asc" },
  });
}

async function serieLaden(tenantId: string, seriesId: string) {
  const serie = await withTenant(tenantId).rideSeries.findUnique({ where: { id: seriesId } });
  if (!serie) throw new Error("Serie nicht gefunden.");
  return serie;
}

// Maßnahme M-46 (S2-020): echter Kalendertag, nicht nur die Schreibweise.
const datumSchema = datumIsoSchema("Datum ungültig (JJJJ-MM-TT)");

/**
 * Serie ab einem Tag beenden (Maßnahme M-22, Prüfbericht S2-005): letzter Serientag wird der Vortag,
 * alle noch nicht begonnenen Fahrten ab `abIso` werden storniert (der Fahrer bekommt wie bei jedem
 * Storno "Fahrt entfällt"). Vorher lief eine Serie nach Umzug, Zentrumswechsel oder Tod bis zum
 * Enddatum weiter, und der nächtliche Lauf erzeugte immer neue Fahrten.
 */
export async function serieBeenden(
  tenantId: string,
  seriesId: string,
  abIso: string,
  optionen: { userId?: string } = {},
): Promise<{ storniert: number }> {
  datumSchema.parse(abIso);
  await serieLaden(tenantId, seriesId);
  await withTenant(tenantId).rideSeries.update({
    where: { id: seriesId },
    data: { until: berlinerMitternacht(tagVerschieben(abIso, -1)) },
  });
  const fahrten = await serienFahrtenAbTag(tenantId, seriesId, abIso);
  for (const fahrt of fahrten) await fahrtStornieren(tenantId, fahrt.id, { userId: optionen.userId });
  return { storniert: fahrten.length };
}

/** Serie für einen Zeitraum aussetzen (beide Tage einschließlich): Fahrten darin storniert, keine neuen. */
export async function seriePausieren(
  tenantId: string,
  seriesId: string,
  vonIso: string,
  bisIso: string,
  optionen: { userId?: string } = {},
): Promise<{ storniert: number }> {
  datumSchema.parse(vonIso);
  datumSchema.parse(bisIso);
  if (bisIso < vonIso) throw new Error("Das Ende der Pause liegt vor dem Beginn.");
  await serieLaden(tenantId, seriesId);
  await withTenant(tenantId).rideSeries.update({
    where: { id: seriesId },
    data: { pausedFrom: berlinerMitternacht(vonIso), pausedUntil: berlinerMitternacht(bisIso) },
  });
  const fahrten = (await serienFahrtenAbTag(tenantId, seriesId, vonIso)).filter((f) => datumIso(f.pickupAt) <= bisIso);
  for (const fahrt of fahrten) await fahrtStornieren(tenantId, fahrt.id, { userId: optionen.userId });
  return { storniert: fahrten.length };
}

export const serienAenderungSchema = z.object({
  abholzeit: z.string().regex(UHRZEIT_HHMM, "Abholzeit ungültig (HH:MM)").optional(),
  terminzeit: z.string().regex(UHRZEIT_HHMM, "Terminzeit ungültig (HH:MM)").optional(),
  wochentage: z.array(z.enum(WOCHENTAGE)).min(1, "Mindestens ein Wochentag").optional(),
  bis: datumSchema.optional(),
  pickupPlaceId: z.string().min(1).optional(),
  dropoffPlaceId: z.string().min(1).optional(),
  transportType: z.enum(TRANSPORT_TYPES).optional(),
  companion: z.boolean().optional(),
  assistanceNotes: z.string().optional(),
});
export type SerienAenderung = z.infer<typeof serienAenderungSchema>;

/**
 * Serie ändern (Maßnahme M-22). Gilt für die Vorlage und alle künftigen, noch nicht begonnenen Fahrten:
 * - entfernte Wochentage bzw. Tage nach einem neuen Enddatum: storniert,
 * - Zeit/Orte/Transportart/Begleitung/Hinweis: je Fahrt über fahrtAendern (neu geprüft, neu
 *   vorgeschlagen, eine Meldung je Fahrer – M-20); Rückfahrten bekommen die vertauschten Orte,
 *   aber nicht die Abholzeit der Hinfahrt,
 * - neue Wochentage: Termine werden bis zum 14-Tage-Horizont erzeugt.
 * Annahme (Spezifikation schweigt): Änderungen gelten ab heute.
 */
export async function serieAendern(
  tenantId: string,
  seriesId: string,
  eingabe: SerienAenderung,
  optionen: { userId?: string } = {},
): Promise<{ storniert: number; geaendert: number; neu: number }> {
  const aenderung = serienAenderungSchema.parse(eingabe);
  const serie = await serieLaden(tenantId, seriesId);
  await referenzenPruefen(tenantId, { place: [aenderung.pickupPlaceId, aenderung.dropoffPlaceId] });

  const vorlage = serie.template as SerienVorlage;
  const neueVorlage: SerienVorlage = {
    ...vorlage,
    pickupPlaceId: aenderung.pickupPlaceId ?? vorlage.pickupPlaceId,
    dropoffPlaceId: aenderung.dropoffPlaceId ?? vorlage.dropoffPlaceId,
    transportType: aenderung.transportType ?? vorlage.transportType,
    companion: aenderung.companion ?? vorlage.companion,
    assistanceNotes: aenderung.assistanceNotes ?? vorlage.assistanceNotes,
  };
  const rrule = aenderung.wochentage ? rruleAusWochentagen(aenderung.wochentage) : serie.rrule;
  await withTenant(tenantId).rideSeries.update({
    where: { id: seriesId },
    data: {
      rrule,
      pickupTime: aenderung.abholzeit ?? serie.pickupTime,
      appointmentTime: aenderung.terminzeit ?? serie.appointmentTime,
      until: aenderung.bis ? berlinerMitternacht(aenderung.bis) : serie.until,
      template: neueVorlage,
    },
  });

  const heute = datumIso(new Date());
  let storniert = 0;
  let geaendert = 0;
  for (const fahrt of await serienFahrtenAbTag(tenantId, seriesId, heute)) {
    // Bei Rückfahrten zählt der Tag der Hinfahrt (Rückfahrt nach Mitternacht liegt am Folgetag).
    const hin = fahrt.returnOfId
      ? await withTenant(tenantId).ride.findUnique({ where: { id: fahrt.returnOfId }, select: { pickupAt: true } })
      : null;
    const serientag = datumIso(hin?.pickupAt ?? fahrt.pickupAt);
    const passtNicht =
      terminePlanen(rrule, serientag, serientag).length === 0 || (aenderung.bis !== undefined && serientag > aenderung.bis);
    if (passtNicht) {
      await fahrtStornieren(tenantId, fahrt.id, { userId: optionen.userId });
      storniert += 1;
      continue;
    }
    const istRueckfahrt = fahrt.returnOfId !== null;
    const fahrtAenderung: FahrtAenderung = {
      ...(istRueckfahrt ? {} : { abholzeit: aenderung.abholzeit, terminzeit: aenderung.terminzeit }),
      pickupPlaceId: istRueckfahrt ? aenderung.dropoffPlaceId : aenderung.pickupPlaceId,
      dropoffPlaceId: istRueckfahrt ? aenderung.pickupPlaceId : aenderung.dropoffPlaceId,
      transportType: aenderung.transportType,
      companion: aenderung.companion,
      assistanceNotes: aenderung.assistanceNotes,
    };
    if (Object.values(fahrtAenderung).every((wert) => wert === undefined)) continue;
    await fahrtAendern(tenantId, fahrt.id, fahrtAenderung, { userId: optionen.userId });
    geaendert += 1;
  }

  const neu = await serieTermineErzeugen(tenantId, seriesId, { source: "SERIE", userId: optionen.userId });
  return { storniert, geaendert, neu: neu.length };
}
