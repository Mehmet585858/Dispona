/**
 * „Mein Schichtplan“ in der Fahrer-App (Schichtplan, 02.11.2026): die eigenen Schichten der nächsten
 * 4 Wochen – als Fahrer ODER als Beifahrer – mit Datum, Zeit, Fahrzeug, Kollegin/Kollege und
 * Scalamobil. Nur lesen. Keine Fahrgastdaten; Fahrten bleiben beim Fahrer, Beifahrer sehen keine.
 */
import { withTenant } from "@/lib/db";
import { schichtTag, tagLabel } from "./schichtplan";
import { datumIso, uhrzeitBerlin } from "./week";

export const MEIN_SCHICHTPLAN_TAGE = 28;

export type MeineSchicht = {
  id: string;
  tagIso: string;
  tag: string;
  von: string;
  bis: string;
  folgetag: boolean;
  plate: string;
  rolle: "FAHRER" | "BEIFAHRER";
  /** Die andere Person in der Schicht (Beifahrer bzw. Fahrer), sonst null. */
  kollege: string | null;
  scalamobil: boolean;
  /** Fahrer hat „Ich falle aus“ gemeldet. */
  faelltAus: boolean;
};

type Roh = {
  id: string;
  start: Date;
  end: Date;
  driverId: string;
  scalamobil: boolean;
  unavailable: boolean;
  vehicle: { plate: string };
  driver: { user: { name: string } };
  beifahrer: { user: { name: string } } | null;
};

/** Reine Umformung (testbar ohne Datenbank). */
export function meineSchichtenAufbereiten(schichten: Roh[], personId: string): MeineSchicht[] {
  return [...schichten]
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((s) => {
      const alsFahrer = s.driverId === personId;
      const tagIso = schichtTag(s);
      return {
        id: s.id,
        tagIso,
        tag: tagLabel(tagIso),
        von: uhrzeitBerlin(s.start),
        bis: uhrzeitBerlin(s.end),
        folgetag: datumIso(s.end) !== tagIso,
        plate: s.vehicle.plate,
        rolle: alsFahrer ? "FAHRER" : "BEIFAHRER",
        kollege: alsFahrer ? (s.beifahrer?.user.name ?? null) : s.driver.user.name,
        scalamobil: s.scalamobil,
        faelltAus: s.unavailable,
      };
    });
}

/** Eigene Schichten ab jetzt (laufende eingeschlossen) bis `tage` Tage voraus. */
export async function meineSchichtenLaden(tenantId: string, personId: string, jetzt = new Date(), tage = MEIN_SCHICHTPLAN_TAGE) {
  const bis = new Date(jetzt.getTime() + tage * 24 * 60 * 60_000);
  const schichten = await withTenant(tenantId).shift.findMany({
    where: { OR: [{ driverId: personId }, { beifahrerId: personId }], end: { gt: jetzt }, start: { lt: bis } },
    select: {
      id: true,
      start: true,
      end: true,
      driverId: true,
      scalamobil: true,
      unavailable: true,
      vehicle: { select: { plate: true } },
      driver: { select: { user: { select: { name: true } } } },
      beifahrer: { select: { user: { select: { name: true } } } },
    },
    orderBy: { start: "asc" },
  });
  return meineSchichtenAufbereiten(schichten, personId);
}
