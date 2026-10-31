import { z } from "zod";
import type { RideStatus } from "@/generated/prisma/enums";
import { withTenant, type TenantTx } from "@/lib/db";
import { gefahreneKmBerechnen } from "./distanz";

/**
 * Erlaubte Status-Übergänge (docs/03-datenmodell.md):
 * ENTWURF -> ERFASST -> VORGESCHLAGEN -> DISPONIERT -> UNTERWEGS -> AN_BORD -> ERLEDIGT
 * Jederzeit möglich: PROBLEM, STORNIERT (außer aus Endzuständen). NICHT_ANGETROFFEN nach UNTERWEGS.
 * Aus PROBLEM kann der Disponent zu ERFASST zurück, um die Fahrt zu korrigieren.
 */
export const ERLAUBTE_UEBERGAENGE: Record<RideStatus, RideStatus[]> = {
  ENTWURF: ["ERFASST", "STORNIERT"],
  ERFASST: ["VORGESCHLAGEN", "DISPONIERT", "PROBLEM", "STORNIERT"],
  VORGESCHLAGEN: ["DISPONIERT", "ERFASST", "PROBLEM", "STORNIERT"],
  DISPONIERT: ["UNTERWEGS", "ERFASST", "PROBLEM", "STORNIERT"],
  UNTERWEGS: ["AN_BORD", "NICHT_ANGETROFFEN", "PROBLEM", "STORNIERT"],
  AN_BORD: ["ERLEDIGT", "PROBLEM", "STORNIERT"],
  ERLEDIGT: [],
  NICHT_ANGETROFFEN: ["ERFASST", "STORNIERT"],
  STORNIERT: [],
  PROBLEM: ["ERFASST", "STORNIERT"],
};

/**
 * Status, die ein Fahrer selbst setzen darf (docs/06-oberflaeche.md: unterwegs, an Bord, erledigt,
 * nicht angetroffen). Alles andere – insbesondere STORNIERT und ERFASST (zurück in die
 * Warteschlange) – bleibt dem Büro vorbehalten (Maßnahme M-05, docs/13 R3-1, Prüfbericht S4-014).
 * Die Server Action prüft zur Laufzeit gegen dieses Schema, nicht nur per TypeScript-Typ.
 */
export const FAHRER_ERLAUBTE_STATUS = ["UNTERWEGS", "AN_BORD", "ERLEDIGT", "NICHT_ANGETROFFEN"] as const;
export const fahrerStatusSchema = z.enum(FAHRER_ERLAUBTE_STATUS);
export type FahrerStatus = z.infer<typeof fahrerStatusSchema>;

export function istUebergangErlaubt(von: RideStatus, nach: RideStatus): boolean {
  if (von === nach) return false;
  return ERLAUBTE_UEBERGAENGE[von].includes(nach);
}

/** Zeitpunkt, zu dem die Fahrt zuletzt in den Status DISPONIERT gewechselt ist (= letzte Zuweisung), oder null. */
export async function letzteDisponierungAm(tenantId: string, rideId: string): Promise<Date | null> {
  const db = withTenant(tenantId);
  const ereignis = await db.rideStatusEvent.findFirst({
    where: { rideId, status: "DISPONIERT" },
    orderBy: { at: "desc" },
    select: { at: true },
  });
  return ereignis?.at ?? null;
}

/** Minuten seit die Fahrt zuletzt in den Status DISPONIERT gewechselt ist, oder null ohne passendes Ereignis. */
export async function minutenSeitDisponiert(tenantId: string, rideId: string): Promise<number | null> {
  const zeitpunkt = await letzteDisponierungAm(tenantId, rideId);
  if (!zeitpunkt) return null;
  return (Date.now() - zeitpunkt.getTime()) / 60_000;
}

