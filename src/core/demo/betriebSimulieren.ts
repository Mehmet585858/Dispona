/**
 * Hält den öffentlichen Demo-Mandanten (src/core/demo/seedDemoTenant.ts) "am Leben": legt in
 * realistischem Tempo neue Fahrten an (wie ein echter Anruf bei der KI), lässt sie über die ganz
 * normale Disposition laufen (Automodus-Cron übernimmt die Zuweisung, siehe
 * src/core/disposition/automatischDisponieren.ts) und schreibt ihren Status automatisch fort
 * (Disponiert -> Unterwegs -> Fahrgast im Auto -> Erledigt), inklusive simulierter GPS-Positionen
 * für den Zeitstrahl und die Karte. Für einen Cron-Job gedacht (jede Minute, wie automodus.ts).
 *
 * Bewusst über die echten, gemeinsamen Bausteine (fahrtErfassen, fahrtStatusAendern) statt eigener
 * Schreiblogik - eine simulierte Fahrt ist dadurch in jeder Hinsicht eine ganz normale Fahrt, nicht
 * clientseitige Deko. Strikt auf DEMO_TENANT_ID beschränkt (dieselbe Konstante wie überall sonst in
 * der Live-Demo), nie auf einen echten Mandanten anwendbar.
 */
import { randomUUID } from "node:crypto";
import { withTenant } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { fahrtErfassen } from "@/core/rides/erfassen";
import { fahrtStatusAendern } from "@/core/rides/status";
import { fahrtDauerMinuten } from "@/core/shifts/dauer";
import { datumIso } from "@/core/shifts/week";
import { TRANSPORT_TYPE_LABEL, type TRANSPORT_TYPES } from "@/core/rides/validation";
import type { RideStatus } from "@/generated/prisma/enums";
import { DEMO_PASSAGIER_ROSTER, DEMO_TENANT_ID } from "./const";

type TransportTyp = (typeof TRANSPORT_TYPES)[number];
type LatLng = { lat: number; lng: number };

const ZIEL_AKTIVE_FAHRTEN = 5;
/** Verhindert, dass bei mehreren aktiven Besuchern gleichzeitig ein Schwall neuer Fahrten
 * entsteht - pro Cron-Minute kommt höchstens mit dieser Wahrscheinlichkeit eine Fahrt dazu,
 * solange ZIEL_AKTIVE_FAHRTEN noch nicht erreicht ist. */
const NEUE_FAHRT_WAHRSCHEINLICHKEIT = 0.5;
/** Angenommene Vorlaufzeit, die ein Fahrzeug losfährt, bevor es am Abholort sein muss - steuert
 * sowohl den Status-Wechsel Disponiert -> Unterwegs als auch die GPS-Interpolation dorthin. */
const ANFAHRT_MINUTEN = 12;
/** Simulierte Gesprächsdauer, bevor ein Anruf nicht mehr als "läuft gerade" gilt (AnrufKarte). */
const ANRUF_DAUER_SEKUNDEN = 100;

const AKTIVE_STATUS: RideStatus[] = ["ERFASST", "VORGESCHLAGEN", "DISPONIERT", "UNTERWEGS", "AN_BORD"];

const TRANSPORT_GEWICHTE: [TransportTyp, number][] = [
  ["SITZEND", 55],
  ["ROLLSTUHL", 25],
  ["TRAGESTUHL", 10],
  ["LIEGEND", 10],
];

function zufaelligerTransportTyp(): TransportTyp {
  const summe = TRANSPORT_GEWICHTE.reduce((s, [, g]) => s + g, 0);
  let r = Math.random() * summe;
  for (const [typ, gewicht] of TRANSPORT_GEWICHTE) {
    if (r < gewicht) return typ;
    r -= gewicht;
  }
  return "SITZEND";
}

function zufallsElement<T>(liste: T[]): T {
  return liste[Math.floor(Math.random() * liste.length)];
}

