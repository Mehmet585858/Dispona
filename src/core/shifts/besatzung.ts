/**
 * "Was kann diese Besatzung?" – reine Regeln ohne Datenbank (docs/05-disposition.md, Abschnitt
 * "Besatzung"). Eine Schicht besteht aus Fahrzeug, Fahrer, optionalem Beifahrer und der Angabe
 * "Scalamobil an Bord". Daraus folgt, welche Fahrten das Fahrzeug in dieser Schicht übernehmen darf:
 *
 * - Liegend: immer 2 Personen (Fahrer + Beifahrer) auf einem Fahrzeug mit Trage.
 * - Tragestuhl mit Treppe (Abhol- oder Zielort hat `treppe`): 2 Personen auf einem Fahrzeug mit
 *   Tragestuhl, ODER 1 Person mit Scalamobil an Bord und Einweisung, auf einem Fahrzeug mit
 *   Tragestuhl oder Rollstuhlplatz.
 * - Tragestuhl ebenerdig: 1 Person reicht (Fahrzeug mit Tragestuhl oder Rollstuhlplatz, die
 *   Ausstattung prüft erfuelltAusstattung in src/core/disposition/kandidaten.ts).
 *
 * Annahme (Bauprotokoll 2026-11-02): Die Scalamobil-Einweisung zählt beim FAHRER. Ein eingewiesener
 * Beifahrer allein reicht nicht – mit Beifahrer gilt ohnehin der Weg "2 Personen".
 * Nicht zu verwechseln: Ride.companion ist die Begleitperson des Fahrgasts, nicht der Beifahrer.
 */
import type { TransportType } from "@/generated/prisma/enums";
import { BESATZUNG_TEXTE } from "./texte";

export type FahrzeugFuerBesatzung = {
  wheelchairSpots: number;
  carryChair: boolean;
  stretcher: boolean;
};

/** Besatzung einer Schicht, schon ausgewertet: nur ein AKTIVER Beifahrer zählt. */
export type Besatzung = {
  /** Beifahrer eingetragen und aktiv (nicht deaktiviert). */
  beifahrer: boolean;
  /** Scalamobil in dieser Schicht an Bord. */
  scalamobil: boolean;
  /** Der Fahrer hat die Scalamobil-Einweisung. */
  fahrerEinweisung: boolean;
};

/** Rohdaten einer Schicht, wie sie aus der Datenbank kommen (mit Fahrer und Beifahrer). */
export type SchichtMitPersonal = {
  scalamobil: boolean;
  driver: { scalamobilEinweisung: boolean };
  beifahrer: { active: boolean } | null;
};

export function besatzungAusSchicht(schicht: SchichtMitPersonal): Besatzung {
  return {
    beifahrer: !!schicht.beifahrer?.active,
    scalamobil: schicht.scalamobil,
    fahrerEinweisung: schicht.driver.scalamobilEinweisung,
  };
}

export type Treppe = "ZWEI_PERSONEN" | "SCALAMOBIL" | "NUR_EBENERDIG";

export type BesatzungsKoennen = {
  personen: 1 | 2;
  /** Fahrzeug hat eine Trage und es sind 2 Personen an Bord. */
  liegend: boolean;
  /** Treppen mit Tragestuhl – nur sinnvoll bei Fahrzeugen mit Tragestuhl oder Rollstuhlplatz. */
  treppe: Treppe;
};

function hatBtwAusstattung(fahrzeug: FahrzeugFuerBesatzung): boolean {
  return fahrzeug.carryChair || fahrzeug.wheelchairSpots >= 1;
}

export function besatzungKann(fahrzeug: FahrzeugFuerBesatzung, besatzung: Besatzung): BesatzungsKoennen {
  const personen = besatzung.beifahrer ? 2 : 1;
  let treppe: Treppe = "NUR_EBENERDIG";
  if (personen === 2 && fahrzeug.carryChair) treppe = "ZWEI_PERSONEN";
  else if (besatzung.scalamobil && besatzung.fahrerEinweisung && hatBtwAusstattung(fahrzeug)) treppe = "SCALAMOBIL";
  return { personen, liegend: fahrzeug.stretcher && personen === 2, treppe };
}

