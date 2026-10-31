/** Reine Prüf-Funktionen für neue Fahrten (docs/01-produkt.md, docs/09-bauplan.md Phase 3). */

import { entfernungKm } from "@/lib/geo";

export type Problem =
  | "DOPPELBUCHUNG"
  | "AUSSERHALB_EINSATZGEBIET"
  | "GENEHMIGUNG_FEHLT"
  | "ADRESSE_UNSICHER"
  | "RUECKFAHRT_ZEIT_OFFEN"
  | "ABHOLZEIT_VERGANGEN"
  | "TERMIN_VOR_ABHOLUNG";

/**
 * Maßnahme M-46 Punkt 2 (S1-007): Wie weit eine Abholzeit in der Vergangenheit liegen darf, ohne
 * Problem zu sein – "jetzt sofort" bestellt um 10:02 für 10:00 ist kein Fehler. Annahme 15 Minuten
 * (die Spezifikation schweigt); alles darüber ist fast immer ein falsch verstandenes Datum.
 */
export const VERGANGENHEIT_TOLERANZ_MINUTEN = 15;

/**
 * Plausibilität der Zeit (Maßnahme M-46, S1-007): Abholung nicht in der Vergangenheit, Termin am
 * Ziel nach der Abholung. Rein, `jetzt` kommt vom Aufrufer.
 */
export function zeitProbleme(eingabe: { pickupAt: Date; appointmentAt?: Date | null; jetzt: Date }): Problem[] {
  const probleme: Problem[] = [];
  if (eingabe.pickupAt.getTime() < eingabe.jetzt.getTime() - VERGANGENHEIT_TOLERANZ_MINUTEN * 60_000) {
    probleme.push("ABHOLZEIT_VERGANGEN");
  }
  if (eingabe.appointmentAt && eingabe.appointmentAt.getTime() <= eingabe.pickupAt.getTime()) {
    probleme.push("TERMIN_VOR_ABHOLUNG");
  }
  return probleme;
}

export function imEinsatzgebiet(
  ort: { lat: number; lng: number },
  zentrum: { lat: number; lng: number },
  radiusKm: number,
): boolean {
  return entfernungKm(ort, zentrum) <= radiusKm;
}

/** Erkennt, ob eine neue Abholzeit zu nah an einer bestehenden Fahrt desselben Fahrgasts liegt. */
export function istDoppelbuchung(
  bestehendeAbholzeiten: Date[],
  neueAbholzeit: Date,
  fensterMinuten = 60,
): boolean {
  const fensterMs = fensterMinuten * 60_000;
  return bestehendeAbholzeiten.some(
    (zeit) => Math.abs(zeit.getTime() - neueAbholzeit.getTime()) < fensterMs,
  );
}

/** Prüft, ob am Fahrttag eine gültige Genehmigung der Krankenkasse vorliegt. */
export function hatGueltigeGenehmigung(
  genehmigungen: { validFrom: Date; validUntil: Date }[],
  datum: Date,
): boolean {
  return genehmigungen.some((g) => g.validFrom <= datum && datum <= g.validUntil);
}

type FahrtPruefungEingabe = {
  pickupOrt: { lat: number; lng: number } | null;
  pickupAt: Date;
  bestehendeAbholzeitenDesFahrgasts: Date[];
  approval: "JA" | "NEIN" | "UNKLAR" | "NICHT_NOETIG";
  genehmigungen: { validFrom: Date; validUntil: Date }[];
  serviceAreaCenter: { lat: number; lng: number } | null;
  serviceAreaKm: number;
  adresseUnsicher?: boolean;
  /** Maßnahme M-07: Rückfahrt bestellt, Uhrzeit noch offen – pickupAt ist nur ein Platzhalter. */
  rueckfahrtZeitOffen?: boolean;
  /** Maßnahme M-46: Termin am Ziel, falls bekannt. */
  appointmentAt?: Date | null;
  /** Maßnahme M-46: Bezugszeitpunkt für "in der Vergangenheit" (Pflicht, damit kein Aufrufer ihn vergisst). */
  jetzt: Date;
};

/** Fasst alle Prüfungen für eine neue Fahrt zusammen. Liefert die gefundenen Probleme. */
export function fahrtPruefen(eingabe: FahrtPruefungEingabe): Problem[] {
  const probleme: Problem[] = [];

  if (istDoppelbuchung(eingabe.bestehendeAbholzeitenDesFahrgasts, eingabe.pickupAt)) {
    probleme.push("DOPPELBUCHUNG");
  }

  if (
    eingabe.pickupOrt &&
    eingabe.serviceAreaCenter &&
    !imEinsatzgebiet(eingabe.pickupOrt, eingabe.serviceAreaCenter, eingabe.serviceAreaKm)
  ) {
    probleme.push("AUSSERHALB_EINSATZGEBIET");
  }

  if (eingabe.approval === "JA" && !hatGueltigeGenehmigung(eingabe.genehmigungen, eingabe.pickupAt)) {
    probleme.push("GENEHMIGUNG_FEHLT");
  }

  if (eingabe.adresseUnsicher) {
    probleme.push("ADRESSE_UNSICHER");
  }

  if (eingabe.rueckfahrtZeitOffen) {
    probleme.push("RUECKFAHRT_ZEIT_OFFEN");
  }

  probleme.push(...zeitProbleme(eingabe));

  return probleme;
}
