/**
 * Kleine Anzeige-Helfer des Schichtplans (ohne React, ohne Datenbank). Alle Datumsangaben sind
 * Berliner Kalendertage "JJJJ-MM-TT"; Rechnen nur über src/core/shifts/week.ts.
 */
import { besatzungVonPlanSchicht, type PlanPerson } from "@/core/shifts/schichtplan";
import { besatzungsEtiketten, type BesatzungsEtikett } from "@/core/shifts/besatzung";
import { datumIso, monatsTageIso, tagVerschieben, uhrzeitBerlin } from "@/core/shifts/week";
import type { SchichtplanDaten } from "@/core/shifts/schichtplanSpeichern";

export type Daten = SchichtplanDaten;
export type Schicht = Daten["schichten"][number];
export type Fahrzeug = Daten["fahrzeuge"][number];
export type Person = Daten["personal"][number];

export const MONATE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

export function monatName(monat: string): string {
  return `${MONATE[Number(monat.slice(5, 7)) - 1]} ${monat.slice(0, 4)}`;
}

export function monatVerschieben(monat: string, versatz: number): string {
  const [jahr, m] = monat.split("-").map(Number);
  const index = jahr * 12 + (m - 1) + versatz;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Zu ladender Zeitraum: Woche und Monat, mit einem Tag Rand vorn (Nachtschicht vom Vortag). */
export function ladeBereich(montagIso: string, monat: string): { vonIso: string; bisIso: string } {
  const monatsTage = monatsTageIso(`${monat}-01`);
  const von = [montagIso, monatsTage[0]].sort()[0];
  const bis = [tagVerschieben(montagIso, 6), monatsTage[monatsTage.length - 1]].sort()[1];
  return { vonIso: tagVerschieben(von, -1), bisIso: bis };
}

export function personenMap(personal: Person[]): Map<string, PlanPerson> {
  return new Map(personal.map((p) => [p.id, { id: p.id, name: p.name, active: p.active, scalamobilEinweisung: p.scalamobilEinweisung }]));
}

export function schichtenAm(schichten: Schicht[], vehicleId: string, tagIso: string): Schicht[] {
  return schichten.filter((s) => s.vehicleId === vehicleId && s.tagIso === tagIso).sort((a, b) => +new Date(a.start) - +new Date(b.start));
}

export function zeitText(s: { start: Date; end: Date }): { von: string; bis: string; folgetag: boolean } {
  const start = new Date(s.start);
  const end = new Date(s.end);
  return { von: uhrzeitBerlin(start), bis: uhrzeitBerlin(end), folgetag: datumIso(end) !== datumIso(start) };
}

export function etikettenFuer(fahrzeug: Fahrzeug, s: Schicht, personen: Map<string, PlanPerson>): BesatzungsEtikett[] {
  return besatzungsEtiketten(fahrzeug, besatzungVonPlanSchicht(s, personen));
}
