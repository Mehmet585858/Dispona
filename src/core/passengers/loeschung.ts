/**
 * Auskunft (Art. 15 DSGVO) und Löschung (Art. 17 DSGVO) eines Fahrgastes
 * (docs/08-datenschutz-sicherheit.md). Löschung anonymisiert statt hart zu löschen: erledigte
 * Fahrten referenzieren den Fahrgast weiter (Ride.passengerId ist nicht optional, u. a. für die
 * Abrechnung), aber nach dem Anonymisieren stecken darin keine personenbezogenen Daten mehr.
 */
import { withTenant } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { fahrtStornieren } from "@/core/rides/stornieren";

const NICHT_BEGONNENE_STATUS = ["ENTWURF", "ERFASST", "VORGESCHLAGEN", "DISPONIERT"] as const;

export async function fahrgastExportieren(tenantId: string, passengerId: string) {
  const db = withTenant(tenantId);
  const fahrgast = await db.passenger.findUnique({
    where: { id: passengerId },
    include: {
      approvals: true,
      rides: {
        include: {
          pickupPlace: { select: { label: true, street: true, zip: true, city: true } },
          dropoffPlace: { select: { label: true, street: true, zip: true, city: true } },
          call: { select: { id: true, startedAt: true, transcript: true, summary: true } },
        },
        orderBy: { pickupAt: "asc" },
      },
    },
  });
  if (!fahrgast) throw new Error("Fahrgast nicht gefunden.");

  return {
    fahrgast: {
      id: fahrgast.id,
      firstName: fahrgast.firstName,
      lastName: fahrgast.lastName,
      birthDate: fahrgast.birthDate,
      phones: fahrgast.phones,
      insurer: fahrgast.insurer,
      notes: fahrgast.notes,
    },
    genehmigungen: fahrgast.approvals,
    fahrten: fahrgast.rides.map((f) => ({
      id: f.id,
      datum: f.pickupAt,
      termin: f.appointmentAt,
      status: f.status,
      von: f.pickupPlace,
      nach: f.dropoffPlace,
      beförderungsart: f.transportType,
      gefahreneKm: f.distanceKm,
      anruf: f.call
        ? {
            id: f.call.id,
            datum: f.call.startedAt,
            zusammenfassung: f.call.summary,
            transkript: f.call.transcript ? decrypt(f.call.transcript) : null,
          }
        : null,
    })),
  };
}

export async function fahrgastAnonymisieren(tenantId: string, passengerId: string, userId?: string) {
  const db = withTenant(tenantId);
  const fahrgast = await db.passenger.findUnique({ where: { id: passengerId }, select: { id: true } });
  if (!fahrgast) throw new Error("Fahrgast nicht gefunden.");

  const offeneFahrten = await db.ride.findMany({
    where: { passengerId, status: { in: [...NICHT_BEGONNENE_STATUS] } },
    select: { id: true },
  });
  for (const fahrt of offeneFahrten) {
    await fahrtStornieren(tenantId, fahrt.id, { userId });
  }

  await db.rideSeries.updateMany({ where: { passengerId }, data: { until: new Date() } });
  await db.approval.deleteMany({ where: { passengerId } });
  await db.passenger.update({
    where: { id: passengerId },
    data: { firstName: "Gelöscht", lastName: "", birthDate: null, phones: [], insurer: null, notes: null, homePlaceId: null },
  });

  return { stornierteFahrten: offeneFahrten.length };
}
