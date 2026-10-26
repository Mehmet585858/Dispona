/** Reine Prüf-Funktionen für neue Fahrten (docs/01-produkt.md, docs/09-bauplan.md Phase 3). */

import { entfernungKm } from "@/lib/geo";

export type Problem =
  | "DOPPELBUCHUNG"
  | "AUSSERHALB_EINSATZGEBIET"
  | "GENEHMIGUNG_FEHLT"
  | "ADRESSE_UNSICHER";

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

  return probleme;
}
