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
import { anfahrtMinuten, fahrtDauerMinuten } from "@/core/shifts/dauer";
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
/* Anfahrtszeit (Status-Wechsel Disponiert -> Unterwegs, GPS-Interpolation, Konfliktprüfung bei der
 * Tagesplanung) wird nicht mehr pauschal angenommen, sondern aus der echten Entfernung zwischen
 * Start- und Abholadresse berechnet - siehe anfahrtMinuten() (src/core/shifts/dauer.ts) und
 * vorherigerStandort() unten. */
/** Wie oft ein ruhendes (nicht gerade fahrendes) Fahrzeug trotzdem eine frische GPS-Zeile bekommt -
 * sicher unter den 10 Minuten, die automodus.ts (pruefeGpsOderBetriebshof, Sicherheitsbedingung 3)
 * für einen aktuellen Standort verlangt, sonst bleibt jede Fahrt für ein länger ruhendes Fahrzeug
 * dauerhaft beim Automodus hängen ("Vorgeschlagen" statt automatisch "Disponiert"). */
const GPS_AUFFRISCH_MINUTEN = 5;
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
/** Obergrenze für neu angelegte Tagesplan-Fahrten pro Cron-Minute - jede davon braucht mehrere
 * sequentielle Datenbank-Umläufe (Anruf, Fahrt erfassen, Fahrzeug zuweisen). Ohne Deckel könnte ein
 * großer Rückstand (z. B. nach einer Pause) einen einzelnen Lauf so lange dauern lassen, dass er
 * das Zeitlimit reißt - fehlende Fahrten werden dann einfach über die nächsten Minuten verteilt
 * nachgeholt statt alle auf einmal. */
const MAX_NEUE_TAGESPLAN_FAHRTEN_PRO_LAUF = 6;
/** Dieselbe Begrenzung für die Aufräumrunde (haengendeVorschlaegeAufraeumen) - jede Stornierung
 * braucht ebenfalls mehrere Datenbank-Umläufe. */
const MAX_AUFRAEUM_PRO_LAUF = 10;
/** Dieselbe Begrenzung für statusFortschreiben - jeder Statuswechsel braucht ebenfalls mehrere
 * Datenbank-Umläufe (fahrtStatusAendern: Prüfung, Update, Event, ggf. Benachrichtigung). Ohne
 * Deckel war das die einzige der drei großen Schleifen, die nach einem großen Rückstand erneut
 * das Zeitlimit reißen konnte - derselbe Bug-Typ wie der bereits einmal gefixte Produktions-Freeze. */
const MAX_STATUS_FORTSCHREIBEN_PRO_LAUF = 20;
const BETRIEB_START = "08:00";
const BETRIEB_ENDE = "18:00";

/** Für das Aktivitäts-Gate in neuenAnrufBeiBedarf: bewusst nur WIRKLICH laufende Fahrten, nicht
 * DISPONIERT/ERFASST/VORGESCHLAGEN - der Tagesplan (tagesplanSicherstellen) legt pro Tag ~30-40
 * direkt zugewiesene (also sofort DISPONIERT) Fahrten an, oft schon in den ersten Cron-Minuten.
 * Würden die mitgezählt, wäre ZIEL_AKTIVE_FAHRTEN fast den ganzen Tag "erreicht" und die
 * spontane Anruf-Simulation - das eigentliche "Live"-Feature - käme kaum noch zum Zug. */
const LAUFENDE_STATUS: RideStatus[] = ["UNTERWEGS", "AN_BORD"];
/** Wie wahrscheinlich ein heute schon einmal verplanter Fahrgast für eine zweite Fahrt als
 * Rückfahrt (umgekehrte Route, gleiche Transportart) wiederverwendet wird, statt einen frischen,
 * heute noch unbenutzten Namen zu nehmen - sonst bekäme praktisch jeder einen Rückweg, und das
 * Roster würde ständig doppelt auftauchen. */
const RUECKFAHRT_WAHRSCHEINLICHKEIT = 0.4;
/** Mindest- und Zusatzwartezeit zwischen Hin- und Rückfahrt (der Termin dauert ja eine Weile) -
 * bestimmt die früheste erlaubte Abholzeit für die Rückfahrt. */
const RUECKFAHRT_WARTEZEIT_MIN_MINUTEN = 20;
const RUECKFAHRT_WARTEZEIT_SPANNE_MINUTEN = 90;

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

type PassagierTagesInfo = {
  rideId: string;
  pickupPlace: Ort;
  dropoffPlace: Ort;
  transportType: TransportTyp;
  pickupAt: Date;
  ende: Date;
  anzahl: number;
};

/** Lädt für jeden Fahrgast, der "heute" (tagesStart bis tagesEnde) schon mindestens eine nicht
 * stornierte Fahrt hat, Route, Transportart und Ende der letzten Fahrt - die Grundlage dafür, dass
 * derselbe Name höchstens zweimal vorkommt, und das zweite Mal nur als echte Rückfahrt (umgekehrte
 * Route, gleiche Transportart), nie als unabhängige weitere Fahrt. */