function uhrzeitHHMM(datum: Date): string {
  return datum.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function interpolieren(von: LatLng, bis: LatLng, anteil: number): LatLng {
  return { lat: von.lat + (bis.lat - von.lat) * anteil, lng: von.lng + (bis.lng - von.lng) * anteil };
}

type AnrufVorlage = (angaben: {
  name: string;
  nachname: string;
  pickupLabel: string;
  dropoffLabel: string;
  transportLabel: string;
  zeit: string;
}) => string;

// Drei unterschiedlich eingeleitete Gespräche (Neubuchung, Abholung/Rückfahrt, Angehöriger ruft
// an) statt eines einzigen immer gleichen Musters - reine Vorlagen, mit echten, zur jeweiligen
// Fahrt passenden Werten befüllt.
const ANRUF_VORLAGEN: AnrufVorlage[] = [
  ({ name, nachname, pickupLabel, dropoffLabel, transportLabel, zeit }) =>
    [
      `${name}: Guten Tag, ich brauche eine Fahrt von ${pickupLabel} nach ${dropoffLabel}.`,
      `Lisa: Mache ich gerne. Wie ist Ihr Name?`,
      `${name}: ${name}.`,
      `Lisa: ${transportLabel === "Sitzend" ? "Sitzend, oder brauchen Sie Hilfe beim Einsteigen?" : `Mit ${transportLabel}, richtig?`}`,
      `${nachname}: Ja, genau.`,
      `Lisa: Wann soll es losgehen?`,
      `${nachname}: So bald wie möglich, bitte.`,
      `Lisa: Von ${pickupLabel} nach ${dropoffLabel}, ${transportLabel}, um ${zeit} Uhr. Passt das?`,
      `${nachname}: Ja, passt.`,
      `Lisa: Die Fahrt ist für ${zeit} Uhr eingeplant. Vielen Dank, ${nachname}.`,
    ].join("\n"),
  ({ name, nachname, pickupLabel, dropoffLabel, transportLabel, zeit }) =>
    [
      `${name}: Hallo, hier ist ${name}. Ich möchte von ${pickupLabel} wieder abgeholt werden.`,
      `Lisa: Hallo ${nachname}. Also nach ${dropoffLabel}, richtig?`,
      `${nachname}: Genau.`,
      `Lisa: ${transportLabel} wie immer?`,
      `${nachname}: Ja.`,
      `Lisa: Wann sind Sie fertig?`,
      `${nachname}: In etwa einer halben Stunde.`,
      `Lisa: Um ${zeit} Uhr von ${pickupLabel} nach ${dropoffLabel}, ${transportLabel}. Passt das?`,
      `${nachname}: Ja, passt.`,
      `Lisa: Ein Fahrer ist für ${zeit} Uhr eingeplant. Bis gleich, ${nachname}.`,
    ].join("\n"),
  ({ name, nachname, pickupLabel, dropoffLabel, transportLabel, zeit }) =>
    [
      `Anrufer: Ich rufe für meine Mutter an, sie braucht eine Fahrt von ${pickupLabel} nach ${dropoffLabel}.`,
      `Lisa: Das bekommen wir hin. Wie heißt Ihre Mutter?`,
      `Anrufer: ${name}.`,
      `Lisa: ${transportLabel === "Sitzend" ? "Kann sie laufen, oder braucht sie Hilfe?" : `Mit ${transportLabel}, nehme ich an?`}`,
      `Anrufer: Ja, genau.`,
      `Lisa: Wann soll es losgehen?`,
      `Anrufer: Heute, so bald wie möglich.`,
      `Lisa: Von ${pickupLabel} nach ${dropoffLabel}, ${transportLabel}, um ${zeit} Uhr, für ${nachname}. Passt das?`,
      `Anrufer: Ja, passt.`,
      `Lisa: Die Fahrt ist für ${zeit} Uhr eingeplant. Gute Besserung für Ihre Mutter.`,
    ].join("\n"),
];

/** Fallback-Standplätze, falls ein Fahrzeug noch nie eine GPS-Zeile hatte (frisch angelegt) -
 * über Berlin verteilt, dieselben Gegenden wie die Wohnadressen in seedDemoTenant.ts. */
const STANDPLAETZE: LatLng[] = [
  { lat: 52.5283, lng: 13.3959 }, // Mitte (Betriebshof)
  { lat: 52.5476, lng: 13.4126 }, // Prenzlauer Berg
  { lat: 52.5058, lng: 13.3192 }, // Charlottenburg
  { lat: 52.4817, lng: 13.4357 }, // Neukölln
  { lat: 52.5355, lng: 13.2007 }, // Spandau
  { lat: 52.4559, lng: 13.5752 }, // Köpenick
  { lat: 52.5698, lng: 13.3496 }, // Reinickendorf
  { lat: 52.5386, lng: 13.4172 }, // Prenzlauer Berg (Kollwitzplatz)
  { lat: 52.5253, lng: 13.3773 }, // Mitte (Charité)
  { lat: 52.5035, lng: 13.329 }, // Charlottenburg (Ku'damm)
];

export async function demoBetriebSimulieren(tenantId: string = DEMO_TENANT_ID) {
  const jetzt = new Date();

  await alteAnrufeAbschliessen(tenantId, jetzt);
  await neuenAnrufBeiBedarf(tenantId, jetzt);
  await statusFortschreiben(tenantId, jetzt);
  await positionenAktualisieren(tenantId, jetzt);
}

async function alteAnrufeAbschliessen(tenantId: string, jetzt: Date) {
  const db = withTenant(tenantId);
  const laufend = await db.call.findMany({
    where: { durationSec: null, startedAt: { lte: new Date(jetzt.getTime() - ANRUF_DAUER_SEKUNDEN * 1000) } },
    select: { id: true, startedAt: true },
  });
  for (const anruf of laufend) {
    await db.call.update({
      where: { id: anruf.id },
      data: { durationSec: Math.round((jetzt.getTime() - anruf.startedAt.getTime()) / 1000) },
    });
  }
}

async function neuenAnrufBeiBedarf(tenantId: string, jetzt: Date) {
  const db = withTenant(tenantId);
  const aktiveAnzahl = await db.ride.count({ where: { status: { in: AKTIVE_STATUS } } });
  if (aktiveAnzahl >= ZIEL_AKTIVE_FAHRTEN) return;
  if (Math.random() > NEUE_FAHRT_WAHRSCHEINLICHKEIT) return;

  const [passagiereRoh, orte, telefon] = await Promise.all([
    db.passenger.findMany(),
    db.place.findMany(),
    db.phoneNumber.findFirst(),
  ]);
  // demoZuruecksetzen.ts löscht einen Fahrgast, sobald er keine Fahrt mehr hat (Privatsphäre für
  // echte Anrufer über die echte Telefonnummer) - trifft mit der Zeit auch den festen,
  // erfundenen Stamm hier. Fehlende Namen werden deshalb bei Bedarf selbst nachgelegt, statt von
  // einem erneuten seedDemoTenant()-Lauf abzuhängen.
  const fehlend = DEMO_PASSAGIER_ROSTER.filter(
    (p) => !passagiereRoh.some((v) => v.firstName === p.firstName && v.lastName === p.lastName),
  );
  for (const daten of fehlend) {
    await db.passenger.create({ data: { tenantId, phones: [], ...daten } });
  }
  const passagiere = fehlend.length > 0 ? await db.passenger.findMany() : passagiereRoh;

  const wohnorte = orte.filter((o) => o.type === "WOHNUNG");
  const einrichtungen = orte.filter((o) => o.type !== "WOHNUNG" && o.type !== "SONSTIGES");
  if (passagiere.length === 0 || wohnorte.length === 0 || einrichtungen.length === 0) return;

  const passagier = zufallsElement(passagiere);
  const wohnort = zufallsElement(wohnorte);
  const einrichtung = zufallsElement(einrichtungen);
  const richtungZurEinrichtung = Math.random() < 0.6; // häufiger hin als zurück
  const pickupPlace = richtungZurEinrichtung ? wohnort : einrichtung;
  const dropoffPlace = richtungZurEinrichtung ? einrichtung : wohnort;

  const transportType = zufaelligerTransportTyp();
  const pickupInMinuten = 10 + Math.floor(Math.random() * 70); // 10-80 Minuten voraus - wirkt dringend, aber plausibel
  const pickupAt = new Date(jetzt.getTime() + pickupInMinuten * 60_000);
  const zeit = uhrzeitHHMM(pickupAt);
  const name = `${passagier.firstName} ${passagier.lastName}`;

  const transkript = zufallsElement(ANRUF_VORLAGEN)({
    name,
    nachname: passagier.lastName,
    pickupLabel: pickupPlace.label,
    dropoffLabel: dropoffPlace.label,
    transportLabel: TRANSPORT_TYPE_LABEL[transportType],
    zeit,
  });

  const call = await db.call.create({
    data: {
      tenantId,
      providerCallId: `demo-${randomUUID()}`,
      toNumber: telefon?.e164 ?? "demo",
      startedAt: jetzt,
      transcript: encrypt(transkript),
    },
    select: { id: true },
  });

  await fahrtErfassen(
    tenantId,
    {
      passengerId: passagier.id,
      pickupPlaceId: pickupPlace.id,
      dropoffPlaceId: dropoffPlace.id,
      datum: datumIso(pickupAt),
      abholzeit: zeit,
      terminzeit: undefined,
      rueckfahrt: false,
      rueckfahrtzeit: undefined,
      transportType,
      companion: false,
      assistanceNotes: undefined,
      prescription: "NICHT_NOETIG",
      approval: "NICHT_NOETIG",
    },
    { source: "ANRUF", callId: call.id },
  );
}

async function statusFortschreiben(tenantId: string, jetzt: Date) {
  const db = withTenant(tenantId);
  const kandidaten = await db.ride.findMany({
    where: { status: { in: ["DISPONIERT", "UNTERWEGS", "AN_BORD"] } },
    include: { pickupPlace: true, dropoffPlace: true },
  });
  for (const fahrt of kandidaten) {
    if (fahrt.status === "DISPONIERT") {
      if (jetzt.getTime() >= fahrt.pickupAt.getTime() - ANFAHRT_MINUTEN * 60_000) {
        await fahrtStatusAendern(tenantId, fahrt.id, "UNTERWEGS");
      }
    } else if (fahrt.status === "UNTERWEGS") {
      if (jetzt.getTime() >= fahrt.pickupAt.getTime()) {
        await fahrtStatusAendern(tenantId, fahrt.id, "AN_BORD");
      }
    } else if (fahrt.status === "AN_BORD") {
      const dauerMinuten = fahrtDauerMinuten(fahrt.transportType, fahrt.pickupPlace, fahrt.dropoffPlace);
      const ende = new Date(fahrt.pickupAt.getTime() + dauerMinuten * 60_000);
      if (jetzt.getTime() >= ende.getTime()) {
        await fahrtStatusAendern(tenantId, fahrt.id, "ERLEDIGT");
      }
    }
  }
}

async function positionenAktualisieren(tenantId: string, jetzt: Date) {
  const db = withTenant(tenantId);
  const [fahrzeuge, aktiveFahrten] = await Promise.all([
    db.vehicle.findMany({ where: { active: true } }),
    db.ride.findMany({
      where: { status: { in: ["DISPONIERT", "UNTERWEGS", "AN_BORD"] }, vehicleId: { not: null } },
      include: { pickupPlace: true, dropoffPlace: true },
    }),
  ]);
  const fahrtJeFahrzeug = new Map(aktiveFahrten.map((f) => [f.vehicleId, f]));

  for (const [index, fahrzeug] of fahrzeuge.entries()) {
    const fahrt = fahrtJeFahrzeug.get(fahrzeug.id);

    let position: LatLng | null = null;
    if (fahrt && fahrt.status === "UNTERWEGS") {
      const start = new Date(fahrt.pickupAt.getTime() - ANFAHRT_MINUTEN * 60_000);
      const anteil = clamp01((jetzt.getTime() - start.getTime()) / (ANFAHRT_MINUTEN * 60_000));
      const letzte = await letztePosition(db, fahrzeug.id);
      position = interpolieren(letzte ?? fahrt.pickupPlace, fahrt.pickupPlace, anteil);
    } else if (fahrt && fahrt.status === "AN_BORD") {
      const dauerMinuten = fahrtDauerMinuten(fahrt.transportType, fahrt.pickupPlace, fahrt.dropoffPlace);
      const anteil = clamp01((jetzt.getTime() - fahrt.pickupAt.getTime()) / (dauerMinuten * 60_000));
      position = interpolieren(fahrt.pickupPlace, fahrt.dropoffPlace, anteil);
    } else {
      // Kein aktiver Auftrag (frei oder disponiert, aber noch nicht losgefahren) - steht an seiner
      // letzten Position, braucht also nur dann eine neue Zeile, wenn es noch nie eine GPS-Zeile
      // gab (frisch angelegtes Fahrzeug).
      const letzte = await letztePosition(db, fahrzeug.id);
      if (letzte) continue;
      position = STANDPLAETZE[index % STANDPLAETZE.length];
    }

    if (position) {
      await db.vehicleLocation.create({
        data: { tenantId, vehicleId: fahrzeug.id, lat: position.lat, lng: position.lng },
      });
    }
  }
}

async function letztePosition(db: ReturnType<typeof withTenant>, vehicleId: string): Promise<LatLng | null> {
  const zeile = await db.vehicleLocation.findFirst({ where: { vehicleId }, orderBy: { at: "desc" } });
  return zeile ? { lat: zeile.lat, lng: zeile.lng } : null;
}
