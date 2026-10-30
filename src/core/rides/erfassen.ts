/**
 * Eine Fahrt vollständig erfassen: prüfen, anlegen, Status ERFASST, Vorschlag berechnen,
 * optional Rückfahrt. Einziger Weg, eine neue Fahrt anzulegen – genutzt von der
 * Disponenten-Oberfläche (src/app/dispo/fahrten/actions.ts) und von der KI am Telefon
 * (src/app/api/voice/tools/fahrt_anlegen.ts). Framework-unabhängig (docs/09-bauplan.md Phase 6).
 */
import type { RideSource } from "@/generated/prisma/enums";
import { withTenant } from "@/lib/db";
import { berlinerMitternacht, mitUhrzeit } from "@/core/shifts/week";
import { vorschlagBerechnenUndSpeichern } from "@/core/disposition/vorschlagSpeichern";
import { fahrtPruefen, type Problem } from "./pruefungen";
import { fahrtSchema, type FahrtEingabe } from "./validation";
import { fahrtStatusAendern } from "./status";

export type FahrtErfassenOptionen = {
  userId?: string;
  source: RideSource;
  callId?: string;
  seriesId?: string;
};

async function einzelneFahrtAnlegen(
  tenantId: string,
  daten: FahrtEingabe,
  tag: Date,
  optionen: FahrtErfassenOptionen,
  vertauschePickupDropoff: boolean,
  // Abholzeit einer bewusst zusammengehörigen Hin-/Rückfahrt, die von der Doppelbuchungsprüfung
  // ausgenommen werden soll (siehe fahrtErfassen() unten und die Begründung dort) - istDoppelbuchung()
  // kennt nur Uhrzeiten, keine Routen, kann also nicht selbst erkennen, dass zwei Abholzeiten
  // desselben Fahrgasts innerhalb von 60 Minuten eine gewollte Rückfahrt sind statt ein Fehler.
  ignoriereAbholzeit?: Date,
): Promise<{ rideId: string; probleme: Problem[] }> {
  const db = withTenant(tenantId);
  const pickupPlaceId = vertauschePickupDropoff ? daten.dropoffPlaceId : daten.pickupPlaceId;
  const dropoffPlaceId = vertauschePickupDropoff ? daten.pickupPlaceId : daten.dropoffPlaceId;
  const pickupAt = vertauschePickupDropoff
    ? mitUhrzeit(tag, daten.rueckfahrtzeit!)
    : mitUhrzeit(tag, daten.abholzeit);
  const appointmentAt =
    !vertauschePickupDropoff && daten.terminzeit ? mitUhrzeit(tag, daten.terminzeit) : undefined;

  const [pickupOrt, settings, fahrgast, bestehendeFahrten] = await Promise.all([
    db.place.findUnique({ where: { id: pickupPlaceId } }),
    db.tenantSettings.findUnique({ where: { tenantId } }),
    db.passenger.findUnique({ where: { id: daten.passengerId }, include: { approvals: true } }),
    db.ride.findMany({
      where: { passengerId: daten.passengerId, status: { notIn: ["STORNIERT"] } },
      select: { pickupAt: true },
    }),
  ]);

  const probleme = fahrtPruefen({
    pickupOrt: pickupOrt ? { lat: pickupOrt.lat, lng: pickupOrt.lng } : null,
    pickupAt,
    bestehendeAbholzeitenDesFahrgasts: bestehendeFahrten
      .map((f) => f.pickupAt)
      .filter((zeit) => !ignoriereAbholzeit || zeit.getTime() !== ignoriereAbholzeit.getTime()),
    approval: daten.approval,
    genehmigungen: fahrgast?.approvals ?? [],
    serviceAreaCenter: settings?.serviceAreaCenter
      ? (settings.serviceAreaCenter as { lat: number; lng: number })
      : null,
    serviceAreaKm: settings?.serviceAreaKm ?? 30,
  });

  const entwurf = await db.ride.create({
    data: {
      tenantId,
      passengerId: daten.passengerId,
      pickupPlaceId,
      dropoffPlaceId,
      pickupAt,
      appointmentAt,
      transportType: daten.transportType,
      companion: daten.companion,
      assistanceNotes: daten.assistanceNotes || null,
      prescription: daten.prescription,
      approval: daten.approval,
      source: optionen.source,
      callId: optionen.callId,
      seriesId: optionen.seriesId,
      status: "ENTWURF",
      problems: probleme,
    },
  });
  await fahrtStatusAendern(tenantId, entwurf.id, "ERFASST", { userId: optionen.userId });
  await vorschlagBerechnenUndSpeichern(tenantId, entwurf.id, optionen.userId);

  return { rideId: entwurf.id, probleme };
}

export async function fahrtErfassen(
  tenantId: string,
  eingabe: FahrtEingabe,
  optionen: FahrtErfassenOptionen,
  // Bewusst kein Teil von FahrtEingabe/optionen - nur für Aufrufer gedacht, die eine Hin- und eine
  // zusammengehörige Rückfahrt über ZWEI GETRENNTE fahrtErfassen()-Aufrufe anlegen (anders als der
  // rueckfahrt-Zweig unten, der beide in einem Aufruf anlegt und das selbst übernimmt) - z. B. die
  // Demo-Simulation (src/core/demo/betriebSimulieren.ts), die eine Rückfahrt als eigenen,
  // zeitversetzten simulierten Anruf nachbildet. Übergibt die Abholzeit der schon bestehenden,
  // zusammengehörigen Fahrt, damit istDoppelbuchung() sie nicht fälschlich blockiert.
  ignoriereDoppelbuchungAbholzeit?: Date,
): Promise<{ rideId: string; probleme: Problem[]; rueckfahrtRideId?: string }> {
  const daten = fahrtSchema.parse(eingabe);
  const tag = berlinerMitternacht(daten.datum);

  const hin = await einzelneFahrtAnlegen(tenantId, daten, tag, optionen, false, ignoriereDoppelbuchungAbholzeit);

  if (daten.rueckfahrt && daten.rueckfahrtzeit) {
    const db = withTenant(tenantId);
    // Die Rückfahrt dieses gemeinsamen Aufrufs ist per Definition dieselbe Hinfahrt, deren
    // Abholzeit hier noch mal exakt so berechnet wird wie oben in einzelneFahrtAnlegen() -
    // istDoppelbuchung() darf diese beiden einander bewusst nie als Konflikt werten.
    const hinPickupAt = mitUhrzeit(tag, daten.abholzeit);
    const rueck = await einzelneFahrtAnlegen(tenantId, daten, tag, optionen, true, hinPickupAt);
    await db.ride.update({ where: { id: rueck.rideId }, data: { returnOfId: hin.rideId } });
    return { ...hin, rueckfahrtRideId: rueck.rideId };
  }

  return hin;
}