async function passagierTagesInfoLaden(
  db: ReturnType<typeof withTenant>,
  tagesStart: Date,
  tagesEnde: Date,
): Promise<Map<string, PassagierTagesInfo>> {
  const heutigeFahrten = await db.ride.findMany({
    where: { pickupAt: { gte: tagesStart, lte: tagesEnde }, status: { not: "STORNIERT" } },
    include: { pickupPlace: true, dropoffPlace: true },
    orderBy: { pickupAt: "asc" },
  });
  const info = new Map<string, PassagierTagesInfo>();
  for (const fahrt of heutigeFahrten) {
    const dauerMinuten = fahrtDauerMinuten(fahrt.transportType, fahrt.pickupPlace, fahrt.dropoffPlace);
    const bestehend = info.get(fahrt.passengerId);
    info.set(fahrt.passengerId, {
      rideId: fahrt.id,
      pickupPlace: fahrt.pickupPlace,
      dropoffPlace: fahrt.dropoffPlace,
      transportType: fahrt.transportType,
      pickupAt: fahrt.pickupAt,
      ende: new Date(fahrt.pickupAt.getTime() + dauerMinuten * 60_000),
      anzahl: (bestehend?.anzahl ?? 0) + 1,
    });
  }
  return info;
}

/** Trägt eine neu angelegte Fahrt in tagesInfo ein, direkt nach dem Schreiben - damit ein
 * übernächster Slot im selben Lauf diesen Fahrgast schon als "heute verplant" sieht. */
function tagesInfoAktualisieren(
  tagesInfo: Map<string, PassagierTagesInfo>,
  passagierId: string,
  rideId: string,
  route: { pickupPlace: Ort; dropoffPlace: Ort },
  transportType: TransportTyp,
  pickupAt: Date,
  ende: Date,
) {
  const bestehend = tagesInfo.get(passagierId);
  tagesInfo.set(passagierId, {
    rideId,
    pickupPlace: route.pickupPlace,
    dropoffPlace: route.dropoffPlace,
    transportType,
    pickupAt,
    ende,
    anzahl: (bestehend?.anzahl ?? 0) + 1,
  });
}

/** Wählt den Fahrgast für eine neue Fahrt: bevorzugt einen heute noch unbenutzten Namen (frische
 * Route wird vom Aufrufer bestimmt); mit RUECKFAHRT_WAHRSCHEINLICHKEIT stattdessen gezielt einen
 * heute schon genau einmal verplanten Fahrgast für dessen Rückfahrt - Route umgekehrt, gleiche
 * Transportart, frühestens eine Weile nach Ende der Hinfahrt. "Nie dieselben Namen, außer bei
 * Hin- und Rückfahrt." erzwungeneTransportart (vom Fahrzeugtyp im Tagesplan vorgegeben) schränkt
 * die Rückfahrt-Kandidaten auf passende Transportarten ein - ohne Vorgabe (spontaner Anruf) zählt
 * jede Transportart. */
function passagierWaehlen(
  passagiere: Passagier[],
  tagesInfo: Map<string, PassagierTagesInfo>,
  erzwungeneTransportart?: TransportTyp,
): {
  passagier: Passagier;
  transportType: TransportTyp;
  istRueckfahrt: boolean;
  route?: { pickupPlace: Ort; dropoffPlace: Ort };
  fruehestens?: Date;
  /** ID der Hinfahrt, nur gesetzt wenn istRueckfahrt - reicht bis zu fahrtErfassen() durch, damit
   * istDoppelbuchung() genau diese Hinfahrt ausnimmt (Maßnahme M-07, R1-2) statt alle Fahrten mit
   * derselben Abholzeit. */
  vorherigeRideId?: string;
} {
  const rueckfahrtKandidaten = passagiere.filter((p) => {
    const info = tagesInfo.get(p.id);
    return !!info && info.anzahl === 1 && (!erzwungeneTransportart || info.transportType === erzwungeneTransportart);
  });
  if (rueckfahrtKandidaten.length > 0 && Math.random() < RUECKFAHRT_WAHRSCHEINLICHKEIT) {
    const passagier = zufallsElement(rueckfahrtKandidaten);
    const info = tagesInfo.get(passagier.id)!;
    const wartenMinuten = RUECKFAHRT_WARTEZEIT_MIN_MINUTEN + Math.random() * RUECKFAHRT_WARTEZEIT_SPANNE_MINUTEN;
    return {
      passagier,
      transportType: info.transportType,
      istRueckfahrt: true,
      route: { pickupPlace: info.dropoffPlace, dropoffPlace: info.pickupPlace },
      fruehestens: new Date(info.ende.getTime() + wartenMinuten * 60_000),
      vorherigeRideId: info.rideId,
    };
  }
  // Heute noch unbenutzte Namen bevorzugen; ist das Roster für heute komplett verplant, lieber
  // eine seltene Kollision in Kauf nehmen als gar keine neue Fahrt anlegen.
  const frische = passagiere.filter((p) => !tagesInfo.has(p.id));
  const kandidaten = frische.length > 0 ? frische : passagiere;
  return {
    passagier: zufallsElement(kandidaten),
    transportType: erzwungeneTransportart ?? zufaelligerTransportTyp(),
    istRueckfahrt: false,
  };
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
  const depot = await depotLaden(tenantId);

  await alteAnrufeAbschliessen(tenantId, jetzt);
  await neuenAnrufBeiBedarf(tenantId, jetzt);
  await tagesplanSicherstellen(tenantId, jetzt, depot);
  await statusFortschreiben(tenantId, jetzt, depot);
  await positionenAktualisieren(tenantId, jetzt, depot);
  await haengendeVorschlaegeAufraeumen(tenantId, jetzt);
}

