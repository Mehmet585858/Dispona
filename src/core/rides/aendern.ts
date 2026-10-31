/**
 * Eine bestehende Fahrt ändern (z. B. am Telefon: andere Uhrzeit, andere Adresse).
 * Nach einer planungsrelevanten Änderung wird die Zuweisung gelöst, die Probleme werden neu
 * berechnet und die Fahrt neu vorgeschlagen; der bisherige Fahrer bekommt genau eine passende
 * Meldung (docs/04-voice-agent.md, Werkzeug fahrt_aendern; Maßnahme M-20).
 */
import { referenzenPruefen, withTenant } from "@/lib/db";
import { berlinerMitternacht, datumIso, mitUhrzeit } from "@/core/shifts/week";
import { fahrerNachAenderungBenachrichtigen } from "./fahrerBenachrichtigen";
import { fahrtPruefen, type Problem } from "./pruefungen";
import { vorschlagBerechnenUndSpeichern } from "@/core/disposition/vorschlagSpeichern";
import { fahrtStatusAendern } from "./status";

export type FahrtAenderung = {
  abholzeit?: string; // HH:MM, am bisherigen Fahrttag
  terminzeit?: string;
  pickupPlaceId?: string;
  dropoffPlaceId?: string;
  transportType?: "SITZEND" | "ROLLSTUHL" | "TRAGESTUHL" | "LIEGEND";
  companion?: boolean;
  assistanceNotes?: string;
};

export type FahrtAendernErgebnis =
  | { ok: true; neuVorgeschlagen: boolean }
  | { ok: false; grund: "NICHT_GEFUNDEN" | "NICHT_MEHR_AENDERBAR" };

const NICHT_AENDERBARE_STATUS = new Set([
  "UNTERWEGS",
  "AN_BORD",
  "ERLEDIGT",
  "STORNIERT",
  "NICHT_ANGETROFFEN",
]);

/** Status, aus denen eine Fahrt nach einer planungsrelevanten Änderung neu vorgeschlagen wird. */
const NEU_VORSCHLAGEN_AUS = new Set(["DISPONIERT", "VORGESCHLAGEN", "PROBLEM", "ERFASST"]);

/**
 * Änderungen, nach denen Fahrzeug und Fahrer nicht mehr sicher passen (Zeit, Orte, Transportart,
 * Begleitung) – Maßnahme M-20. Ein neuer Hinweis allein ändert die Planung nicht (Annahme, die
 * Spezifikation schweigt: der Fahrer behält die Fahrt und bekommt "geändert").
 */
function istPlanungsrelevant(aenderung: FahrtAenderung): boolean {
  return (
    aenderung.abholzeit !== undefined ||
    aenderung.terminzeit !== undefined ||
    aenderung.pickupPlaceId !== undefined ||
    aenderung.dropoffPlaceId !== undefined ||
    aenderung.transportType !== undefined ||
    aenderung.companion !== undefined
  );
}

/**
 * Probleme einer bestehenden Fahrt vollständig neu berechnen (Maßnahme M-20, docs/13 R2-6): dieselben
 * Prüfungen wie beim Erfassen. Die Liste wird ersetzt, nicht ergänzt – vorher wuchs sie nur, und
 * Fahrten hingen dauerhaft in "Braucht Sie" mit längst überholtem Grund. Probleme der Fahrzeugsuche
 * (KEIN_FAHRZEUG, "Fahrer fällt aus") entstehen danach in der Vorschlagsrechnung neu, falls nötig.
 */
export async function problemeNeuBerechnen(tenantId: string, rideId: string): Promise<Problem[]> {
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({
    where: { id: rideId },
    include: { pickupPlace: true, passenger: { include: { approvals: true } } },
  });
  if (!fahrt) return [];
  const [settings, andereFahrten] = await Promise.all([
    db.tenantSettings.findUnique({ where: { tenantId } }),
    db.ride.findMany({
      where: {
        passengerId: fahrt.passengerId,
        status: { notIn: ["STORNIERT"] },
        // Die Fahrt selbst und ihr Hin-/Rückfahrt-Gegenstück zählen nicht als Doppelbuchung (R1-2).
        id: { notIn: [rideId, ...(fahrt.returnOfId ? [fahrt.returnOfId] : [])] },
        NOT: { returnOfId: rideId },
      },
      select: { pickupAt: true },
    }),
  ]);
  return fahrtPruefen({
    pickupOrt: { lat: fahrt.pickupPlace.lat, lng: fahrt.pickupPlace.lng },
    pickupAt: fahrt.pickupAt,
    bestehendeAbholzeitenDesFahrgasts: andereFahrten.map((f) => f.pickupAt),
    approval: fahrt.approval,
    genehmigungen: fahrt.passenger.approvals,
    serviceAreaCenter: settings?.serviceAreaCenter ? (settings.serviceAreaCenter as { lat: number; lng: number }) : null,
    serviceAreaKm: settings?.serviceAreaKm ?? 30,
    rueckfahrtZeitOffen: fahrt.returnTimeOpen,
    // Maßnahme M-46 (S1-007): dieselben Zeitprüfungen wie beim Erfassen.
    appointmentAt: fahrt.appointmentAt,
    jetzt: new Date(),
  });
}

