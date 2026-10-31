/**
 * Auskunft (Art. 15 DSGVO) und Löschung (Art. 17 DSGVO) eines Fahrgastes
 * (docs/08-datenschutz-sicherheit.md). Löschung anonymisiert statt hart zu löschen: erledigte
 * Fahrten referenzieren den Fahrgast weiter (Ride.passengerId ist nicht optional, u. a. für die
 * Abrechnung), aber nach dem Anonymisieren stecken darin keine personenbezogenen Daten mehr.
 */
import { withTenant } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { zusammenfassungLesbar } from "@/core/notify/anrufZusammenfassung";
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
            zusammenfassung: zusammenfassungLesbar(f.call.summary),
            transkript: f.call.transcript ? decrypt(f.call.transcript) : null,
          }
        : null,
    })),
  };
}

const WOHNORT_ANONYM = "Wohnung (Fahrgast gelöscht)";

/**
 * Prüfbericht S2-016: Die Anonymisierung betrifft nicht nur die Fahrgast-Zeile. Personen- und
 * gesundheitsbezogene Daten stecken auch in Fahrten (Hinweise wie "Sauerstoffgerät"), Anrufen
 * (Zusammenfassung mit Namen, Rückrufnummer, Transkript, Aufnahme), Serienvorlagen,
 * Statusereignissen (GPS des Wohnorts) und im Namen des Wohnorts ("Wohnung <Name>").
 * Bewusst NICHT angefasst (Abrechnung, Aufbewahrungspflicht – siehe Behebungsprotokoll,
 * Rückfrage): Straße/PLZ/Ort/Koordinaten der Orte, Abholzeiten, gefahrene km, Beförderungsart.
 */
export async function fahrgastAnonymisieren(tenantId: string, passengerId: string, userId?: string) {
  const db = withTenant(tenantId);
  const fahrgast = await db.passenger.findUnique({ where: { id: passengerId }, select: { id: true, homePlaceId: true } });
  if (!fahrgast) throw new Error("Fahrgast nicht gefunden.");

  const offeneFahrten = await db.ride.findMany({
    where: { passengerId, status: { in: [...NICHT_BEGONNENE_STATUS] } },
    select: { id: true },
  });
  for (const fahrt of offeneFahrten) {
    await fahrtStornieren(tenantId, fahrt.id, { userId });
  }

  // Alle Fahrten des Fahrgasts (auch erledigte): Hinweise, zugehörige Anrufe, GPS der Ereignisse.
  const alleFahrten = await db.ride.findMany({
    where: { passengerId },
    select: { id: true, callId: true, pickupPlaceId: true, dropoffPlaceId: true },
  });
  const fahrtIds = alleFahrten.map((f) => f.id);
  const callIds = [...new Set(alleFahrten.map((f) => f.callId).filter((id): id is string => id !== null))];
  if (fahrtIds.length > 0) {
    await db.ride.updateMany({ where: { id: { in: fahrtIds } }, data: { assistanceNotes: null } });
    await db.rideStatusEvent.updateMany({ where: { rideId: { in: fahrtIds } }, data: { lat: null, lng: null } });
  }
  if (callIds.length > 0) {
    await db.call.updateMany({
      where: { id: { in: callIds } },
      data: { summary: null, fromNumber: null, transcript: null, audioUrl: null },
    });
  }

  // Serien: beenden und die Vorlage von Hinweisen befreien (Json-Feld, daher je Zeile).
  const serien = await db.rideSeries.findMany({ where: { passengerId }, select: { id: true, template: true } });
  for (const serie of serien) {
    const vorlage = (serie.template ?? {}) as Record<string, unknown>;
    await db.rideSeries.update({
      where: { id: serie.id },
      data: { until: new Date(), template: { ...vorlage, assistanceNotes: "" } },
    });
  }

  // Wohnorte: nur Orte vom Typ WOHNUNG, die kein anderer Fahrgast nutzt – der Name trägt oft
  // den Fahrgastnamen ("Wohnung Müller"). Praxen/Kliniken bleiben unverändert.
  const ortKandidaten = new Set<string>(alleFahrten.flatMap((f) => [f.pickupPlaceId, f.dropoffPlaceId]));
  if (fahrgast.homePlaceId) ortKandidaten.add(fahrgast.homePlaceId);
  for (const ortId of ortKandidaten) {
    const ort = await db.place.findUnique({ where: { id: ortId }, select: { type: true } });
    if (ort?.type !== "WOHNUNG") continue;
    const fremdeNutzung = await db.ride.count({
      where: { passengerId: { not: passengerId }, OR: [{ pickupPlaceId: ortId }, { dropoffPlaceId: ortId }] },
    });
    if (fremdeNutzung > 0) continue;
    await db.place.update({ where: { id: ortId }, data: { label: WOHNORT_ANONYM } });
  }

  await db.approval.deleteMany({ where: { passengerId } });
  await db.passenger.update({
    where: { id: passengerId },
    data: { firstName: "Gelöscht", lastName: "", birthDate: null, phones: [], insurer: null, notes: null, homePlaceId: null },
  });

  return { stornierteFahrten: offeneFahrten.length };
}
