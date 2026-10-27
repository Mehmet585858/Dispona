import { z } from "zod";
import { WOCHENTAGE } from "@/core/shifts/rrule";

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

export const fahrtSchema = z.object({
  passengerId: z.string().min(1, "Fahrgast fehlt"),
  pickupPlaceId: z.string().min(1, "Abholadresse fehlt"),
  dropoffPlaceId: z.string().min(1, "Zieladresse fehlt"),
  datum: z.string().min(1, "Datum fehlt"), // JJJJ-MM-TT
  abholzeit: z.string().min(1, "Abholzeit fehlt"), // HH:MM
  terminzeit: z.string().optional(), // HH:MM, optional
  rueckfahrt: z.boolean(),
  rueckfahrtzeit: z.string().optional(),
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
  abholzeit: z.string().min(1, "Abholzeit fehlt"), // HH:MM
  terminzeit: z.string().optional(), // HH:MM, optional
  rueckfahrt: z.boolean(),
  rueckfahrtzeit: z.string().optional(),
  bis: z.string().min(1, "Enddatum fehlt"), // JJJJ-MM-TT
  transportType: z.enum(TRANSPORT_TYPES),
  companion: z.boolean(),
  assistanceNotes: z.string().optional(),
  prescription: z.enum(DOC_STATUS),
  approval: z.enum(DOC_STATUS),
});

export type SerieEingabe = z.infer<typeof serieSchema>;
