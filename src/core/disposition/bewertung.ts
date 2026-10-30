import type { TransportType } from "@/generated/prisma/enums";
import {
  ANFAHRT_PUFFER_MINUTEN,
  EINSTIEGSZEIT_MINUTEN,
  FOLGEFAHRT_MINDESTPUFFER_MINUTEN,
  FOLGEFAHRT_STRAFPUNKTE,
  GEWICHTE,
  TERMIN_PUFFER_MINUTEN,
} from "./weights";

function addMinuten(datum: Date, minuten: number): Date {
  return new Date(datum.getTime() + minuten * 60_000);
}

function minutenZwischen(frueher: Date, spaeter: Date): number {
  return (spaeter.getTime() - frueher.getTime()) / 60_000;
}

export type KandidatEingabe = {
  vehicleId: string;
  driverId: string;
  plate: string;
  transportType: TransportType;
  pickupAt: Date;
  appointmentAt?: Date | null;
  /** Ab wann das Fahrzeug losfahren kann (Ende der vorherigen Fahrt oder Schichtbeginn am Betriebshof). */
  startZeit: Date;
  /** Fahrzeit in Minuten vom Startpunkt zum Abholort. */
  anfahrtMinuten: number;
  /** Fahrzeit in Minuten vom Abholort zum Zielort. */
  fahrtMinuten: number;
  /** Leerkilometer vom Startpunkt zum Abholort. */
  leerKm: number;
  /**
   * Puffer in Minuten, der der nächsten bereits geplanten Fahrt dieses Fahrzeugs nach Einfügen
   * dieser Fahrt noch bleibt (Fahrzeit Zielort → nächster Abholort bereits abgezogen).
   * undefined/null, wenn keine Folgefahrt ansteht.
   */
  folgefahrtPufferMinuten?: number | null;
  /**
   * Fairness/Auslastungsausgleich: wie viele Fahrten dieses Fahrzeug heute schon mehr (positiv)
   * oder weniger (negativ) hat als der Durchschnitt aller infrage kommenden Fahrzeuge - siehe
   * auslastungDifferenzBerechnen() in vorschlagen.ts. Ein überdurchschnittlich ausgelastetes
   * Fahrzeug bekommt dadurch einen kleinen Strafaufschlag, ein ruhigeres einen kleinen Bonus.
   */
  auslastungDifferenz: number;
};

export type Bewertung = {
  vehicleId: string;
  driverId: string;
  plate: string;
  /** false = scheidet aus (zerstört die nächste Fahrt), gehört nicht in die Vorschlagsliste. */
  passtRein: boolean;
  zuSpaet: boolean;
  etaMin: number;
  ankunftZiel: Date;
  score: number;
  begruendung: string;
};

export function bewerteKandidat(eingabe: KandidatEingabe): Bewertung {
  const ankunftAbholung = addMinuten(eingabe.startZeit, eingabe.anfahrtMinuten + ANFAHRT_PUFFER_MINUTEN);
  const beginn = ankunftAbholung > eingabe.pickupAt ? ankunftAbholung : eingabe.pickupAt;
  const einstieg = EINSTIEGSZEIT_MINUTEN[eingabe.transportType];
  const ankunftZiel = addMinuten(beginn, einstieg + eingabe.fahrtMinuten);

  let zuSpaet = false;
  let verspaetungMinuten = 0;
  if (eingabe.appointmentAt) {
    const spaetesteAnkunft = addMinuten(eingabe.appointmentAt, -TERMIN_PUFFER_MINUTEN);
    if (ankunftZiel > spaetesteAnkunft) {
      zuSpaet = true;
      verspaetungMinuten = minutenZwischen(spaetesteAnkunft, ankunftZiel);
    }
  } else if (beginn > eingabe.pickupAt) {
    verspaetungMinuten = minutenZwischen(eingabe.pickupAt, beginn);
  }

  const zerstoertFolgefahrt =
    eingabe.folgefahrtPufferMinuten != null && eingabe.folgefahrtPufferMinuten < 0;
  const folgefahrtVerschoben =
    !zerstoertFolgefahrt &&
    eingabe.folgefahrtPufferMinuten != null &&
    eingabe.folgefahrtPufferMinuten < FOLGEFAHRT_MINDESTPUFFER_MINUTEN;

  const score =
    GEWICHTE.anfahrt * eingabe.anfahrtMinuten +
    GEWICHTE.verspaetung * verspaetungMinuten +
    GEWICHTE.leerKm * eingabe.leerKm +
    GEWICHTE.folgefahrtVerschoben * (folgefahrtVerschoben ? FOLGEFAHRT_STRAFPUNKTE : 0) +
    GEWICHTE.auslastung * eingabe.auslastungDifferenz;

  const teile = [`Anfahrt ${Math.round(eingabe.anfahrtMinuten)} Min`];
  teile.push(zuSpaet ? "zu spät zum Termin" : "pünktlich am Ziel");
  if (folgefahrtVerschoben) teile.push("verschiebt die nächste Fahrt leicht");
  if (eingabe.auslastungDifferenz < 0) teile.push("gleicht Auslastung aus");

  return {
    vehicleId: eingabe.vehicleId,
    driverId: eingabe.driverId,
    plate: eingabe.plate,
    passtRein: !zerstoertFolgefahrt,
    zuSpaet,
    etaMin: Math.round(eingabe.anfahrtMinuten),
    ankunftZiel,
    score,
    begruendung: teile.join(" · "),
  };
}
