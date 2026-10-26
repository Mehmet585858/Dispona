import type { TransportType } from "@/generated/prisma/enums";

export type FahrzeugFuerPruefung = {
  id: string;
  seats: number;
  wheelchairSpots: number;
  carryChair: boolean;
  stretcher: boolean;
  active: boolean;
};

/** Schritt 1 (docs/05-disposition.md): passt die Ausstattung des Fahrzeugs zur Beförderungsart? */
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
      return fahrzeug.carryChair;
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
};

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
