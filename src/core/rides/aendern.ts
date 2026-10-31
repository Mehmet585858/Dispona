/**
 * Eine bestehende Fahrt ändern (z. B. am Telefon: andere Uhrzeit, andere Adresse).
 * War die Fahrt schon disponiert, wird sie neu vorgeschlagen und der bisherige Fahrer
 * per Push informiert (docs/04-voice-agent.md, Werkzeug fahrt_aendern).
 */
import { referenzenPruefen, withTenant } from "@/lib/db";
import { berlinerMitternacht, datumIso, mitUhrzeit } from "@/core/shifts/week";
import { pushAnFahrer } from "@/core/notify/push";
import { geaenderteFahrtText } from "@/core/notify/texte";
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

export async function fahrtAendern(
  tenantId: string,
  rideId: string,
  aenderung: FahrtAenderung,
  optionen?: { userId?: string },
): Promise<FahrtAendernErgebnis> {
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({
    where: { id: rideId },
    select: { status: true, pickupAt: true, driverId: true },
  });
  if (!fahrt) return { ok: false, grund: "NICHT_GEFUNDEN" };
  if (NICHT_AENDERBARE_STATUS.has(fahrt.status)) {
    return { ok: false, grund: "NICHT_MEHR_AENDERBAR" };
  }

  // Prüfbericht S2-008: neue Orte müssen diesem Mandanten gehören.
  await referenzenPruefen(tenantId, { place: [aenderung.pickupPlaceId, aenderung.dropoffPlaceId] });

  const tag = berlinerMitternacht(datumIso(fahrt.pickupAt));
  await db.ride.update({
    where: { id: rideId },
    data: {
      pickupAt: aenderung.abholzeit ? mitUhrzeit(tag, aenderung.abholzeit) : undefined,
      appointmentAt: aenderung.terminzeit ? mitUhrzeit(tag, aenderung.terminzeit) : undefined,
      pickupPlaceId: aenderung.pickupPlaceId,
      dropoffPlaceId: aenderung.dropoffPlaceId,
      transportType: aenderung.transportType,
      companion: aenderung.companion,
      assistanceNotes: aenderung.assistanceNotes,
    },
  });

  const warSchonDisponiert = fahrt.status === "DISPONIERT";
  if (warSchonDisponiert && fahrt.driverId) {
    const text = geaenderteFahrtText(
      (aenderung.abholzeit ? mitUhrzeit(tag, aenderung.abholzeit) : fahrt.pickupAt).toLocaleTimeString(
        "de-DE",
        { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" },
      ),
    );
    await pushAnFahrer(tenantId, fahrt.driverId, { title: "Fahrt geändert", body: text, url: "/fahrer" });
    await db.notification.create({
      data: { tenantId, channel: "PUSH", toRef: fahrt.driverId, rideId, kind: "FAHRT_GEAENDERT" },
    });
  }

  if (warSchonDisponiert || fahrt.status === "VORGESCHLAGEN") {
    await fahrtStatusAendern(tenantId, rideId, "ERFASST", { userId: optionen?.userId });
  }
  if (warSchonDisponiert || fahrt.status === "VORGESCHLAGEN" || fahrt.status === "ERFASST") {
    await vorschlagBerechnenUndSpeichern(tenantId, rideId, optionen?.userId);
    return { ok: true, neuVorgeschlagen: true };
  }

  return { ok: true, neuVorgeschlagen: false };
}
