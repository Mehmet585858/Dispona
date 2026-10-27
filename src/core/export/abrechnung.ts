/**
 * Export erledigter Fahrten für die Abrechnung (docs/07-adapter.md "Im Pilot: Export als
 * Datei"). Reine Funktionen: Zeilen aus schon geladenen Daten bauen, Spaltenreihenfolge ist
 * einstellbar (TenantSettings.exportTemplate). Die eigentliche CSV-/Excel-Erzeugung und der
 * Datenbankzugriff liegen in src/app/api/export/abrechnung/route.ts.
 */
import { datumIso } from "@/core/shifts/week";
import { DOC_STATUS_LABEL, TRANSPORT_TYPE_LABEL } from "@/core/rides/validation";
import type { DocStatus, TransportType } from "@/generated/prisma/enums";

export type ExportSpalte =
  | "fahrgastName"
  | "fahrgastGeburtsdatum"
  | "krankenkasse"
  | "datum"
  | "abholzeit"
  | "ankunft"
  | "abholadresse"
  | "zieladresse"
  | "befoerderungsart"
  | "gefahreneKm"
  | "fahrzeug"
  | "fahrer"
  | "transportschein"
  | "genehmigung"
  | "serie"
  | "hinweise";

export const EXPORT_SPALTEN_LABEL: Record<ExportSpalte, string> = {
  fahrgastName: "Fahrgast",
  fahrgastGeburtsdatum: "Geburtsdatum",
  krankenkasse: "Krankenkasse",
  datum: "Datum",
  abholzeit: "Abholzeit",
  ankunft: "Ankunft",
  abholadresse: "Abholadresse",
  zieladresse: "Zieladresse",
  befoerderungsart: "Beförderungsart",
  gefahreneKm: "Gefahrene km",
  fahrzeug: "Fahrzeug",
  fahrer: "Fahrer",
  transportschein: "Transportschein",
  genehmigung: "Genehmigung",
  serie: "Serie",
  hinweise: "Hinweise",
};

export const STANDARD_SPALTENREIHENFOLGE: ExportSpalte[] = [
  "fahrgastName",
  "fahrgastGeburtsdatum",
  "krankenkasse",
  "datum",
  "abholzeit",
  "ankunft",
  "abholadresse",
  "zieladresse",
  "befoerderungsart",
  "gefahreneKm",
  "fahrzeug",
  "fahrer",
  "transportschein",
  "genehmigung",
  "serie",
  "hinweise",
];

/** Bereinigt eine gespeicherte Spaltenvorlage: nur bekannte Spalten, fehlende hinten ergänzt. */
export function spaltenReihenfolgeBereinigen(gespeichert: unknown): ExportSpalte[] {
  const bekannt = new Set<string>(STANDARD_SPALTENREIHENFOLGE);
  const liste = Array.isArray(gespeichert) ? gespeichert.filter((s): s is ExportSpalte => bekannt.has(s as string)) : [];
  const fehlende = STANDARD_SPALTENREIHENFOLGE.filter((s) => !liste.includes(s));
  return [...liste, ...fehlende];
}

export type FahrtFuerExport = {
  passenger: { firstName: string; lastName: string; birthDate: Date | null; insurer: string | null };
  pickupAt: Date;
  completedAt: Date | null;
  pickupPlace: { street: string; zip: string; city: string };
  dropoffPlace: { street: string; zip: string; city: string };
  transportType: TransportType;
  distanceKm: number | null;
  vehiclePlate: string | null;
  fahrerName: string | null;
  prescription: DocStatus;
  approval: DocStatus;
  seriesId: string | null;
  assistanceNotes: string | null;
  problems: string[];
};

function adresseText(ort: { street: string; zip: string; city: string }): string {
  return `${ort.street}, ${ort.zip} ${ort.city}`;
}

function uhrzeit(datum: Date): string {
  return datum.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
}

function zellenwert(spalte: ExportSpalte, fahrt: FahrtFuerExport): string {
  switch (spalte) {
    case "fahrgastName":
      return `${fahrt.passenger.firstName} ${fahrt.passenger.lastName}`;
    case "fahrgastGeburtsdatum":
      return fahrt.passenger.birthDate ? datumIso(fahrt.passenger.birthDate) : "";
    case "krankenkasse":
      return fahrt.passenger.insurer ?? "";
    case "datum":
      return datumIso(fahrt.pickupAt);
    case "abholzeit":
      return uhrzeit(fahrt.pickupAt);
    case "ankunft":
      return fahrt.completedAt ? uhrzeit(fahrt.completedAt) : "";
    case "abholadresse":
      return adresseText(fahrt.pickupPlace);
    case "zieladresse":
      return adresseText(fahrt.dropoffPlace);
    case "befoerderungsart":
      return TRANSPORT_TYPE_LABEL[fahrt.transportType];
    case "gefahreneKm":
      return fahrt.distanceKm !== null ? fahrt.distanceKm.toFixed(1).replace(".", ",") : "";
    case "fahrzeug":
      return fahrt.vehiclePlate ?? "";
    case "fahrer":
      return fahrt.fahrerName ?? "";
    case "transportschein":
      return DOC_STATUS_LABEL[fahrt.prescription];
    case "genehmigung":
      return DOC_STATUS_LABEL[fahrt.approval];
    case "serie":
      return fahrt.seriesId ? "Ja" : "Nein";
    case "hinweise":
      return [fahrt.assistanceNotes, ...fahrt.problems].filter(Boolean).join("; ");
  }
}

export function exportZeilenBauen(
  fahrten: FahrtFuerExport[],
  spalten: ExportSpalte[],
): { kopf: string[]; zeilen: string[][] } {
  return {
    kopf: spalten.map((s) => EXPORT_SPALTEN_LABEL[s]),
    zeilen: fahrten.map((fahrt) => spalten.map((s) => zellenwert(s, fahrt))),
  };
}
