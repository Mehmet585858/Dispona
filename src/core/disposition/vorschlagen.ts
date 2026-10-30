import type { TransportType } from "@/generated/prisma/enums";
import { entfernungKm, type LatLng } from "@/lib/geo";
import type { RoutingProvider } from "@/providers/routing/types";
import { bewerteKandidat, type Bewertung } from "./bewertung";
import { erfuelltAusstattung, findeAktiveSchicht, type FahrzeugFuerPruefung, type SchichtFuerPruefung } from "./kandidaten";
import { EINSTIEGSZEIT_MINUTEN } from "./weights";

export type FahrtFuerVorschlag = {
  transportType: TransportType;
  companion: boolean;
  pickupAt: Date;
  appointmentAt?: Date | null;
  pickupOrt: LatLng;
  dropoffOrt: LatLng;
};

export type GeplanteFahrt = {
  vehicleId: string;
  pickupAt: Date;
  appointmentAt?: Date | null;
  pickupOrt: LatLng;
  dropoffOrt: LatLng;
  transportType: TransportType;
};

const MAX_VORSCHLAEGE = 3;

function naechsteFahrtFinden(tagesplan: GeplanteFahrt[], vehicleId: string, pickupAt: Date) {
  return tagesplan
    .filter((f) => f.vehicleId === vehicleId && f.pickupAt > pickupAt)
    .sort((a, b) => a.pickupAt.getTime() - b.pickupAt.getTime())[0];
}

function vorherigeFahrtFinden(tagesplan: GeplanteFahrt[], vehicleId: string, pickupAt: Date) {
  return tagesplan
    .filter((f) => f.vehicleId === vehicleId && f.pickupAt <= pickupAt)
    .sort((a, b) => b.pickupAt.getTime() - a.pickupAt.getTime())[0];
}

/**
 * Fairness/Auslastungsausgleich (docs/05-disposition.md): wie viele Fahrten hat jedes infrage
 * kommende Fahrzeug heute schon im Tagesplan, verglichen mit dem Durchschnitt aller Kandidaten?
 * Ein Fahrzeug mit überdurchschnittlich vielen Fahrten bekommt in bewerteKandidat() dadurch einen
 * kleinen Strafaufschlag, ein ruhigeres einen kleinen Bonus - wirkt nur als Zünglein an der Waage
 * zwischen ungefähr gleichwertigen Kandidaten (siehe GEWICHTE.auslastung in weights.ts).
 */
function auslastungDifferenzBerechnen(tagesplan: GeplanteFahrt[], kandidatenIds: string[]): Map<string, number> {
  const anzahlJeFahrzeug = new Map<string, number>();
  for (const id of kandidatenIds) anzahlJeFahrzeug.set(id, 0);
  for (const fahrt of tagesplan) {
    if (anzahlJeFahrzeug.has(fahrt.vehicleId)) {
      anzahlJeFahrzeug.set(fahrt.vehicleId, (anzahlJeFahrzeug.get(fahrt.vehicleId) ?? 0) + 1);
    }
  }
  const durchschnitt =
    [...anzahlJeFahrzeug.values()].reduce((summe, n) => summe + n, 0) / Math.max(1, kandidatenIds.length);
  const differenzen = new Map<string, number>();
  for (const [id, anzahl] of anzahlJeFahrzeug) differenzen.set(id, anzahl - durchschnitt);
  return differenzen;
}

/**
 * Berechnet bis zu 3 Fahrzeugvorschläge für eine Fahrt (docs/05-disposition.md).
 * Reine Eingabedaten werden vorher geladen; nur der RoutingProvider macht Netzwerkaufrufe.
 */
