import type { TransportType } from "@/generated/prisma/enums";
import { besatzungPruefen, type Besatzung, type FahrtAnforderung } from "@/core/shifts/besatzung";

export type FahrzeugFuerPruefung = {
  id: string;
  seats: number;
  wheelchairSpots: number;
  carryChair: boolean;
  stretcher: boolean;
  active: boolean;
};

/**
 * Schritt 1 (docs/05-disposition.md): passt die Ausstattung des Fahrzeugs zur Beförderungsart?
 * Tragestuhl (Schichtplan, 02.11.2026): ebenerdig reicht ein BTW mit Tragestuhl ODER Rollstuhlplatz.
 * Ob eine Treppe oder eine Liegend-Fahrt mit der Besatzung geht, prüft besatzungPruefen.
 */
export function erfuelltAusstattung(
  transportType: TransportType,
  companion: boolean,
  fahrzeug: FahrzeugFuerPruefung,
): boolean {
  if (!fahrzeug.active) return false;
  switch (transportType) {
    case "SITZEND":
      return fahrzeug.seats >= 1 + (companion ? 1 : 0);
    case "ROLLSTUHL":
      return fahrzeug.wheelchairSpots >= 1 && fahrzeug.seats >= (companion ? 1 : 0);
    case "TRAGESTUHL":
      return fahrzeug.carryChair || fahrzeug.wheelchairSpots >= 1;
    case "LIEGEND":
      return fahrzeug.stretcher;
    default:
      return false;
  }
}

export type SchichtFuerPruefung = {
  vehicleId: string;
  driverId: string;
  start: Date;
  end: Date;
  onBreak: boolean;
  unavailable: boolean;
  /**
   * Besatzung der Schicht (Beifahrer aktiv, Scalamobil, Einweisung des Fahrers). Fehlt sie, gilt
   * vorsichtshalber: Fahrer allein, kein Scalamobil.
   */
  besatzung?: Besatzung;
};

export const BESATZUNG_ALLEIN: Besatzung = { beifahrer: false, scalamobil: false, fahrerEinweisung: false };

/** Gibt die laufende Schicht eines Fahrzeugs zur Abholzeit zurück, sonst undefined. */
export function findeAktiveSchicht(
  schichten: SchichtFuerPruefung[],
  vehicleId: string,
  zeitpunkt: Date,
): SchichtFuerPruefung | undefined {
  return schichten.find(
    (s) =>
      s.vehicleId === vehicleId &&
      !s.onBreak &&
      !s.unavailable &&
      s.start <= zeitpunkt &&
      s.end >= zeitpunkt,
  );
}

/**
 * Wie findeAktiveSchicht, aber nur eine Schicht, deren Besatzung zur Fahrt passt (Liegend mit
 * Beifahrer, Tragestuhl über Treppe zu zweit oder mit Scalamobil). Laufen mehrere Schichten auf dem
 * Fahrzeug, zählt die erste passende.
 */
export function findeEinsatzSchicht(
  schichten: SchichtFuerPruefung[],
  fahrzeug: Pick<FahrzeugFuerPruefung, "id" | "wheelchairSpots" | "carryChair" | "stretcher">,
  zeitpunkt: Date,
  anforderung: FahrtAnforderung,
): SchichtFuerPruefung | undefined {
  return schichten.find(
    (s) =>
      s.vehicleId === fahrzeug.id &&
      !s.onBreak &&
      !s.unavailable &&
      s.start <= zeitpunkt &&
      s.end >= zeitpunkt &&
      besatzungPruefen(anforderung, fahrzeug, s.besatzung ?? BESATZUNG_ALLEIN).passt,
  );
}
