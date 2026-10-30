/**
 * Hält den öffentlichen Demo-Mandanten (src/core/demo/seedDemoTenant.ts) "am Leben": legt in
 * realistischem Tempo neue Fahrten an (wie ein echter Anruf bei der KI), sorgt dafür, dass der Tag
 * nie leer wirkt (jedes Fahrzeug hat ein paar Fahrten heute, sechs Fahrzeuge einen vollen Tagesplan
 * bis 18 Uhr), schreibt den Status fälliger Fahrten automatisch fort (Disponiert -> Unterwegs ->
 * Fahrgast im Auto -> Erledigt), inklusive simulierter GPS-Positionen für den Zeitstrahl und die
 * Karte, und räumt Fahrten auf, die ohne echten Disponenten als "Braucht Sie" hängen bleiben
 * würden. Für einen Cron-Job gedacht (jede Minute, wie automodus.ts).
 *
 * Zuweisung: spontane Anrufe (neuenAnrufBeiBedarf) lässt bewusst den Automodus-Cron frei
 * entscheiden (realistisch - irgendein passendes Fahrzeug); Tagesplan-Fahrten
 * (tagesplanSicherstellen) weist direkt dem dafür vorgesehenen, schon überschneidungsfrei
 * geprüften Fahrzeug zu, damit viele gleichzeitig geplante Fahrten sich nicht gegenseitig beim
 * Automodus ins Gehege kommen.
 *
 * Bewusst über die echten, gemeinsamen Bausteine (fahrtErfassen, fahrzeugZuweisen,
 * fahrtStatusAendern) statt eigener Schreiblogik - eine simulierte Fahrt ist dadurch in jeder
 * Hinsicht eine ganz normale Fahrt, nicht clientseitige Deko. Strikt auf DEMO_TENANT_ID beschränkt
 * (dieselbe Konstante wie überall sonst in der Live-Demo), nie auf einen echten Mandanten
 * anwendbar.
 */
import { randomUUID } from "node:crypto";
import { withTenant } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { fahrtErfassen } from "@/core/rides/erfassen";
import { fahrtStatusAendern } from "@/core/rides/status";
import { fahrzeugZuweisen, FahrzeugKonfliktError } from "@/core/disposition/zuweisen";
import { fahrzeugTypLabel, fahrzeugTypTransportType } from "@/core/rides/fahrzeugTyp";
import { fahrtDauerMinuten } from "@/core/shifts/dauer";
import { datumIso, mitUhrzeit } from "@/core/shifts/week";
import { TRANSPORT_TYPE_LABEL, type TRANSPORT_TYPES } from "@/core/rides/validation";
import type { RideStatus } from "@/generated/prisma/enums";
import { DEMO_PASSAGIER_ROSTER, DEMO_TENANT_ID } from "./const";

type TransportTyp = (typeof TRANSPORT_TYPES)[number];
type LatLng = { lat: number; lng: number };
type Ort = { id: string; label: string; lat: number; lng: number; type: string };
type Passagier = { id: string; firstName: string; lastName: string };

const ZIEL_AKTIVE_FAHRTEN = 5;
/** Verhindert, dass bei mehreren aktiven Besuchern gleichzeitig ein Schwall neuer Fahrten
 * entsteht - pro Cron-Minute kommt höchstens mit dieser Wahrscheinlichkeit eine Fahrt dazu,
 * solange ZIEL_AKTIVE_FAHRTEN noch nicht erreicht ist. */
const NEUE_FAHRT_WAHRSCHEINLICHKEIT = 0.5;
/** Wie lange eine Fahrt unbestätigt als Vorschlag (oder ohne Fahrzeug) herumstehen darf, bevor sie
 * als nicht mehr vermittelbar storniert wird - ohne echten Disponenten, der "Braucht Sie" abarbeitet,
 * würde die Liste sonst unbegrenzt wachsen (siehe haengendeVorschlaegeAufraeumen). */
