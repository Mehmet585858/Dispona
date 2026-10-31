/**
 * Eine Fahrt vollständig erfassen: prüfen, anlegen, Status ERFASST, Vorschlag berechnen,
 * optional Rückfahrt. Einziger Weg, eine neue Fahrt anzulegen – genutzt von der
 * Disponenten-Oberfläche (src/app/dispo/fahrten/actions.ts) und von der KI am Telefon
 * (src/app/api/voice/tools/fahrt_anlegen.ts). Framework-unabhängig (docs/09-bauplan.md Phase 6).
 */
import type { RideSource } from "@/generated/prisma/enums";
import { FremdeReferenzError, withTenant, type TenantTx } from "@/lib/db";
import { berlinerMitternacht, datumIso, mitUhrzeit, tagVerschieben } from "@/core/shifts/week";
import { vorschlagBerechnenUndSpeichern } from "@/core/disposition/vorschlagSpeichern";
import { fahrtPruefen, type Problem } from "./pruefungen";
import { fahrtSchema, type FahrtEingabe } from "./validation";
import { fahrtStatusAendern } from "./status";

/**
 * Maßnahme M-07: Platzhalter für eine Rückfahrt ohne genannte Uhrzeit – vier Stunden nach der
 * Abholung der Hinfahrt (typische Dauer Dialyse/Behandlung inkl. Fahrt). Annahme, da docs/05 und
 * docs/DISPO-SPEZ dazu schweigen; die Fahrt trägt RUECKFAHRT_ZEIT_OFFEN und wartet auf das Büro.
 */
export const RUECKFAHRT_PLATZHALTER_MINUTEN = 240;

/**
 * Abholzeit der Rückfahrt (docs/13 R1-3): liegt die genannte Uhrzeit vor der Abholzeit der
 * Hinfahrt (z. B. Hinfahrt 23:30, Rückfahrt 00:15), ist der Folgetag gemeint.
 */
export function rueckfahrtAbholzeit(tag: Date, hinPickupAt: Date, rueckfahrtzeit: string | undefined): { pickupAt: Date; zeitOffen: boolean } {
  if (!rueckfahrtzeit) {
    return { pickupAt: new Date(hinPickupAt.getTime() + RUECKFAHRT_PLATZHALTER_MINUTEN * 60_000), zeitOffen: true };
  }
  const amSelbenTag = mitUhrzeit(tag, rueckfahrtzeit);
  if (amSelbenTag > hinPickupAt) return { pickupAt: amSelbenTag, zeitOffen: false };
  const folgetag = berlinerMitternacht(tagVerschieben(datumIso(tag), 1));
  return { pickupAt: mitUhrzeit(folgetag, rueckfahrtzeit), zeitOffen: false };
}

export type FahrtErfassenOptionen = {
  userId?: string;
  source: RideSource;
  callId?: string;
  seriesId?: string;
};

type Rueckfahrt = { pickupAt: Date; zeitOffen: boolean; hinRideId: string };

async function einzelneFahrtAnlegen(
  tenantId: string,
  db: TenantTx,
  daten: FahrtEingabe,
  tag: Date,
  optionen: FahrtErfassenOptionen,
  // Gesetzt, wenn diese Fahrt die Rückfahrt zu hinRideId ist (Orte vertauscht, eigene Abholzeit).
  rueckfahrt: Rueckfahrt | undefined,
  // Fahrt-ID einer bewusst zusammengehörigen Hin-/Rückfahrt, die von der Doppelbuchungsprüfung
  // ausgenommen wird (docs/13 R1-2): vorher wurde nach dem Zeitwert gefiltert, das blendete auch
  // eine unabhängige echte Fahrt zur exakt selben Uhrzeit aus – DOPPELBUCHUNG blieb dann stumm.
  ignoriereRideId?: string,
): Promise<{ rideId: string; probleme: Problem[] }> {
  const pickupPlaceId = rueckfahrt ? daten.dropoffPlaceId : daten.pickupPlaceId;
  const dropoffPlaceId = rueckfahrt ? daten.pickupPlaceId : daten.dropoffPlaceId;
  const pickupAt = rueckfahrt ? rueckfahrt.pickupAt : mitUhrzeit(tag, daten.abholzeit);
  const appointmentAt = !rueckfahrt && daten.terminzeit ? mitUhrzeit(tag, daten.terminzeit) : undefined;

  const [pickupOrt, dropoffOrt, settings, fahrgast, bestehendeFahrten] = await Promise.all([
    db.place.findUnique({ where: { id: pickupPlaceId } }),
    db.place.findUnique({ where: { id: dropoffPlaceId }, select: { id: true } }),
    db.tenantSettings.findUnique({ where: { tenantId } }),
    db.passenger.findUnique({ where: { id: daten.passengerId }, include: { approvals: true } }),
    db.ride.findMany({
      where: { passengerId: daten.passengerId, status: { notIn: ["STORNIERT"] } },
      select: { id: true, pickupAt: true },
    }),
  ]);
  // Prüfbericht S2-008: "nicht gefunden" heißt fremder Mandant oder gelöscht – nie "keine
  // Zusatzdaten". Ohne diesen Abbruch entstand eine Fahrt mit fremdem Fahrgast/Ort, und die
  // Einsatzgebiets- und Genehmigungsprüfung lief stillschweigend ins Leere.
  if (!fahrgast) throw new FremdeReferenzError("Fahrgast nicht gefunden.");
  if (!pickupOrt || !dropoffOrt) throw new FremdeReferenzError("Ort nicht gefunden.");

  const probleme = fahrtPruefen({
    pickupOrt: { lat: pickupOrt.lat, lng: pickupOrt.lng },
    pickupAt,
    bestehendeAbholzeitenDesFahrgasts: bestehendeFahrten
      .filter((f) => f.id !== ignoriereRideId)
      .map((f) => f.pickupAt),
    approval: daten.approval,
    genehmigungen: fahrgast.approvals,
    serviceAreaCenter: settings?.serviceAreaCenter
      ? (settings.serviceAreaCenter as { lat: number; lng: number })
      : null,
    serviceAreaKm: settings?.serviceAreaKm ?? 30,
    rueckfahrtZeitOffen: rueckfahrt?.zeitOffen ?? false,
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
      returnOfId: rueckfahrt?.hinRideId,
      returnTimeOpen: rueckfahrt?.zeitOffen ?? false,
      status: "ENTWURF",
      problems: probleme,
    },
  });
  await fahrtStatusAendern(tenantId, entwurf.id, "ERFASST", { userId: optionen.userId, tx: db });

  return { rideId: entwurf.id, probleme };
}

