/**
 * Lädt Schichten samt Besatzung für die Disposition (Vorschläge, Plan für morgen, Automodus,
 * Zuweisen). Die Rechenlogik selbst (kandidaten.ts, besatzung.ts) bleibt ohne Datenbank.
 */
import type { TenantDb, TenantTx } from "@/lib/db";
import type { ShiftWhereInput } from "@/generated/prisma/models";
import { besatzungAusSchicht } from "@/core/shifts/besatzung";
import type { SchichtFuerPruefung } from "./kandidaten";

export const SCHICHT_MIT_BESATZUNG = {
  vehicleId: true,
  driverId: true,
  start: true,
  end: true,
  onBreak: true,
  unavailable: true,
  scalamobil: true,
  driver: { select: { active: true, scalamobilEinweisung: true } },
  beifahrer: { select: { active: true } },
} as const;

type SchichtRoh = {
  vehicleId: string;
  driverId: string;
  start: Date;
  end: Date;
  onBreak: boolean;
  unavailable: boolean;
  scalamobil: boolean;
  driver: { active: boolean; scalamobilEinweisung: boolean };
  beifahrer: { active: boolean } | null;
};

/** Rohdaten → SchichtFuerPruefung. Ein deaktivierter Fahrer (M-12) zählt wie ausgefallen. */
export function alsSchichtFuerPruefung(s: SchichtRoh): SchichtFuerPruefung {
  return {
    vehicleId: s.vehicleId,
    driverId: s.driverId,
    start: s.start,
    end: s.end,
    onBreak: s.onBreak,
    unavailable: s.unavailable || !s.driver.active,
    besatzung: besatzungAusSchicht(s),
  };
}

export async function schichtenMitBesatzungLaden(db: TenantDb | TenantTx, where: ShiftWhereInput): Promise<SchichtFuerPruefung[]> {
  const schichten = await db.shift.findMany({ where, select: SCHICHT_MIT_BESATZUNG, orderBy: { start: "asc" } });
  return schichten.map(alsSchichtFuerPruefung);
}