const BRAUCHT_SIE_GEDULD_MINUTEN = 20;
/** Angenommene Vorlaufzeit, die ein Fahrzeug losfährt, bevor es am Abholort sein muss - steuert
 * sowohl den Status-Wechsel Disponiert -> Unterwegs als auch die GPS-Interpolation dorthin. */
const ANFAHRT_MINUTEN = 12;
/** Simulierte Gesprächsdauer, bevor ein Anruf nicht mehr als "läuft gerade" gilt (AnrufKarte) -
 * großzügig bemessen, damit bei mehreren Anrufen kurz hintereinander auch wirklich mehrere
 * gleichzeitig als "live" zu sehen sind (AnrufKarussell). */
const ANRUF_DAUER_SEKUNDEN = 240;

/** Wie viele Fahrzeuge einen vollen, über den ganzen Tag verteilten Tagesplan bekommen (gemischt
 * über alle vier Fahrzeugtypen) statt nur der leichten Standard-Historie. */
const VOLLAUSLASTUNG_TAXI = 2;
const VOLLAUSLASTUNG_BTW = 2;
const VOLLAUSLASTUNG_TRAGESTUHL = 1;
const VOLLAUSLASTUNG_LMW = 1;
const FAHRTEN_TAGESZIEL_STANDARD = 2;
const FAHRTEN_TAGESZIEL_VOLL = 5;
const BETRIEB_START = "08:00";
const BETRIEB_ENDE = "18:00";

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

function zufallsPaar(wohnorte: Ort[], einrichtungen: Ort[]): { pickupPlace: Ort; dropoffPlace: Ort } {
  const wohnort = zufallsElement(wohnorte);
  const einrichtung = zufallsElement(einrichtungen);
  const richtungZurEinrichtung = Math.random() < 0.6; // häufiger hin als zurück
  return richtungZurEinrichtung
    ? { pickupPlace: wohnort, dropoffPlace: einrichtung }
    : { pickupPlace: einrichtung, dropoffPlace: wohnort };
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
  await tagesplanSicherstellen(tenantId, jetzt);
  await statusFortschreiben(tenantId, jetzt);
  await positionenAktualisieren(tenantId, jetzt);
  await haengendeVorschlaegeAufraeumen(tenantId, jetzt);
}

/** Ohne echten Disponenten klickt niemand "Bestätigen" für eine Fahrt, die der Automodus nicht
 * selbst zuweisen konnte - "Braucht Sie" würde sonst unbegrenzt wachsen. Nach
 * BRAUCHT_SIE_GEDULD_MINUTEN gilt eine hängende Fahrt als nicht mehr vermittelbar und wird
 * storniert (wirkt wie eine Absage), genau wie ein echter Disponent sie irgendwann abschließen
 * würde, statt sie für immer offen zu lassen. */
async function haengendeVorschlaegeAufraeumen(tenantId: string, jetzt: Date) {
  const db = withTenant(tenantId);
  const grenze = new Date(jetzt.getTime() - BRAUCHT_SIE_GEDULD_MINUTEN * 60_000);
  const haengend = await db.ride.findMany({
    where: {
      createdAt: { lt: grenze },
      OR: [{ status: "VORGESCHLAGEN" }, { status: "ERFASST", problems: { has: "KEIN_FAHRZEUG" } }],
    },
    select: { id: true },
  });
  for (const fahrt of haengend) {
    await fahrtStatusAendern(tenantId, fahrt.id, "STORNIERT");
  }
}

/** demoZuruecksetzen.ts löscht einen Fahrgast, sobald er keine Fahrt mehr hat (Privatsphäre für
 * echte Anrufer über die echte Telefonnummer) - trifft mit der Zeit auch den festen, erfundenen
 * Stamm hier. Fehlende Namen werden deshalb bei Bedarf selbst nachgelegt, statt von einem erneuten
 * seedDemoTenant()-Lauf abzuhängen. */