export async function vorschlaegeBerechnen(params: {
  fahrt: FahrtFuerVorschlag;
  fahrzeuge: (FahrzeugFuerPruefung & { plate: string })[];
  schichten: SchichtFuerPruefung[];
  tagesplan: GeplanteFahrt[];
  depot: LatLng;
  routing: Pick<RoutingProvider, "travelTimeMinutes">;
}): Promise<{ vorschlaege: Bewertung[]; keinKandidat: boolean }> {
  const { fahrt, fahrzeuge, schichten, tagesplan, depot, routing } = params;

  const kandidaten = fahrzeuge.filter(
    (f) =>
      erfuelltAusstattung(fahrt.transportType, fahrt.companion, f) &&
      findeAktiveSchicht(schichten, f.id, fahrt.pickupAt),
  );

  if (kandidaten.length === 0) {
    return { vorschlaege: [], keinKandidat: true };
  }

  const auslastungDifferenzen = auslastungDifferenzBerechnen(
    tagesplan,
    kandidaten.map((f) => f.id),
  );

  const bewertungen: Bewertung[] = [];

  for (const fahrzeug of kandidaten) {
    const schicht = findeAktiveSchicht(schichten, fahrzeug.id, fahrt.pickupAt)!;
    const vorherige = vorherigeFahrtFinden(tagesplan, fahrzeug.id, fahrt.pickupAt);

    let startOrt: LatLng;
    let startZeit: Date;
    if (vorherige) {
      startOrt = vorherige.dropoffOrt;
      const vorherigeFahrtMinuten = await routing.travelTimeMinutes(
        vorherige.pickupOrt,
        vorherige.dropoffOrt,
        vorherige.pickupAt,
      );
      const vorherigeBeginn =
        vorherige.appointmentAt && vorherige.appointmentAt > vorherige.pickupAt
          ? vorherige.appointmentAt
          : vorherige.pickupAt;
      startZeit = new Date(
        vorherigeBeginn.getTime() +
          (EINSTIEGSZEIT_MINUTEN[vorherige.transportType] + vorherigeFahrtMinuten) * 60_000,
      );
    } else {
      startOrt = depot;
      startZeit = schicht.start;
    }

    const anfahrtMinuten = await routing.travelTimeMinutes(startOrt, fahrt.pickupOrt, startZeit);
    const fahrtMinuten = await routing.travelTimeMinutes(
      fahrt.pickupOrt,
      fahrt.dropoffOrt,
      fahrt.pickupAt,
    );

    const naechste = naechsteFahrtFinden(tagesplan, fahrzeug.id, fahrt.pickupAt);
    let folgefahrtPufferMinuten: number | null = null;
    if (naechste) {
      const ankunftZielGeschaetzt = new Date(
        Math.max(startZeit.getTime() + anfahrtMinuten * 60_000, fahrt.pickupAt.getTime()) +
          (EINSTIEGSZEIT_MINUTEN[fahrt.transportType] + fahrtMinuten) * 60_000,
      );
      const weiterfahrtMinuten = await routing.travelTimeMinutes(
        fahrt.dropoffOrt,
        naechste.pickupOrt,
        ankunftZielGeschaetzt,
      );
      const ankunftNaechsterAbholort = new Date(
        ankunftZielGeschaetzt.getTime() + weiterfahrtMinuten * 60_000,
      );
      folgefahrtPufferMinuten =
        (naechste.pickupAt.getTime() - ankunftNaechsterAbholort.getTime()) / 60_000;
    }

    bewertungen.push(
      bewerteKandidat({
        vehicleId: fahrzeug.id,
        driverId: schicht.driverId,
        plate: fahrzeug.plate,
        transportType: fahrt.transportType,
        pickupAt: fahrt.pickupAt,
        appointmentAt: fahrt.appointmentAt,
        startZeit,
        anfahrtMinuten,
        fahrtMinuten,
        leerKm: entfernungKm(startOrt, fahrt.pickupOrt),
        folgefahrtPufferMinuten,
        auslastungDifferenz: auslastungDifferenzen.get(fahrzeug.id) ?? 0,
      }),
    );
  }

  const passende = bewertungen.filter((b) => b.passtRein).sort((a, b) => a.score - b.score);

  return {
    vorschlaege: passende.slice(0, MAX_VORSCHLAEGE),
    keinKandidat: passende.length === 0,
  };
}