/**
 * Vorschlag nach dem Anlegen. Scheitert er (z. B. Routing nicht erreichbar), bleibt die Fahrt
 * ERFASST – ein gültiger Zustand, den das Büro und "Plan für morgen" aufgreifen – statt dass der
 * ganze Aufruf mit einem Fehler endet und die KI womöglich noch einmal anlegt (Maßnahme M-23).
 */
async function vorschlagNachAnlage(tenantId: string, rideId: string, userId?: string): Promise<void> {
  try {
    await vorschlagBerechnenUndSpeichern(tenantId, rideId, userId);
  } catch (fehler) {
    console.error("Vorschlag nach Erfassen fehlgeschlagen", { tenantId, rideId, fehler: fehler instanceof Error ? fehler.name : "unbekannt" });
  }
}

export type FahrtErfassenErgebnis = {
  rideId: string;
  probleme: Problem[];
  rueckfahrtRideId?: string;
  rueckfahrtProbleme?: Problem[];
  /** Maßnahme M-07: Rückfahrt wurde mit Platzhalterzeit angelegt und wartet auf das Büro. */
  rueckfahrtZeitOffen?: boolean;
};

export async function fahrtErfassen(
  tenantId: string,
  eingabe: FahrtEingabe,
  optionen: FahrtErfassenOptionen,
  // Bewusst kein Teil von FahrtEingabe/optionen - nur für Aufrufer gedacht, die eine Hin- und eine
  // zusammengehörige Rückfahrt über ZWEI GETRENNTE fahrtErfassen()-Aufrufe anlegen (anders als der
  // rueckfahrt-Zweig unten, der beide in einem Aufruf anlegt und das selbst übernimmt) - z. B. die
  // Demo-Simulation (src/core/demo/betriebSimulieren.ts), die eine Rückfahrt als eigenen,
  // zeitversetzten simulierten Anruf nachbildet. Übergibt die ID der schon bestehenden,
  // zusammengehörigen Fahrt, damit istDoppelbuchung() sie nicht fälschlich blockiert (R1-2).
  ignoriereDoppelbuchungRideId?: string,
): Promise<FahrtErfassenErgebnis> {
  const daten = fahrtSchema.parse(eingabe);
  const tag = berlinerMitternacht(daten.datum);

  // Maßnahme M-23 Punkt 3 (S4-009): Hin- und Rückfahrt samt Statuswechsel in EINER Transaktion –
  // entweder beide oder keine. Die Vorschlagsrechnung (externe Routing-Aufrufe) läuft danach.
  const { hin, rueck, rueckfahrtZeitOffen } = await withTenant(tenantId).$transaction(async (tx) => {
    const hinFahrt = await einzelneFahrtAnlegen(tenantId, tx, daten, tag, optionen, undefined, ignoriereDoppelbuchungRideId);
    if (!daten.rueckfahrt) return { hin: hinFahrt, rueck: undefined, rueckfahrtZeitOffen: undefined };
    // Maßnahme M-07 (S1-005): Rückfahrt ohne Uhrzeit wurde vorher stillschweigend verworfen – die
    // KI meldete trotzdem "Fahrt erfasst". Jetzt entsteht sie immer; ohne Zeit mit Platzhalter und
    // Problem RUECKFAHRT_ZEIT_OFFEN, über Mitternacht am Folgetag (R1-3). Von der
    // Doppelbuchungsprüfung ausgenommen ist genau die Hinfahrt dieses Aufrufs (R1-2).
    const hinPickupAt = mitUhrzeit(tag, daten.abholzeit);
    const rueckfahrt = rueckfahrtAbholzeit(tag, hinPickupAt, daten.rueckfahrtzeit || undefined);
    const rueckFahrt = await einzelneFahrtAnlegen(
      tenantId,
      tx,
      daten,
      tag,
      optionen,
      { ...rueckfahrt, hinRideId: hinFahrt.rideId },
      hinFahrt.rideId,
    );
    return { hin: hinFahrt, rueck: rueckFahrt, rueckfahrtZeitOffen: rueckfahrt.zeitOffen };
  });

  await vorschlagNachAnlage(tenantId, hin.rideId, optionen.userId);
  if (rueck) {
    await vorschlagNachAnlage(tenantId, rueck.rideId, optionen.userId);
    return { ...hin, rueckfahrtRideId: rueck.rideId, rueckfahrtProbleme: rueck.probleme, rueckfahrtZeitOffen };
  }

  return hin;
}