async function fahrgastRosterSicherstellen(tenantId: string): Promise<Passagier[]> {
  const db = withTenant(tenantId);
  const passagiereRoh = await db.passenger.findMany({ select: { id: true, firstName: true, lastName: true } });
  const fehlend = DEMO_PASSAGIER_ROSTER.filter(
    (p) => !passagiereRoh.some((v) => v.firstName === p.firstName && v.lastName === p.lastName),
  );
  for (const daten of fehlend) {
    await db.passenger.create({ data: { tenantId, phones: [], ...daten } });
  }
  return fehlend.length > 0
    ? db.passenger.findMany({ select: { id: true, firstName: true, lastName: true } })
    : passagiereRoh;
}

/** Legt einen simulierten Anruf (echtes, verschlüsseltes Transkript) plus die daraus erfasste
 * Fahrt an - genau wie ein echter Anruf bei der KI. Ohne vehicleId übernimmt die Zuweisung wie
 * immer der Automodus-Cron (für spontane Anrufe genau richtig - "irgendein passendes Fahrzeug").
 * Mit vehicleId (Tagesplan, siehe tagesplanSicherstellen) wird direkt diesem schon konfliktfrei
 * geprüften Fahrzeug zugewiesen, statt den Automodus über mehrere gleichzeitig geplante Fahrten
 * frei entscheiden zu lassen - das war sonst eine häufige Quelle unnötiger "Braucht Sie"-Fälle. */