export type StatusWechselOptionen = {
  userId?: string;
  lat?: number;
  lng?: number;
  /**
   * Maßnahme M-04 (R3-2): Schreibt nur, wenn die Fahrt in diesem Moment noch diesem Fahrer gehört
   * ("UPDATE … WHERE id = ? AND status = ? AND driverId = ?"). Die Fahrer-App prüft die
   * Eigentümerschaft damit nicht mehr in einem getrennten Lesezugriff – ein nach der Umbesetzung
   * nachgesendeter Statuswechsel des alten Fahrers trifft keine Zeile mehr.
   */
  erwarteterDriverId?: string;
  /** Läuft der Wechsel innerhalb einer Transaktion (z. B. fahrzeugZuweisen), wird deren Client genutzt. */
  tx?: TenantTx;
};

/**
 * Ändert den Status einer Fahrt. Prüft den Übergang, schreibt RideStatusEvent und AuditLog.
 * Einziger erlaubter Weg, Ride.status zu ändern (docs/03-datenmodell.md).
 */
export async function fahrtStatusAendern(
  tenantId: string,
  rideId: string,
  neuerStatus: RideStatus,
  optionen?: StatusWechselOptionen,
) {
  const db = optionen?.tx ?? withTenant(tenantId);
  const fahrt = await db.ride.findUnique({
    where: { id: rideId },
    select: {
      status: true,
      vehicleId: true,
      pickupPlace: { select: { lat: true, lng: true } },
      dropoffPlace: { select: { lat: true, lng: true } },
    },
  });
  if (!fahrt) {
    throw new Error("Fahrt nicht gefunden.");
  }
  if (!istUebergangErlaubt(fahrt.status, neuerStatus)) {
    throw new Error(`Übergang von ${fahrt.status} nach ${neuerStatus} ist nicht erlaubt.`);
  }

  let distanceKm: number | undefined;
  if (neuerStatus === "ERLEDIGT" && fahrt.vehicleId) {
    const anBordEvent = await db.rideStatusEvent.findFirst({
      where: { rideId, status: "AN_BORD" },
      orderBy: { at: "desc" },
      select: { at: true },
    });
    if (anBordEvent) {
      const punkte = await db.vehicleLocation.findMany({
        where: { vehicleId: fahrt.vehicleId, at: { gte: anBordEvent.at, lte: new Date() } },
        orderBy: { at: "asc" },
        select: { lat: true, lng: true },
      });
      distanceKm = gefahreneKmBerechnen(punkte, fahrt.pickupPlace, fahrt.dropoffPlace);
    }
  }

  // Prüfbericht S2-015: Der alte Status ist Bedingung des Updates ("UPDATE … WHERE status = alt").
  // Zwei gleichzeitige Wechsel (z. B. Offline-Warteschlange sendet "nicht angetroffen" und
  // "an Bord" nach) lesen beide denselben Ausgangsstatus – nur der erste trifft noch eine Zeile,
  // der zweite bekommt count 0 und bricht ab, bevor er Ereignis und AuditLog schreibt.
  const { count } = await db.ride.updateMany({
    where: {
      id: rideId,
      status: fahrt.status,
      ...(optionen?.erwarteterDriverId ? { driverId: optionen.erwarteterDriverId } : {}),
    },
    data: {
      status: neuerStatus,
      completedAt: neuerStatus === "ERLEDIGT" ? new Date() : undefined,
      distanceKm,
    },
  });
  if (count !== 1) {
    throw new Error(
      optionen?.erwarteterDriverId
        ? `Die Fahrt gehört inzwischen nicht mehr zu diesem Fahrer oder ihr Status hat sich geändert (war ${fahrt.status}); Wechsel nach ${neuerStatus} nicht ausgeführt.`
        : `Status der Fahrt hat sich inzwischen geändert (war ${fahrt.status}); Wechsel nach ${neuerStatus} nicht ausgeführt.`,
    );
  }
  const aktualisiert = await db.ride.findUniqueOrThrow({ where: { id: rideId } });

  await db.rideStatusEvent.create({
    data: {
      tenantId,
      rideId,
      status: neuerStatus,
      byUserId: optionen?.userId,
      lat: optionen?.lat,
      lng: optionen?.lng,
    },
  });

  await db.auditLog.create({
    data: {
      tenantId,
      userId: optionen?.userId,
      action: "ride.status_change",
      entity: "Ride",
      entityId: rideId,
    },
  });

  return aktualisiert;
}