export async function fahrtAendern(
  tenantId: string,
  rideId: string,
  aenderung: FahrtAenderung,
  optionen?: {
    userId?: string;
    /** Maßnahme M-20: false, wenn der Aufrufer (z. B. fahrtVerschieben) selbst einmal meldet. */
    benachrichtigen?: boolean;
  },
): Promise<FahrtAendernErgebnis> {
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({
    where: { id: rideId },
    select: { status: true, pickupAt: true, driverId: true, returnTimeOpen: true, problems: true },
  });
  if (!fahrt) return { ok: false, grund: "NICHT_GEFUNDEN" };
  if (NICHT_AENDERBARE_STATUS.has(fahrt.status)) {
    return { ok: false, grund: "NICHT_MEHR_AENDERBAR" };
  }

  // Prüfbericht S2-008: neue Orte müssen diesem Mandanten gehören.
  await referenzenPruefen(tenantId, { place: [aenderung.pickupPlaceId, aenderung.dropoffPlaceId] });

  const neuPlanen = istPlanungsrelevant(aenderung) && NEU_VORSCHLAGEN_AUS.has(fahrt.status);
  const tag = berlinerMitternacht(datumIso(fahrt.pickupAt));
  const neuePickupAt = aenderung.abholzeit ? mitUhrzeit(tag, aenderung.abholzeit) : fahrt.pickupAt;
  await db.ride.update({
    where: { id: rideId },
    data: {
      pickupAt: aenderung.abholzeit ? neuePickupAt : undefined,
      appointmentAt: aenderung.terminzeit ? mitUhrzeit(tag, aenderung.terminzeit) : undefined,
      pickupPlaceId: aenderung.pickupPlaceId,
      dropoffPlaceId: aenderung.dropoffPlaceId,
      transportType: aenderung.transportType,
      companion: aenderung.companion,
      assistanceNotes: aenderung.assistanceNotes,
      // Maßnahme M-07: Sobald das Büro (oder die KI) eine Uhrzeit nennt, ist die Rückfahrt nicht
      // mehr "Zeit offen".
      ...(aenderung.abholzeit && fahrt.returnTimeOpen ? { returnTimeOpen: false } : {}),
      // Maßnahme M-20 (R2-5, S3-004): Fahrzeug und Fahrer passen nach einer Zeit-/Ortsänderung
      // nicht mehr sicher – die Zuweisung wird gelöst (wie fahrzeugZuweisungAufheben), statt dass
      // die Fahrt am alten Wagen klebt und der Konfliktcheck das Fahrzeug für belegt hält.
      ...(neuPlanen ? { vehicleId: null, driverId: null, driverAckAt: null, dispatchMode: null, autoSkipReason: null } : {}),
    },
  });

  if (neuPlanen) {
    // Maßnahme M-20 (R2-6): Probleme neu berechnen statt anhängen.
    await db.ride.update({ where: { id: rideId }, data: { problems: await problemeNeuBerechnen(tenantId, rideId) } });
    if (fahrt.status !== "ERFASST") {
      await fahrtStatusAendern(tenantId, rideId, "ERFASST", { userId: optionen?.userId });
    }
  } else if (aenderung.abholzeit && fahrt.returnTimeOpen) {
    await db.ride.update({
      where: { id: rideId },
      data: { problems: fahrt.problems.filter((p) => p !== "RUECKFAHRT_ZEIT_OFFEN") },
    });
  }

  // Maßnahme M-20 (R2-9, Punkt 5): genau eine passende Meldung – wer die Fahrt verliert, bekommt
  // "entzogen" (vorher irreführend "geändert, App öffnen"), wer sie behält, "geändert".
  if (optionen?.benachrichtigen !== false) {
    await fahrerNachAenderungBenachrichtigen(
      tenantId,
      rideId,
      { driverId: fahrt.driverId, pickupAt: fahrt.pickupAt, status: fahrt.status },
      { driverId: neuPlanen ? null : fahrt.driverId, pickupAt: neuePickupAt, status: neuPlanen ? "ERFASST" : fahrt.status },
      { geaendert: true },
    );
  }

  if (neuPlanen) {
    await vorschlagBerechnenUndSpeichern(tenantId, rideId, optionen?.userId);
    return { ok: true, neuVorgeschlagen: true };
  }
  return { ok: true, neuVorgeschlagen: false };
}
