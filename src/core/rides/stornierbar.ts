/**
 * Welche Fahrt darf storniert, welche nur abgebrochen werden (Maßnahme M-19, docs/13 R3-3)? Reines
 * Modul ohne Server-Abhängigkeiten, damit Oberfläche (TripModal) und Fachlogik dieselbe Regel nutzen.
 */
import type { RideStatus } from "@/generated/prisma/enums";

/** Fahrt hat begonnen (Fahrer unterwegs oder Fahrgast an Bord): nur noch "Fahrt abbrechen". */
export const LAUFENDE_STATUS: readonly RideStatus[] = ["UNTERWEGS", "AN_BORD"];

/** Vor der Abholung und noch nicht abgeschlossen: "Stornieren". */
export const STORNIERBARE_STATUS: readonly RideStatus[] = ["ENTWURF", "ERFASST", "VORGESCHLAGEN", "DISPONIERT", "PROBLEM", "NICHT_ANGETROFFEN"];

export function istLaufend(status: string): boolean {
  return (LAUFENDE_STATUS as readonly string[]).includes(status);
}

export function istStornierbar(status: string): boolean {
  return (STORNIERBARE_STATUS as readonly string[]).includes(status);
}