/** Betriebshof-Koordinaten aus den Mandanten-Einstellungen (dieselbe Quelle wie die echte
 * Produktions-Disposition, siehe depot-Parameter in vorschlaegeBerechnen(),
 * src/core/disposition/vorschlagen.ts) - Fallback auf den ersten Standplatz, falls depotAddress
 * ausnahmsweise fehlt (sollte bei seedDemoTenant() nie vorkommen). */
async function depotLaden(tenantId: string): Promise<LatLng> {
  const db = withTenant(tenantId);
  const einstellungen = await db.tenantSettings.findUnique({ where: { tenantId }, select: { depotAddress: true } });
  const depot = einstellungen?.depotAddress as LatLng | null | undefined;
  return depot ?? STANDPLAETZE[0];
}

/** Letzter bekannter Standort eines Fahrzeugs vor einem Zeitpunkt: der Zielort seiner letzten an
 * diesem Tag schon erledigten Fahrt, sonst der Betriebshof (erste Fahrt des Tages) - dieselbe
 * Grundidee wie die echte Produktions-Disposition (vorherigeFahrtFinden() in
 * src/core/disposition/vorschlagen.ts), hier anhand der echten Adresse statt eines GPS-Live-Werts:
 * der Punkt, von dem aus losgefahren wurde, bleibt fix, auch während das Fahrzeug schon unterwegs
 * ist (ein GPS-Live-Wert würde sich sonst mit der laufenden Interpolation selbst verschieben). */
async function vorherigerStandort(
  db: ReturnType<typeof withTenant>,
  vehicleId: string,
  vorZeit: Date,
  depot: LatLng,
): Promise<LatLng> {
  const letzteFahrt = await db.ride.findFirst({
    where: { vehicleId, status: "ERLEDIGT", pickupAt: { lt: vorZeit } },
    orderBy: { pickupAt: "desc" },
    select: { dropoffPlace: { select: { lat: true, lng: true } } },
  });
  return letzteFahrt?.dropoffPlace ?? depot;
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
    take: MAX_AUFRAEUM_PRO_LAUF, // Rest holt der nächste Lauf nach, siehe MAX_NEUE_TAGESPLAN_FAHRTEN_PRO_LAUF
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
    /** ID der zusammengehörigen Hinfahrt, wenn dies eine simulierte Rückfahrt ist - siehe
     * passagierWaehlen() und die Begründung in src/core/rides/erfassen.ts. Ohne das würde
     * istDoppelbuchung() diese gewollte Rückfahrt fälschlich als Problem "DOPPELBUCHUNG" flaggen,
     * sobald sie innerhalb von 60 Minuten nach der Hinfahrt liegt. */
    ignoriereDoppelbuchungRideId?: string;
  },
): Promise<{ rideId: string; zugewiesen: boolean }> {
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
    angaben.ignoriereDoppelbuchungRideId,
  );

  if (angaben.vehicleId) {
    try {
      await fahrzeugZuweisen(tenantId, rideId, angaben.vehicleId, { dispatchMode: "AUTO" });
      return { rideId, zugewiesen: true };
    } catch (fehler) {
      if (!(fehler instanceof FahrzeugKonfliktError)) throw fehler;
      // Trotz eigener Überschneidungsprüfung im Tagesplan doch belegt (z. B. durch einen Anruf,
      // der zeitgleich dasselbe Fahrzeug bekam) - die Fahrt bleibt als ERFASST ohne Fahrzeug
      // stehen. Ohne dieses Flag fällt sie durch BEIDE Netze (haengendeVorschlaegeAufraeumen
      // sucht gezielt ERFASST+KEIN_FAHRZEUG, "Braucht Sie" zählt dasselbe) und bliebe für immer
      // unsichtbar liegen, weil fahrtErfassen() zum Erfassungszeitpunkt ja noch ein Fahrzeug
      // kannte und das Flag deshalb von sich aus nicht gesetzt hat.
      // Maßnahme M-20 (R2-6): nur einmal eintragen (fahrtErfassen kann es schon gesetzt haben).
      const aktuell = await db.ride.findUnique({ where: { id: rideId }, select: { problems: true } });
      if (!aktuell?.problems.includes("KEIN_FAHRZEUG")) {
        await db.ride.update({ where: { id: rideId }, data: { problems: { push: "KEIN_FAHRZEUG" } } });
      }
      return { rideId, zugewiesen: false };
    }
  }
  return { rideId, zugewiesen: false }; // kein vehicleId (spontaner Anruf) - der separate Automodus-Cron entscheidet später
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
  const aktiveAnzahl = await db.ride.count({ where: { status: { in: LAUFENDE_STATUS } } });
  if (aktiveAnzahl >= ZIEL_AKTIVE_FAHRTEN) return;
  if (Math.random() > NEUE_FAHRT_WAHRSCHEINLICHKEIT) return;

  const tagesStart = mitUhrzeit(jetzt, BETRIEB_START);
  let tagesEnde = mitUhrzeit(jetzt, BETRIEB_ENDE);
  if (jetzt > tagesEnde) tagesEnde = jetzt;

  const [passagiere, orte, tagesInfo] = await Promise.all([
    fahrgastRosterSicherstellen(tenantId),
    db.place.findMany(),
    passagierTagesInfoLaden(db, tagesStart, tagesEnde),
  ]);
  const wohnorte = orte.filter((o) => o.type === "WOHNUNG");
  const einrichtungen = orte.filter((o) => o.type !== "WOHNUNG" && o.type !== "SONSTIGES");
  if (passagiere.length === 0 || wohnorte.length === 0 || einrichtungen.length === 0) return;

  const auswahl = passagierWaehlen(passagiere, tagesInfo);
  const { pickupPlace, dropoffPlace } = auswahl.route ?? zufallsPaar(wohnorte, einrichtungen);
  const pickupInMinuten = 10 + Math.floor(Math.random() * 70); // 10-80 Minuten voraus - wirkt dringend, aber plausibel
  let pickupAt = new Date(jetzt.getTime() + pickupInMinuten * 60_000);
  if (auswahl.fruehestens && pickupAt < auswahl.fruehestens) pickupAt = auswahl.fruehestens;

  // Letzte Prüfung direkt vor dem Schreiben - siehe passagierKonfliktVorhanden: tagesInfo oben
  // kann durch einen zeitgleich laufenden zweiten Cron-Durchlauf inzwischen veraltet sein.
  if (
    await passagierKonfliktVorhanden(db, auswahl.passagier.id, tagesStart, tagesEnde, { pickupPlace, dropoffPlace }, auswahl.transportType, auswahl.istRueckfahrt)
  ) {
    return;
  }

  await simulierteFahrtAnlegen(tenantId, jetzt, {
    passagier: auswahl.passagier,
    pickupPlace,
    dropoffPlace,
    transportType: auswahl.transportType,
    pickupAt,
    ignoriereDoppelbuchungRideId: auswahl.istRueckfahrt ? auswahl.vorherigeRideId : undefined,
  });
}

