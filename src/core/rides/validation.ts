import { z } from "zod";
import { WOCHENTAGE } from "@/core/shifts/rrule";
import { istDatumIso } from "@/core/shifts/week";

export const TRANSPORT_TYPES = ["SITZEND", "ROLLSTUHL", "TRAGESTUHL", "LIEGEND"] as const;
export const TRANSPORT_TYPE_LABEL: Record<(typeof TRANSPORT_TYPES)[number], string> = {
  SITZEND: "Sitzend",
  ROLLSTUHL: "Rollstuhl",
  TRAGESTUHL: "Tragestuhl",
  LIEGEND: "Liegend",
};

export const DOC_STATUS = ["JA", "NEIN", "UNKLAR", "NICHT_NOETIG"] as const;
export const DOC_STATUS_LABEL: Record<(typeof DOC_STATUS)[number], string> = {
  JA: "Ja",
  NEIN: "Nein",
  UNKLAR: "Weiß nicht",
  NICHT_NOETIG: "Nicht nötig",
};

/** HH:MM, 24-Stunden. Leer ist an den optionalen Stellen erlaubt (siehe unten). */
export const UHRZEIT_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const uhrzeitPflicht = (meldung: string) => z.string().regex(UHRZEIT_HHMM, meldung);
const uhrzeitOptional = (meldung: string) => z.string().regex(UHRZEIT_HHMM, meldung).or(z.literal("")).optional();

/**
 * Maßnahme M-46 Punkt 3 (S2-020): JJJJ-MM-TT UND ein echter Kalendertag – vorher reichte die
 * Schreibweise, "2026-02-30" wurde dann still der 2. März.
 */
export const datumIsoSchema = (meldung: string) => z.string().refine(istDatumIso, meldung);

/**
 * Maßnahme M-07 (S1-005): `rueckfahrt: true` ohne Uhrzeit ist keine ungültige Eingabe und wird
 * auch nicht still verworfen – es heißt "Rückfahrt ja, Zeit offen". Die Rückfahrt wird dann mit
 * Platzhalterzeit angelegt und landet mit dem Problem RUECKFAHRT_ZEIT_OFFEN beim Büro.
 */
export function istRueckfahrtZeitOffen(eingabe: { rueckfahrt: boolean; rueckfahrtzeit?: string }): boolean {
  return eingabe.rueckfahrt && !eingabe.rueckfahrtzeit;
}

export const fahrtSchema = z.object({
  passengerId: z.string().min(1, "Fahrgast fehlt"),
  pickupPlaceId: z.string().min(1, "Abholadresse fehlt"),
  dropoffPlaceId: z.string().min(1, "Zieladresse fehlt"),
  datum: datumIsoSchema("Datum fehlt oder ungültig (JJJJ-MM-TT)"),
  abholzeit: uhrzeitPflicht("Abholzeit fehlt oder ungültig (HH:MM)"),
  terminzeit: uhrzeitOptional("Terminzeit ungültig (HH:MM)"),
  rueckfahrt: z.boolean(),
  rueckfahrtzeit: uhrzeitOptional("Rückfahrtzeit ungültig (HH:MM)"),
  transportType: z.enum(TRANSPORT_TYPES),
  companion: z.boolean(),
  assistanceNotes: z.string().optional(),
  prescription: z.enum(DOC_STATUS),
  approval: z.enum(DOC_STATUS),
});

export type FahrtEingabe = z.infer<typeof fahrtSchema>;

/** Serienfahrt (docs/09-bauplan.md Phase 8): wie fahrtSchema, aber statt eines Datums
 *  Wochentage + Enddatum der Serie. */
export const serieSchema = z.object({
  passengerId: z.string().min(1, "Fahrgast fehlt"),
  pickupPlaceId: z.string().min(1, "Abholadresse fehlt"),
  dropoffPlaceId: z.string().min(1, "Zieladresse fehlt"),
  wochentage: z.array(z.enum(WOCHENTAGE)).min(1, "Mindestens ein Wochentag"),
  abholzeit: uhrzeitPflicht("Abholzeit fehlt oder ungültig (HH:MM)"),
  terminzeit: uhrzeitOptional("Terminzeit ungültig (HH:MM)"),
  rueckfahrt: z.boolean(),
  rueckfahrtzeit: uhrzeitOptional("Rückfahrtzeit ungültig (HH:MM)"),
  bis: datumIsoSchema("Enddatum fehlt oder ungültig (JJJJ-MM-TT)"),
  transportType: z.enum(TRANSPORT_TYPES),
  companion: z.boolean(),
  assistanceNotes: z.string().optional(),
  prescription: z.enum(DOC_STATUS),
  approval: z.enum(DOC_STATUS),
});

export type SerieEingabe = z.infer<typeof serieSchema>;