async function simulierteFahrtAnlegen(
  tenantId: string,
  jetzt: Date,
  angaben: {
    passagier: Passagier;
    pickupPlace: Ort;
    dropoffPlace: Ort;
    transportType: TransportTyp;
    pickupAt: Date;
    vehicleId?: string;
  },
) {
  const db = withTenant(tenantId);
  const telefon = await db.phoneNumber.findFirst();
  const zeit = uhrzeitHHMM(angaben.pickupAt);
  const name = `${angaben.passagier.firstName} ${angaben.passagier.lastName}`;

  const transkript = zufallsElement(ANRUF_VORLAGEN)({
    name,
    nachname: angaben.passagier.lastName,
    pickupLabel: angaben.pickupPlace.label,
    dropoffLabel: angaben.dropoffPlace.label,
    transportLabel: TRANSPORT_TYPE_LABEL[angaben.transportType],
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

  const { rideId } = await fahrtErfassen(
    tenantId,
    {
      passengerId: angaben.passagier.id,
      pickupPlaceId: angaben.pickupPlace.id,
      dropoffPlaceId: angaben.dropoffPlace.id,
      datum: datumIso(angaben.pickupAt),
      abholzeit: zeit,
      terminzeit: undefined,
      rueckfahrt: false,
      rueckfahrtzeit: undefined,
      transportType: angaben.transportType,
      companion: false,
      assistanceNotes: undefined,
      prescription: "NICHT_NOETIG",
      approval: "NICHT_NOETIG",
    },
    { source: "ANRUF", callId: call.id },
  );

  if (angaben.vehicleId) {
    try {
      await fahrzeugZuweisen(tenantId, rideId, angaben.vehicleId, { dispatchMode: "AUTO" });
    } catch (fehler) {
      // Trotz eigener Überschneidungsprüfung im Tagesplan belegt (z. B. durch einen Anruf, der
      // zeitgleich dasselbe Fahrzeug bekam) - bleibt dann ganz normal als Vorschlag liegen, wie
      // jede andere nicht automatisch zuweisbare Fahrt auch.
      if (!(fehler instanceof FahrzeugKonfliktError)) throw fehler;
    }
  }
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

  const [passagiere, orte] = await Promise.all([fahrgastRosterSicherstellen(tenantId), db.place.findMany()]);
  const wohnorte = orte.filter((o) => o.type === "WOHNUNG");
  const einrichtungen = orte.filter((o) => o.type !== "WOHNUNG" && o.type !== "SONSTIGES");
  if (passagiere.length === 0 || wohnorte.length === 0 || einrichtungen.length === 0) return;

  const { pickupPlace, dropoffPlace } = zufallsPaar(wohnorte, einrichtungen);
  const transportType = zufaelligerTransportTyp();
  const pickupInMinuten = 10 + Math.floor(Math.random() * 70); // 10-80 Minuten voraus - wirkt dringend, aber plausibel
  const pickupAt = new Date(jetzt.getTime() + pickupInMinuten * 60_000);

  await simulierteFahrtAnlegen(tenantId, jetzt, {
    passagier: zufallsElement(passagiere),
    pickupPlace,
    dropoffPlace,
    transportType,
    pickupAt,
  });
}

/** Sorgt dafür, dass der Tag nie leer wirkt: jedes Fahrzeug bekommt ein paar Fahrten heute
 * (Historie), sechs gemischt über alle vier Fahrzeugtypen ausgewählte Fahrzeuge einen vollen, bis
 * 18 Uhr durchgehenden Tagesplan - inklusive Fahrten, die genau jetzt laufen (nicht nur
 * Vergangenheit oder nur Zukunft), damit beim Laden auch wirklich Fahrzeuge "während der Fahrt"
 * zu sehen sind. Fahrten, die schon vorbei sind oder gerade laufen, werden direkt mit dem
 * passenden Status angelegt (keine rückwirkende Simulation über den vollen Verlauf nötig); echte
 * Zukunft läuft ganz normal über einen simulierten Anruf plus Automodus-Zuweisung. */
async function tagesplanSicherstellen(tenantId: string, jetzt: Date) {
  const db = withTenant(tenantId);
  const tagesStart = mitUhrzeit(jetzt, BETRIEB_START);
  let tagesEnde = mitUhrzeit(jetzt, BETRIEB_ENDE);
  if (jetzt > tagesEnde) tagesEnde = jetzt; // nach Betriebsschluss trotzdem nicht ins Leere planen

  const [fahrzeuge, orte, passagiere] = await Promise.all([
    db.vehicle.findMany({ where: { active: true } }),
    db.place.findMany(),
    fahrgastRosterSicherstellen(tenantId),
  ]);
  const wohnorte = orte.filter((o) => o.type === "WOHNUNG");
  const einrichtungen = orte.filter((o) => o.type !== "WOHNUNG" && o.type !== "SONSTIGES");
  if (fahrzeuge.length === 0 || wohnorte.length === 0 || einrichtungen.length === 0 || passagiere.length === 0) return;

  const nachTyp = new Map<string, typeof fahrzeuge>();
  for (const fahrzeug of fahrzeuge) {
    const typ = fahrzeugTypLabel(fahrzeug);
    nachTyp.set(typ, [...(nachTyp.get(typ) ?? []), fahrzeug]);
  }
  const vollausgelastetIds = new Set(
    [
      ...(nachTyp.get("Taxi") ?? []).slice(0, VOLLAUSLASTUNG_TAXI),
      ...(nachTyp.get("BTW") ?? []).slice(0, VOLLAUSLASTUNG_BTW),
      ...(nachTyp.get("Tragestuhl") ?? []).slice(0, VOLLAUSLASTUNG_TRAGESTUHL),
      ...(nachTyp.get("LMW") ?? []).slice(0, VOLLAUSLASTUNG_LMW),
    ].map((f) => f.id),
  );

  for (const fahrzeug of fahrzeuge) {
    const ziel = vollausgelastetIds.has(fahrzeug.id) ? FAHRTEN_TAGESZIEL_VOLL : FAHRTEN_TAGESZIEL_STANDARD;
    const bestehend = await db.ride.findMany({
      where: { vehicleId: fahrzeug.id, pickupAt: { gte: tagesStart, lte: tagesEnde }, status: { not: "STORNIERT" } },
      include: { pickupPlace: true, dropoffPlace: true },
    });
    const fehlend = ziel - bestehend.length;
    if (fehlend <= 0) continue;

    const transportType = fahrzeugTypTransportType(fahrzeug);
    const belegt = bestehend.map((f) => ({
      von: new Date(f.pickupAt.getTime() - ANFAHRT_MINUTEN * 60_000),
      bis: new Date(f.pickupAt.getTime() + fahrtDauerMinuten(f.transportType, f.pickupPlace, f.dropoffPlace) * 60_000),
    }));

    for (let i = 0; i < fehlend; i++) {
      const slot = freienSlotFinden(tagesStart, tagesEnde, belegt, transportType, wohnorte, einrichtungen);
      if (!slot) break; // kein überschneidungsfreier Platz mehr gefunden - nicht erzwingen
      belegt.push({ von: new Date(slot.pickupAt.getTime() - ANFAHRT_MINUTEN * 60_000), bis: slot.ende });

      const passagier = zufallsElement(passagiere);
      const anfahrtStart = new Date(slot.pickupAt.getTime() - ANFAHRT_MINUTEN * 60_000);

      if (slot.ende <= jetzt || anfahrtStart <= jetzt) {
        // Ganz oder teilweise in der Vergangenheit (inklusive "läuft gerade jetzt") - sofort mit
        // dem dazu passenden Status anlegen, statt auf echte Zeit zu warten.
        const status: RideStatus = slot.ende <= jetzt ? "ERLEDIGT" : jetzt >= slot.pickupAt ? "AN_BORD" : "UNTERWEGS";
        const schicht = await db.shift.findFirst({
          where: { vehicleId: fahrzeug.id, start: { lte: slot.pickupAt }, end: { gte: slot.pickupAt } },
          select: { driverId: true },
        });
        const neueFahrt = await db.ride.create({
          data: {
            tenantId,
            passengerId: passagier.id,
            pickupPlaceId: slot.pickupPlace.id,
            dropoffPlaceId: slot.dropoffPlace.id,
            pickupAt: slot.pickupAt,
            transportType,
            status,
            source: "ANRUF",
            dispatchMode: "AUTO",
            vehicleId: fahrzeug.id,
            driverId: schicht?.driverId,
            completedAt: status === "ERLEDIGT" ? slot.ende : undefined,
          },
        });
        await db.rideStatusEvent.create({ data: { tenantId, rideId: neueFahrt.id, status } });
      } else {
        // Echte Zukunft (bis 18 Uhr): simulierter Anruf, aber direkt diesem schon
        // überschneidungsfrei geprüften Fahrzeug zugewiesen statt dem Automodus überlassen - der
        // müsste sonst unter vielen gleichzeitig geplanten Tagesplan-Fahrten frei wählen, was ohne
        // echten Disponenten nur unnötige "Braucht Sie"-Fälle erzeugt.
        await simulierteFahrtAnlegen(tenantId, jetzt, {
          passagier,
          pickupPlace: slot.pickupPlace,
          dropoffPlace: slot.dropoffPlace,
          transportType,
          pickupAt: slot.pickupAt,
          vehicleId: fahrzeug.id,
        });
      }
    }
  }
}

function freienSlotFinden(
  tagesStart: Date,
  tagesEnde: Date,
  belegt: { von: Date; bis: Date }[],
  transportType: TransportTyp,
  wohnorte: Ort[],
  einrichtungen: Ort[],
): { pickupAt: Date; ende: Date; pickupPlace: Ort; dropoffPlace: Ort } | null {
  for (let versuch = 0; versuch < 8; versuch++) {
    const anteil = Math.random();
    const pickupAt = new Date(tagesStart.getTime() + anteil * (tagesEnde.getTime() - tagesStart.getTime()));
    const { pickupPlace, dropoffPlace } = zufallsPaar(wohnorte, einrichtungen);
    const dauerMinuten = fahrtDauerMinuten(transportType, pickupPlace, dropoffPlace);
    const ende = new Date(pickupAt.getTime() + dauerMinuten * 60_000);
    const anfahrtStart = new Date(pickupAt.getTime() - ANFAHRT_MINUTEN * 60_000);
    const ueberschneidet = belegt.some((b) => anfahrtStart < b.bis && b.von < ende);
    if (!ueberschneidet) return { pickupAt, ende, pickupPlace, dropoffPlace };
  }
  return null;
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