/** Sorgt dafür, dass der Tag nie leer wirkt: jedes Fahrzeug bekommt ein paar Fahrten heute
 * (Historie), sechs gemischt über alle vier Fahrzeugtypen ausgewählte Fahrzeuge einen vollen, bis
 * 18 Uhr durchgehenden Tagesplan - inklusive Fahrten, die genau jetzt laufen (nicht nur
 * Vergangenheit oder nur Zukunft), damit beim Laden auch wirklich Fahrzeuge "während der Fahrt"
 * zu sehen sind. Fahrten, die schon vorbei sind oder gerade laufen, werden direkt mit dem
 * passenden Status angelegt (keine rückwirkende Simulation über den vollen Verlauf nötig); echte
 * Zukunft läuft ganz normal über einen simulierten Anruf plus Automodus-Zuweisung. */
async function tagesplanSicherstellen(tenantId: string, jetzt: Date, depot: LatLng) {
  const db = withTenant(tenantId);
  const tagesStart = mitUhrzeit(jetzt, BETRIEB_START);
  let tagesEnde = mitUhrzeit(jetzt, BETRIEB_ENDE);
  if (jetzt > tagesEnde) tagesEnde = jetzt; // nach Betriebsschluss trotzdem nicht ins Leere planen

  const [fahrzeuge, orte, passagiere, tagesInfo] = await Promise.all([
    // orderBy nötig: ohne stabile Sortierung kann Postgres zwischen zwei Läufen eine andere
    // Reihenfolge liefern (z. B. nach einem update() in seedDemoTenant.ts) - .slice(...) unten
    // würde dann zwischen zwei Cron-Minuten unterschiedliche Fahrzeuge als "vollausgelastet" wählen.
    db.vehicle.findMany({ where: { active: true }, orderBy: { plate: "asc" } }),
    db.place.findMany(),
    fahrgastRosterSicherstellen(tenantId),
    passagierTagesInfoLaden(db, tagesStart, tagesEnde),
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

  let neuAngelegt = 0;
  for (const fahrzeug of fahrzeuge) {
    if (neuAngelegt >= MAX_NEUE_TAGESPLAN_FAHRTEN_PRO_LAUF) break; // Rest holt der nächste Lauf nach
    const ziel = vollausgelastetIds.has(fahrzeug.id) ? FAHRTEN_TAGESZIEL_VOLL : FAHRTEN_TAGESZIEL_STANDARD;
    const bestehend = await db.ride.findMany({
      where: { vehicleId: fahrzeug.id, pickupAt: { gte: tagesStart, lte: tagesEnde }, status: { not: "STORNIERT" } },
      include: { pickupPlace: true, dropoffPlace: true },
    });
    const fehlend = ziel - bestehend.length;
    if (fehlend <= 0) continue;

    const transportType = fahrzeugTypTransportType(fahrzeug);
    // Explizit als BelegterSlot[] statt den (um einige Felder reicheren) Prisma-Place-Typ aus
    // bestehend inferieren zu lassen - slot.pickupPlace/dropoffPlace unten sind vom schlankeren Ort-
    // Typ (nur die für die Anfahrt-Berechnung nötigen Felder), beide sind strukturell kompatibel.
    const belegt: BelegterSlot[] = bestehend.map((f) => ({
      pickupAt: f.pickupAt,
      ende: new Date(f.pickupAt.getTime() + fahrtDauerMinuten(f.transportType, f.pickupPlace, f.dropoffPlace) * 60_000),
      pickupOrt: f.pickupPlace,
      dropoffOrt: f.dropoffPlace,
    }));

    for (let i = 0; i < fehlend; i++) {
      if (neuAngelegt >= MAX_NEUE_TAGESPLAN_FAHRTEN_PRO_LAUF) break;
      const auswahl = passagierWaehlen(passagiere, tagesInfo, transportType);
      const fruehestens = auswahl.fruehestens ?? tagesStart;
      const slot = freienSlotFinden(fruehestens, tagesEnde, belegt, transportType, wohnorte, einrichtungen, auswahl.route);
      if (!slot) break; // kein überschneidungsfreier Platz mehr gefunden - nicht erzwingen
      // Vorgänger im bisherigen Tagesplan dieses Fahrzeugs - bestimmt, von wo aus losgefahren wird
      // (echter letzter Standort, nicht pauschal der Betriebshof) und damit die echte Anfahrtszeit.
      const vorgaenger = belegt
        .filter((b) => b.ende <= slot.pickupAt)
        .sort((a, b) => b.ende.getTime() - a.ende.getTime())[0];
      const anfahrtMin = anfahrtMinuten(vorgaenger?.dropoffOrt ?? depot, slot.pickupPlace);
      const anfahrtStart = new Date(slot.pickupAt.getTime() - anfahrtMin * 60_000);
      const kandidat = { pickupAt: slot.pickupAt, ende: slot.ende, pickupOrt: slot.pickupPlace, dropoffOrt: slot.dropoffPlace };
      belegt.push(kandidat);
      neuAngelegt += 1;

      const passagier = auswahl.passagier;

      if (slot.ende <= jetzt || anfahrtStart <= jetzt) {
        // Ganz oder teilweise in der Vergangenheit (inklusive "läuft gerade jetzt") - sofort mit
        // dem dazu passenden Status anlegen, statt auf echte Zeit zu warten.
        const status: RideStatus = slot.ende <= jetzt ? "ERLEDIGT" : jetzt >= slot.pickupAt ? "AN_BORD" : "UNTERWEGS";

        // Letzte Prüfung direkt vor dem Schreiben, mit frischer Datenbankabfrage statt des oben
        // nur einmal berechneten "belegt"-Arrays: der Cron läuft minütlich ohne Garantie
        // exklusiver Ausführung, und dieser direkte Create-Pfad hat - anders als
        // fahrzeugZuweisen() im else-Zweig unten - sonst keine eigene Konfliktprüfung. Ein
        // zeitgleich laufender zweiter Durchlauf könnte seit der Abfrage von "bestehend" oben
        // bereits etwas Überschneidendes für dasselbe Fahrzeug angelegt haben.
        if (await fahrzeugUeberschneidungVorhanden(db, fahrzeug.id, kandidat)) {
          continue; // ein paralleler Lauf hat diesen Slot inzwischen belegt - nicht erzwingen
        }
        // Dieselbe letzte Prüfung wie oben für das Fahrzeug, hier für den Fahrgast: ein
        // zeitgleicher zweiter Durchlauf könnte denselben, damals noch unbenutzten Namen
        // inzwischen selbst vergeben haben (siehe passagierKonfliktVorhanden).
        if (
          await passagierKonfliktVorhanden(
            db,
            passagier.id,
            tagesStart,
            tagesEnde,
            { pickupPlace: slot.pickupPlace, dropoffPlace: slot.dropoffPlace },
            transportType,
            auswahl.istRueckfahrt,
          )
        ) {
          continue;
        }

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
        // Unabhängig vom Status aktualisieren (auch bei ERLEDIGT): der Fahrgast hat heute schon
        // eine Fahrt gehabt, egal ob sie noch läuft oder schon vorbei ist - das allein soll eine
        // weitere, unabhängige Zuteilung an denselben Namen verhindern (siehe passagierWaehlen).
        tagesInfoAktualisieren(
          tagesInfo,
          passagier.id,
          neueFahrt.id,
          { pickupPlace: slot.pickupPlace, dropoffPlace: slot.dropoffPlace },
          transportType,
          slot.pickupAt,
          slot.ende,
        );
      } else {
        // Echte Zukunft (bis 18 Uhr): simulierter Anruf, aber direkt diesem schon
        // überschneidungsfrei geprüften Fahrzeug zugewiesen statt dem Automodus überlassen - der
        // müsste sonst unter vielen gleichzeitig geplanten Tagesplan-Fahrten frei wählen, was ohne
        // echten Disponenten nur unnötige "Braucht Sie"-Fälle erzeugt.
        if (
          await passagierKonfliktVorhanden(
            db,
            passagier.id,
            tagesStart,
            tagesEnde,
            { pickupPlace: slot.pickupPlace, dropoffPlace: slot.dropoffPlace },
            transportType,
            auswahl.istRueckfahrt,
          )
        ) {
          continue;
        }
        const angelegt = await simulierteFahrtAnlegen(tenantId, jetzt, {
          passagier,
          pickupPlace: slot.pickupPlace,
          dropoffPlace: slot.dropoffPlace,
          transportType,
          pickupAt: slot.pickupAt,
          vehicleId: fahrzeug.id,
          ignoriereDoppelbuchungRideId: auswahl.istRueckfahrt ? auswahl.vorherigeRideId : undefined,
        });
        // Die Fahrt existiert ab hier so oder so (ERFASST, ggf. ohne Fahrzeug bei einem seltenen
        // Konflikt) - der Name gilt damit als "heute verplant", unabhängig vom Zuweisungserfolg.
        tagesInfoAktualisieren(
          tagesInfo,
          passagier.id,
          angelegt.rideId,
          { pickupPlace: slot.pickupPlace, dropoffPlace: slot.dropoffPlace },
          transportType,
          slot.pickupAt,
          slot.ende,
        );
      }
    }
  }
}

/** Frische Überschneidungsprüfung für genau ein Fahrzeug und einen Kandidaten-Slot, direkt vor
 * einem db.ride.create() im Tagesplan-Pfad - siehe Kommentar an der Aufrufstelle. Bewusst eine
 * eigenständige, kleine Abfrage statt des größeren "bestehend"-Querys oben, damit diese letzte
 * Prüfung so kurz wie möglich vor dem Schreiben passiert. Prüft wie anfahrtKonfliktVorhanden()
 * nicht nur Zeitüberschneidung, sondern auch die echte Anfahrtszeit zwischen den Adressen. */
async function fahrzeugUeberschneidungVorhanden(
  db: ReturnType<typeof withTenant>,
  vehicleId: string,
  kandidat: { pickupAt: Date; ende: Date; pickupOrt: LatLng; dropoffOrt: LatLng },
): Promise<boolean> {
  const bestehend = await db.ride.findMany({
    where: {
      vehicleId,
      status: { not: "STORNIERT" },
      pickupAt: {
        gte: new Date(kandidat.pickupAt.getTime() - 4 * 60 * 60_000),
        lte: new Date(kandidat.ende.getTime() + 4 * 60 * 60_000),
      },
    },
    include: { pickupPlace: true, dropoffPlace: true },
  });
  return bestehend.some((f) => {
    const fEnde = new Date(f.pickupAt.getTime() + fahrtDauerMinuten(f.transportType, f.pickupPlace, f.dropoffPlace) * 60_000);
    if (kandidat.pickupAt < fEnde && f.pickupAt < kandidat.ende) return true; // direkte Überschneidung
    if (f.pickupAt <= kandidat.pickupAt) {
      const noetig = anfahrtMinuten(f.dropoffPlace, kandidat.pickupOrt);
      return kandidat.pickupAt.getTime() - fEnde.getTime() < noetig * 60_000;
    }
    const noetig = anfahrtMinuten(kandidat.dropoffOrt, f.pickupPlace);
    return f.pickupAt.getTime() - kandidat.ende.getTime() < noetig * 60_000;
  });
}

/** Dieselbe Lücke wie fahrzeugUeberschneidungVorhanden, nur für Fahrgäste statt Fahrzeuge: das
 * oben einmal geladene tagesInfo ist zwischen dem Laden und diesem Schreiben nicht mehr
 * zwangsläufig aktuell, wenn ein zeitgleich laufender zweiter Cron-Durchlauf denselben, bis dahin
 * noch unbenutzten Namen inzwischen selbst vergeben hat - sonst könnte derselbe Fahrgast trotz
 * passagierWaehlen() am Ende doch zweimal unabhängig (oder ein drittes Mal) auftauchen. */
async function passagierKonfliktVorhanden(
  db: ReturnType<typeof withTenant>,
  passagierId: string,
  tagesStart: Date,
  tagesEnde: Date,
  route: { pickupPlace: Ort; dropoffPlace: Ort },
  transportType: TransportTyp,
  istRueckfahrt: boolean,
): Promise<boolean> {
  const bestehend = await db.ride.findMany({
    where: { passengerId: passagierId, pickupAt: { gte: tagesStart, lte: tagesEnde }, status: { not: "STORNIERT" } },
    select: { pickupPlaceId: true, dropoffPlaceId: true, transportType: true },
  });
  if (bestehend.length === 0) return false; // frisch, kein Konflikt
  if (bestehend.length >= 2) return true; // hat heute schon Hin + Rück - kein drittes Mal
  const [erste] = bestehend;
  const istGueltigeRueckfahrt =
    istRueckfahrt &&
    erste.transportType === transportType &&
    erste.pickupPlaceId === route.dropoffPlace.id &&
    erste.dropoffPlaceId === route.pickupPlace.id;
  return !istGueltigeRueckfahrt;
}

type BelegterSlot = { pickupAt: Date; ende: Date; pickupOrt: Ort; dropoffOrt: Ort };

/** Prüft einen Kandidaten-Slot gegen die schon belegten Slots desselben Fahrzeugs - nicht nur
 * Zeitüberschneidung, sondern auch ob zwischen den jeweils echten Adressen genug Anfahrtszeit
 * bleibt (anfahrtMinuten()), statt einer für jedes Fahrzeug gleichen Pauschalspanne. depot zählt
 * dabei nicht als Vorgänger/Nachfolger - der Betriebshof hat anders als ein Fahrzeug keine
 * begrenzte Kapazität, braucht also keine eigene Konfliktprüfung. */
function anfahrtKonfliktVorhanden(belegt: BelegterSlot[], kandidat: BelegterSlot): boolean {
  if (belegt.some((b) => kandidat.pickupAt < b.ende && b.pickupAt < kandidat.ende)) return true; // direkte Überschneidung

  const vorher = belegt.filter((b) => b.ende <= kandidat.pickupAt).sort((a, b) => b.ende.getTime() - a.ende.getTime())[0];
  if (vorher) {
    const noetig = anfahrtMinuten(vorher.dropoffOrt, kandidat.pickupOrt);
    if (kandidat.pickupAt.getTime() - vorher.ende.getTime() < noetig * 60_000) return true;
  }

  const nachher = belegt.filter((b) => b.pickupAt >= kandidat.ende).sort((a, b) => a.pickupAt.getTime() - b.pickupAt.getTime())[0];
  if (nachher) {
    const noetig = anfahrtMinuten(kandidat.dropoffOrt, nachher.pickupOrt);
    if (nachher.pickupAt.getTime() - kandidat.ende.getTime() < noetig * 60_000) return true;
  }

  return false;
}

function freienSlotFinden(
  fruehestens: Date,
  tagesEnde: Date,
  belegt: BelegterSlot[],
  transportType: TransportTyp,
  wohnorte: Ort[],
  einrichtungen: Ort[],
  fixeRoute?: { pickupPlace: Ort; dropoffPlace: Ort },
): { pickupAt: Date; ende: Date; pickupPlace: Ort; dropoffPlace: Ort } | null {
  if (fruehestens >= tagesEnde) return null; // z. B. eine Rückfahrt, deren Wartezeit über 18 Uhr hinausreicht
  // Deutlich mehr Versuche als früher (8): anfahrtKonfliktVorhanden() prüft jetzt die echte
  // Anfahrtszeit zwischen zwei echten Adressen statt einer pauschalen 12-Minuten-Spanne - bei zwei
  // weit auseinanderliegenden Nachbar-Fahrten (z. B. Spandau und Köpenick) braucht ein zufällig
  // gezogener Kandidat entsprechend öfter einen neuen Anlauf, um einen wirklich passenden,
  // geografisch sinnvollen Platz zu finden. Rein In-Memory-Prüfung (kein Datenbank-Zugriff in der
  // Schleife), also auch bei vielen Versuchen güntig.
  for (let versuch = 0; versuch < 60; versuch++) {
    const anteil = Math.random();
    const pickupAt = new Date(fruehestens.getTime() + anteil * (tagesEnde.getTime() - fruehestens.getTime()));
    // fixeRoute (Rückfahrt): dieselbe umgekehrte Route bei jedem Versuch, nur die Uhrzeit variiert.
    // Sonst (frische Fahrt) wie bisher bei jedem Versuch eine neue zufällige Route.
    const { pickupPlace, dropoffPlace } = fixeRoute ?? zufallsPaar(wohnorte, einrichtungen);
    const dauerMinuten = fahrtDauerMinuten(transportType, pickupPlace, dropoffPlace);
    const ende = new Date(pickupAt.getTime() + dauerMinuten * 60_000);
    const kandidat = { pickupAt, ende, pickupOrt: pickupPlace, dropoffOrt: dropoffPlace };
    if (!anfahrtKonfliktVorhanden(belegt, kandidat)) return { pickupAt, ende, pickupPlace, dropoffPlace };
  }
  return null;
}

async function statusFortschreiben(tenantId: string, jetzt: Date, depot: LatLng) {
  const db = withTenant(tenantId);
  const kandidaten = await db.ride.findMany({
    where: { status: { in: ["DISPONIERT", "UNTERWEGS", "AN_BORD"] } },
    include: { pickupPlace: true, dropoffPlace: true },
    // orderBy ist hier Pflicht, nicht nur Kosmetik: an einem vollen Tag gibt es oft deutlich mehr
    // als MAX_STATUS_FORTSCHREIBEN_PRO_LAUF offene Fahrten gleichzeitig. Ohne diese Sortierung
    // liefert Postgres eine beliebige Teilmenge zurück - eine seit Langem fällige Fahrt (Fahrer
    // zugewiesen, Abholzeit längst erreicht) konnte dadurch dauerhaft aus der take-Grenze
    // herausfallen, während spätere, noch gar nicht fällige Fahrten unnötig Plätze belegten
    // (jeder Kandidat zählt gegen die Grenze, auch wenn die untenstehende Zeitprüfung ihn gar
    // nicht fortschreibt). Mit "nach Abholzeit aufsteigend" sind die am längsten überfälligen
    // Fahrten immer zuerst dran und ein Rückstand baut sich garantiert über die nächsten Läufe ab.
    orderBy: { pickupAt: "asc" },
    take: MAX_STATUS_FORTSCHREIBEN_PRO_LAUF, // Rest holt der nächste Lauf nach, siehe MAX_NEUE_TAGESPLAN_FAHRTEN_PRO_LAUF
  });
  for (const fahrt of kandidaten) {
    if (fahrt.status === "DISPONIERT") {
      if (!fahrt.vehicleId) continue; // bei DISPONIERT eigentlich immer gesetzt, defensiv
      const vonOrt = await vorherigerStandort(db, fahrt.vehicleId, fahrt.pickupAt, depot);
      const anfahrt = anfahrtMinuten(vonOrt, fahrt.pickupPlace);
      if (jetzt.getTime() >= fahrt.pickupAt.getTime() - anfahrt * 60_000) {
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

async function positionenAktualisieren(tenantId: string, jetzt: Date, depot: LatLng) {
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
      // Startpunkt anhand der echten Adresse (letzte erledigte Fahrt oder Betriebshof), nicht per
      // GPS-Live-Wert - der würde sich sonst mit der laufenden Interpolation selbst verschieben
      // (siehe vorherigerStandort()).
      const vonOrt = await vorherigerStandort(db, fahrzeug.id, fahrt.pickupAt, depot);
      const anfahrt = anfahrtMinuten(vonOrt, fahrt.pickupPlace);
      const start = new Date(fahrt.pickupAt.getTime() - anfahrt * 60_000);
      const anteil = clamp01((jetzt.getTime() - start.getTime()) / (anfahrt * 60_000));
      position = interpolieren(vonOrt, fahrt.pickupPlace, anteil);
    } else if (fahrt && fahrt.status === "AN_BORD") {
      const dauerMinuten = fahrtDauerMinuten(fahrt.transportType, fahrt.pickupPlace, fahrt.dropoffPlace);
      const anteil = clamp01((jetzt.getTime() - fahrt.pickupAt.getTime()) / (dauerMinuten * 60_000));
      position = interpolieren(fahrt.pickupPlace, fahrt.dropoffPlace, anteil);
    } else {
      // Kein aktiver Auftrag (frei oder disponiert, aber noch nicht losgefahren) - steht an seiner
      // letzten Position, braucht aber trotzdem regelmäßig eine frische GPS-Zeile (nicht nur beim
      // allerersten Mal): ein echter GPS-Tracker meldet auch im Stand periodisch seine Position.
      // Ohne diese Auffrischung würde das GPS-Alter eines länger ruhenden Fahrzeugs die in
      // automodus.ts geforderten 10 Minuten (pruefeGpsOderBetriebshof, Bedingung 3) überschreiten -
      // das blockierte in der Praxis fast jedes Fahrzeug nach seiner ersten Fahrt des Tages dauerhaft
      // für den Automodus, Vorschläge blieben "Vorgeschlagen" hängen statt automatisch zu disponieren.
      const letzte = await letztePositionMitZeitpunkt(db, fahrzeug.id);
      if (letzte && jetzt.getTime() - letzte.at.getTime() < GPS_AUFFRISCH_MINUTEN * 60_000) continue;
      position = letzte ?? STANDPLAETZE[index % STANDPLAETZE.length];
    }

    if (position) {
      await db.vehicleLocation.create({
        data: { tenantId, vehicleId: fahrzeug.id, lat: position.lat, lng: position.lng },
      });
    }
  }
}

async function letztePositionMitZeitpunkt(
  db: ReturnType<typeof withTenant>,
  vehicleId: string,
): Promise<(LatLng & { at: Date }) | null> {
  const zeile = await db.vehicleLocation.findFirst({ where: { vehicleId }, orderBy: { at: "desc" } });
  return zeile ? { lat: zeile.lat, lng: zeile.lng, at: zeile.at } : null;
}
