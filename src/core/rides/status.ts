import type { RideStatus } from "@/generated/prisma/enums";
import { withTenant } from "@/lib/db";

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
  UNTERWEGS: ["AN_BORD", "NICHT_ANGETROFFEN", "PROBLEM"],
  AN_BORD: ["ERLEDIGT", "PROBLEM"],
  ERLEDIGT: [],
  NICHT_ANGETROFFEN: ["ERFASST", "STORNIERT"],
  STORNIERT: [],
  PROBLEM: ["ERFASST", "STORNIERT"],
};

export function istUebergangErlaubt(von: RideStatus, nach: RideStatus): boolean {
  if (von === nach) return false;
  return ERLAUBTE_UEBERGAENGE[von].includes(nach);
}

/**
 * Ändert den Status einer Fahrt. Prüft den Übergang, schreibt RideStatusEvent und AuditLog.
 * Einziger erlaubter Weg, Ride.status zu ändern (docs/03-datenmodell.md).
 */
export async function fahrtStatusAendern(
  tenantId: string,
  rideId: string,
  neuerStatus: RideStatus,
  optionen?: { userId?: string; lat?: number; lng?: number },
) {
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({ where: { id: rideId }, select: { status: true } });
  if (!fahrt) {
    throw new Error("Fahrt nicht gefunden.");
  }
  if (!istUebergangErlaubt(fahrt.status, neuerStatus)) {
    throw new Error(`Übergang von ${fahrt.status} nach ${neuerStatus} ist nicht erlaubt.`);
  }

  const aktualisiert = await db.ride.update({
    where: { id: rideId },
    data: {
      status: neuerStatus,
      completedAt: neuerStatus === "ERLEDIGT" ? new Date() : undefined,
    },
  });

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