export type EtikettTon = "ok" | "warn" | "neutral";
export type BesatzungsEtikett = { ton: EtikettTon; text: string };

/**
 * Etiketten für den Schichtplan (wie in der freigegebenen Vorschau): Liegend möglich / 2. Person
 * fehlt, und für Fahrzeuge mit Tragestuhl oder Rollstuhlplatz, wie Treppen gehen. Sitzend-Fahrzeuge
 * ohne Trage bekommen kein Etikett. "warn" heißt Handlungsbedarf (Orange im Design).
 */
export function besatzungsEtiketten(fahrzeug: FahrzeugFuerBesatzung, besatzung: Besatzung): BesatzungsEtikett[] {
  const etiketten: BesatzungsEtikett[] = [];
  const kann = besatzungKann(fahrzeug, besatzung);
  if (fahrzeug.stretcher) {
    etiketten.push(
      kann.liegend
        ? { ton: "ok", text: BESATZUNG_TEXTE.etikettLiegendOk }
        : { ton: "warn", text: BESATZUNG_TEXTE.etikettLiegendFehlt },
    );
  }
  if (hatBtwAusstattung(fahrzeug)) {
    if (kann.treppe === "ZWEI_PERSONEN") etiketten.push({ ton: "ok", text: BESATZUNG_TEXTE.etikettTreppeZwei });
    else if (kann.treppe === "SCALAMOBIL") etiketten.push({ ton: "ok", text: BESATZUNG_TEXTE.etikettTreppeScalamobil });
    else if (besatzung.scalamobil && !besatzung.fahrerEinweisung) {
      etiketten.push({ ton: "warn", text: BESATZUNG_TEXTE.etikettScalamobilOhneEinweisung });
    } else etiketten.push({ ton: "neutral", text: BESATZUNG_TEXTE.etikettNurEbenerdig });
  }
  return etiketten;
}

/** Was eine Fahrt von der Besatzung verlangt. */
export type FahrtAnforderung = {
  transportType: TransportType;
  /** Am Abhol- oder Zielort ist eine Treppe (Place.treppe). */
  treppe: boolean;
};

export function fahrtAnforderung(fahrt: {
  transportType: TransportType;
  pickupPlace: { treppe: boolean };
  dropoffPlace: { treppe: boolean };
}): FahrtAnforderung {
  return { transportType: fahrt.transportType, treppe: fahrt.pickupPlace.treppe || fahrt.dropoffPlace.treppe };
}

export type BesatzungsPruefung = { passt: true } | { passt: false; grund: string };

/**
 * Passt die Besatzung zur Fahrt? Die reine Fahrzeugausstattung (Rollstuhlplatz, Trage, Sitze)
 * prüft erfuelltAusstattung; hier geht es nur um Personen und Scalamobil.
 * Annahme: Sitzend- und Rollstuhl-Fahrten stellen keine Anforderung an die Besatzung, auch mit
 * Treppe nicht (Bauprotokoll 2026-11-02, offene Frage).
 */
export function besatzungPruefen(
  anforderung: FahrtAnforderung,
  fahrzeug: FahrzeugFuerBesatzung,
  besatzung: Besatzung,
): BesatzungsPruefung {
  const kann = besatzungKann(fahrzeug, besatzung);
  if (anforderung.transportType === "LIEGEND") {
    if (!besatzung.beifahrer) return { passt: false, grund: BESATZUNG_TEXTE.liegendOhneBeifahrer };
    return { passt: true };
  }
  if (anforderung.transportType === "TRAGESTUHL" && anforderung.treppe) {
    if (kann.treppe !== "NUR_EBENERDIG") return { passt: true };
    if (besatzung.scalamobil && !besatzung.fahrerEinweisung && !besatzung.beifahrer) {
      return { passt: false, grund: BESATZUNG_TEXTE.treppeScalamobilOhneEinweisung };
    }
    if (besatzung.beifahrer && !fahrzeug.carryChair) return { passt: false, grund: BESATZUNG_TEXTE.treppeOhneTragestuhl };
    return { passt: false, grund: BESATZUNG_TEXTE.treppeOhneBesatzung };
  }
  return { passt: true };
}
