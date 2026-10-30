import type { TransportType } from "@/generated/prisma/enums";

export type FahrzeugAusstattung = { stretcher: boolean; carryChair: boolean; wheelchairSpots: number };

/** Höchste Fähigkeit zuerst (core/disposition/kandidaten.ts kennt dieselbe Reihenfolge). Branchen-
 * übliche Kürzel aus dem Krankentransport statt generischer Beschreibung: BTW =
 * Behindertentransportwagen, LMW = Liegend-Mietwagen. */
export function fahrzeugTypLabel(fahrzeug: FahrzeugAusstattung): string {
  if (fahrzeug.stretcher) return "LMW";
  if (fahrzeug.carryChair) return "Tragestuhl";
  if (fahrzeug.wheelchairSpots > 0) return "BTW";
  return "Taxi";
}

/** Die Beförderungsart, die zum Haupttyp des Fahrzeugs passt - für realistische Testfahrten
 * (src/core/demo/betriebSimulieren.ts), die wirklich zum jeweiligen Fahrzeug passen sollen. */
export function fahrzeugTypTransportType(fahrzeug: FahrzeugAusstattung): TransportType {
  if (fahrzeug.stretcher) return "LIEGEND";
  if (fahrzeug.carryChair) return "TRAGESTUHL";
  if (fahrzeug.wheelchairSpots > 0) return "ROLLSTUHL";
  return "SITZEND";
}
