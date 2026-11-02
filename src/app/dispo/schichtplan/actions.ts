"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBueroSession } from "@/lib/session";
import { istDatumIso } from "@/core/shifts/week";
import { zielTage, type Aenderung } from "@/core/shifts/schichtplan";
import {
  schichtenErsetzen,
  schichtplanDatenLaden,
  wocheKopieren as wocheKopierenKern,
  type SchichtplanErgebnis,
} from "@/core/shifts/schichtplanSpeichern";

const tagIso = z.string().refine(istDatumIso, "Ungültiges Datum");
const entwurfSchema = z.object({
  von: z.string().max(5),
  bis: z.string().max(5),
  fahrerId: z.string().max(64),
  beifahrerId: z.string().max(64).nullable(),
  scalamobil: z.boolean(),
});
const aenderungSchema = z.object({ vehicleId: z.string().min(1).max(64), tagIso, entwuerfe: z.array(entwurfSchema).max(10) });

/** Daten für Monatskalender, „Heute“ und Wochenansicht (Berliner Tage, einschließlich). */
export async function schichtplanLaden(vonIso: string, bisIso: string) {
  const { tenantId } = await requireBueroSession();
  const von = tagIso.parse(vonIso);
  const bis = tagIso.parse(bisIso);
  return schichtplanDatenLaden(tenantId, von, bis);
}

const speichernSchema = z.object({
  vehicleId: z.string().min(1).max(64),
  tagIso,
  giltFuer: z.enum(["TAG", "WOCHE", "WOCHENTAG_MONAT", "WERKTAGE_MONAT"]),
  entwuerfe: z.array(entwurfSchema).max(10),
  bestaetigteFahrten: z.array(z.string().max(64)).max(500).optional(),
});

/**
 * Seitenfenster „Speichern“ bzw. „Löschen“ (keine Entwürfe): ersetzt die Schichten des Fahrzeugs an
 * allen Tagen aus „Gilt für“. Ein Prüffehler bricht ab; liegen Fahrten in wegfallender Zeit, kommt
 * zuerst der Hinweis (nichts geändert).
 */
export async function schichtenSpeichern(eingabe: z.input<typeof speichernSchema>): Promise<SchichtplanErgebnis> {
  const { tenantId, userId } = await requireBueroSession();
  const daten = speichernSchema.parse(eingabe);
  const aenderungen: Aenderung[] = zielTage(daten.tagIso, daten.giltFuer).map((tag) => ({
    vehicleId: daten.vehicleId,
    tagIso: tag,
    entwuerfe: daten.entwuerfe,
  }));
  const ergebnis = await schichtenErsetzen(tenantId, aenderungen, {
    modus: "STRENG",
    bestaetigteFahrten: daten.bestaetigteFahrten,
    userId,
  });
  if (ergebnis.ok) revalidatePath("/dispo");
  return ergebnis;
}

/** „Woche in nächste Woche kopieren“ / „Woche bis Monatsende wiederholen“. */
export async function wocheKopieren(eingabe: {
  quellMontagIso: string;
  ziel: "NAECHSTE_WOCHE" | "BIS_MONATSENDE";
  bestaetigteFahrten?: string[];
}) {
  const { tenantId, userId } = await requireBueroSession();
  const daten = z
    .object({
      quellMontagIso: tagIso,
      ziel: z.enum(["NAECHSTE_WOCHE", "BIS_MONATSENDE"]),
      bestaetigteFahrten: z.array(z.string().max(64)).max(500).optional(),
    })
    .parse(eingabe);
  const ergebnis = await wocheKopierenKern(tenantId, daten.quellMontagIso, daten.ziel, {
    bestaetigteFahrten: daten.bestaetigteFahrten,
    userId,
  });
  if (ergebnis.ok) revalidatePath("/dispo");
  return ergebnis;
}

/**
 * „Rückgängig“: stellt den vorherigen Stand der geänderten Fahrzeug-Tage wieder her. Läuft durch
 * dieselben Prüfungen wie jedes Speichern; liegen inzwischen Fahrten in den Schichten, wird nicht
 * ungefragt freigegeben (Hinweis zurück).
 */
export async function aenderungenZuruecknehmen(vorher: Aenderung[]): Promise<SchichtplanErgebnis> {
  const { tenantId, userId } = await requireBueroSession();
  const aenderungen = z.array(aenderungSchema).max(400).parse(vorher);
  const ergebnis = await schichtenErsetzen(tenantId, aenderungen, { modus: "UEBERSPRINGEN", userId });
  if (ergebnis.ok) revalidatePath("/dispo");
  return ergebnis;
}
