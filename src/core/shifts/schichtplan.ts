/**
 * Schichtplan – reine Regeln ohne Datenbank (docs/05-disposition.md "Schichtplan"). Die
 * Datenbank-Seite (laden, sperren, schreiben, betroffene Fahrten freigeben) steht in
 * src/core/shifts/schichtplanSpeichern.ts.
 *
 * Bearbeitet wird immer "ein Fahrzeug an einem Tag": alle Schichten, die an diesem Berliner
 * Kalendertag beginnen, werden durch die Entwürfe ersetzt. "Gilt für" und das Kopieren von Wochen
 * erzeugen dieselbe Art Änderung für mehrere Tage. Dabei gilt immer:
 * - Vergangene Tage werden nie überschrieben (übersprungen und gemeldet).
 * - Schon begonnene Schichten (startedAt gesetzt) bleiben unverändert (gemeldet).
 * - Prüfungen: Fahrer gesetzt, Zeiten gültig (Ende vor Beginn = Nachtschicht bis zum Folgetag,
 *   M-18), keine Überschneidung je Fahrzeug, keine Person doppelt verplant (als Fahrer oder
 *   Beifahrer, über alle Fahrzeuge), Fahrer ≠ Beifahrer, keine deaktivierten Personen (M-12),
 *   Scalamobil-Anzahl eingehalten, nur Personen und Fahrzeuge dieses Mandanten.
 */
import { besatzungPruefen, type Besatzung, type FahrtAnforderung } from "./besatzung";
import { schichtZeitraum } from "./dauer";
import {
  berlinerMitternacht,
  datumIso,
  monatsTageIso,
  montagVonIso,
  tagKurzIso,
  tagVerschieben,
  uhrzeitBerlin,
  WOCHENTAG_LABEL,
  wochentagVonIso,
} from "./week";
import { SCHICHTPLAN_TEXTE as T } from "./texte";

export type PlanSchicht = {
  id?: string;
  vehicleId: string;
  driverId: string;
  beifahrerId: string | null;
  scalamobil: boolean;
  start: Date;
  end: Date;
  startedAt?: Date | null;
  /** Fahrer hat "Ich falle aus" gemeldet (oder wurde deaktiviert): blockiert weder Fahrzeug noch Person noch Scalamobil. */
  unavailable?: boolean;
};

export type PlanPerson = { id: string; name: string; active: boolean; scalamobilEinweisung: boolean };
export type PlanFahrzeug = { id: string; plate: string; wheelchairSpots: number; carryChair: boolean; stretcher: boolean };

export type PlanKontext = {
  personen: Map<string, PlanPerson>;
  fahrzeuge: Map<string, PlanFahrzeug>;
  scalamobilAnzahl: number;
};

/** Eine Schicht, wie sie im Seitenfenster bearbeitet wird (Uhrzeiten in Berliner Zeit). */
export type SchichtEntwurf = {
  von: string;
  bis: string;
  fahrerId: string;
  beifahrerId: string | null;
  scalamobil: boolean;
};

export type GiltFuer = "TAG" | "WOCHE" | "WOCHENTAG_MONAT" | "WERKTAGE_MONAT";

/** Änderung "dieses Fahrzeug an diesem Tag": die Entwürfe ersetzen die bisherigen Schichten. */
export type Aenderung = { vehicleId: string; tagIso: string; entwuerfe: SchichtEntwurf[] };

export type Meldung = { vehicleId: string; tagIso: string; grund: string };

/** Berliner Kalendertag, an dem eine Schicht beginnt – ihm "gehört" die Schicht im Plan. */
export function schichtTag(schicht: Pick<PlanSchicht, "start">): string {
  return datumIso(schicht.start);
}

/** "Montag, 02.11." */
export function tagLabel(tagIso: string): string {
  return `${WOCHENTAG_LABEL[wochentagVonIso(tagIso)]}, ${tagKurzIso(tagIso)}`;
}

function ueberlappt(a: { start: Date; end: Date }, b: { start: Date; end: Date }): boolean {
  return a.start < b.end && b.start < a.end;
}

function zeitraumText(s: { start: Date; end: Date }): [string, string] {
  return [uhrzeitBerlin(s.start), uhrzeitBerlin(s.end)];
}

/**
 * "Gilt für": an welchen Tagen die Entwürfe gelten sollen. Werktage = Montag bis Freitag (wie in
 * der Vorschau; Feiertage werden nicht ausgelassen – Annahme, Bauprotokoll 2026-11-02).
 */
export function zielTage(tagIso: string, giltFuer: GiltFuer): string[] {
  if (giltFuer === "TAG") return [tagIso];
  if (giltFuer === "WOCHE") {
    const montag = montagVonIso(tagIso);
    return [0, 1, 2, 3, 4].map((i) => tagVerschieben(montag, i));
  }
  const wochentag = wochentagVonIso(tagIso);
  return monatsTageIso(tagIso).filter((tag) =>
    giltFuer === "WOCHENTAG_MONAT" ? wochentagVonIso(tag) === wochentag : wochentagVonIso(tag) <= 4,
  );
}

/** Höchste Zahl gleichzeitig laufender Zeiträume innerhalb von `fenster`. */
function maxGleichzeitig(zeitraeume: { start: Date; end: Date }[], fenster: { start: Date; end: Date }): number {
  const ereignisse: [number, number][] = [];
  for (const z of zeitraeume) {
    if (!ueberlappt(z, fenster)) continue;
    ereignisse.push([Math.max(z.start.getTime(), fenster.start.getTime()), 1]);
    ereignisse.push([Math.min(z.end.getTime(), fenster.end.getTime()), -1]);
  }
  // Bei gleicher Zeit zuerst die Enden: 08:00–12:00 und 12:00–16:00 laufen nicht gleichzeitig.
  ereignisse.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let aktuell = 0;
  let maximum = 0;
  for (const [, delta] of ereignisse) {
    aktuell += delta;
    maximum = Math.max(maximum, aktuell);
  }
  return maximum;
}

export type Pruefergebnis = { ok: true; schichten: PlanSchicht[] } | { ok: false; fehler: string };

/**
 * Prüft die Entwürfe für ein Fahrzeug an einem Tag gegen alle übrigen Schichten (`uebrige`: der
 * Plan OHNE die Schichten, die ersetzt werden) und baut daraus die neuen Schichten.
 */
export function entwuerfePruefen(
  vehicleId: string,
  tagIso: string,
  entwuerfe: SchichtEntwurf[],
  uebrige: PlanSchicht[],
  kontext: PlanKontext,
): Pruefergebnis {
  const fahrzeug = kontext.fahrzeuge.get(vehicleId);
  if (!fahrzeug) return { ok: false, fehler: T.fahrzeugUnbekannt };
  const tag = berlinerMitternacht(tagIso);
  const mehrere = entwuerfe.length > 1;
  const mitNummer = (i: number, text: string) => (mehrere ? T.mitSchichtNummer(i + 1, text) : text);
  const neue: PlanSchicht[] = [];

  for (const [i, e] of entwuerfe.entries()) {
    if (!e.fahrerId) return { ok: false, fehler: mitNummer(i, T.fahrerFehlt) };
    let zeitraum: { start: Date; end: Date };
    try {
      zeitraum = schichtZeitraum(tag, e.von, e.bis);
    } catch {
      return { ok: false, fehler: mitNummer(i, T.zeitUngueltig) };
    }
    if (e.von === e.bis) return { ok: false, fehler: mitNummer(i, T.zeitGleich) };
    const beifahrerId = e.beifahrerId || null;
    if (beifahrerId === e.fahrerId) return { ok: false, fehler: mitNummer(i, T.fahrerGleichBeifahrer) };
    for (const personId of [e.fahrerId, beifahrerId]) {
      if (!personId) continue;
      const person = kontext.personen.get(personId);
      if (!person) return { ok: false, fehler: mitNummer(i, T.personUnbekannt) };
      if (!person.active) return { ok: false, fehler: mitNummer(i, T.deaktiviert(person.name)) };
    }
    if (e.scalamobil && !fahrzeug.carryChair && fahrzeug.wheelchairSpots < 1) {
      return { ok: false, fehler: mitNummer(i, T.scalamobilFahrzeug) };
    }
    neue.push({ vehicleId, driverId: e.fahrerId, beifahrerId, scalamobil: e.scalamobil, ...zeitraum });
  }

  for (let i = 0; i < neue.length; i++) {
    for (let j = 0; j < i; j++) {
      if (ueberlappt(neue[i], neue[j])) return { ok: false, fehler: T.ueberschneidungEntwurf(j + 1, i + 1) };
    }
  }

  // Ausgefallene Schichten zählen nicht: auf dem Fahrzeug darf eine Ersatzschicht laufen (M-72).
  const wirksam = uebrige.filter((o) => !o.unavailable);
  for (const s of neue) {
    const belegt = wirksam.find((o) => o.vehicleId === vehicleId && ueberlappt(o, s));
    if (belegt) return { ok: false, fehler: T.fahrzeugBelegt(fahrzeug.plate, tagLabel(schichtTag(belegt)), ...zeitraumText(belegt)) };
  }

  for (const s of neue) {
    for (const personId of [s.driverId, s.beifahrerId]) {
      if (!personId) continue;
      const andere = wirksam.find((o) => (o.driverId === personId || o.beifahrerId === personId) && ueberlappt(o, s));
      if (andere) {
        const name = kontext.personen.get(personId)?.name ?? "";
        const plate = kontext.fahrzeuge.get(andere.vehicleId)?.plate ?? "";
        return { ok: false, fehler: T.personBelegt(name, tagLabel(schichtTag(andere)), plate, ...zeitraumText(andere)) };
      }
    }
  }

  const mitScalamobil = wirksam.filter((o) => o.scalamobil);
  for (const s of neue) {
    if (!s.scalamobil) continue;
    if (kontext.scalamobilAnzahl < 1) return { ok: false, fehler: T.scalamobilKeins };
    const gleichzeitig = mitScalamobil.filter((o) => ueberlappt(o, s));
    if (maxGleichzeitig(gleichzeitig, s) + 1 > kontext.scalamobilAnzahl) {
      const belegt = gleichzeitig
        .map((o) => `${kontext.fahrzeuge.get(o.vehicleId)?.plate ?? ""} (${zeitraumText(o).join("–")})`)
        .join(", ");
      return { ok: false, fehler: T.scalamobilBelegt(tagLabel(schichtTag(s)), kontext.scalamobilAnzahl, belegt) };
    }
  }

  return { ok: true, schichten: neue };
}

export type Ersetzungsplan =
  | {
      ok: true;
      /** Schichten, die gelöscht werden (mit id). */
      loeschen: PlanSchicht[];
      /** Neue Schichten (ohne id). */
      anlegen: PlanSchicht[];
      /** Ganze Fahrzeug-Tage, die nicht geändert wurden (vergangen, oder Fehler im Modus UEBERSPRINGEN). */
      uebersprungen: Meldung[];
      /** Laufende Schichten, die unverändert stehen bleiben. */
      behalten: Meldung[];
      /** Der Plan nach allen Änderungen. */
      stand: PlanSchicht[];
    }
  | { ok: false; fehler: string };

/**
 * Plant alle Änderungen nacheinander gegen den aktuellen Bestand. Modus STRENG (Seitenfenster): der
 * erste Prüffehler bricht alles ab, nichts wird geändert. Modus UEBERSPRINGEN (Woche kopieren): ein
 * Fahrzeug-Tag mit Fehler bleibt, wie er ist, und wird gemeldet; die übrigen werden übernommen.
 */
export function ersetzungPlanen(params: {
  aenderungen: Aenderung[];
  bestand: PlanSchicht[];
  heuteIso: string;
  kontext: PlanKontext;
  modus: "STRENG" | "UEBERSPRINGEN";
}): Ersetzungsplan {
  const { aenderungen, heuteIso, kontext, modus } = params;
  let stand = [...params.bestand];
  const loeschen: PlanSchicht[] = [];
  const anlegen: PlanSchicht[] = [];
  const uebersprungen: Meldung[] = [];
  const behalten: Meldung[] = [];

  for (const a of aenderungen) {
    if (a.tagIso < heuteIso) {
      uebersprungen.push({ vehicleId: a.vehicleId, tagIso: a.tagIso, grund: T.vergangenerTag });
      continue;
    }
    const bisher = stand.filter((s) => s.vehicleId === a.vehicleId && schichtTag(s) === a.tagIso);
    const laufend = bisher.filter((s) => s.startedAt);
    const ersetzt = bisher.filter((s) => !s.startedAt);
    const uebrige = stand.filter((s) => !ersetzt.includes(s));
    const ergebnis = entwuerfePruefen(a.vehicleId, a.tagIso, a.entwuerfe, uebrige, kontext);
    if (!ergebnis.ok) {
      if (modus === "STRENG") return { ok: false, fehler: ergebnis.fehler };
      uebersprungen.push({ vehicleId: a.vehicleId, tagIso: a.tagIso, grund: ergebnis.fehler });
      continue;
    }
    for (const s of laufend) {
      behalten.push({ vehicleId: a.vehicleId, tagIso: a.tagIso, grund: T.laufendeSchicht(...zeitraumText(s)) });
    }
    for (const s of ersetzt) {
      // Eine in diesem Lauf neu angelegte Schicht wird wieder verworfen, statt sie zu löschen.
      const neuIndex = anlegen.indexOf(s);
      if (neuIndex >= 0) anlegen.splice(neuIndex, 1);
      else loeschen.push(s);
    }
    anlegen.push(...ergebnis.schichten);
    stand = [...uebrige, ...ergebnis.schichten];
  }
  return { ok: true, loeschen, anlegen, uebersprungen, behalten, stand };
}

/** Entwürfe aus vorhandenen Schichten (zum Kopieren einer Woche). */
function alsEntwurf(s: PlanSchicht): SchichtEntwurf {
  return {
    von: uhrzeitBerlin(s.start),
    bis: uhrzeitBerlin(s.end),
    fahrerId: s.driverId,
    beifahrerId: s.beifahrerId,
    scalamobil: s.scalamobil,
  };
}

/**
 * "Woche in nächste Woche kopieren" bzw. in eine beliebige Zielwoche: je Fahrzeug und Wochentag
 * wird der Zieltag durch die Schichten des Quelltags ersetzt (ein leerer Quelltag leert den
 * Zieltag). Mit `nurMonat` ("JJJJ-MM") werden nur Zieltage dieses Monats geändert.
 */
export function wocheKopierenAenderungen(params: {
  bestand: PlanSchicht[];
  quellMontagIso: string;
  zielMontagIso: string;
  fahrzeugIds: string[];
  nurMonat?: string;
}): Aenderung[] {
  const aenderungen: Aenderung[] = [];
  for (const vehicleId of params.fahrzeugIds) {
    for (let i = 0; i < 7; i++) {
      const quellTag = tagVerschieben(params.quellMontagIso, i);
      const zielTag = tagVerschieben(params.zielMontagIso, i);
      if (params.nurMonat && zielTag.slice(0, 7) !== params.nurMonat) continue;
      const quelle = params.bestand
        .filter((s) => s.vehicleId === vehicleId && schichtTag(s) === quellTag)
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      aenderungen.push({ vehicleId, tagIso: zielTag, entwuerfe: quelle.map(alsEntwurf) });
    }
  }
  return aenderungen;
}

/**
 * "Woche bis Monatsende wiederholen": der Monat ist der Monat des Donnerstags der Quellwoche (so
 * gehört jede Woche genau einem Monat, wie in der Vorschau). Zielwochen sind alle folgenden Wochen,
 * die noch Tage in diesem Monat haben.
 */
export function bisMonatsendeZielwochen(quellMontagIso: string): { monat: string; zielMontage: string[] } {
  const monat = tagVerschieben(quellMontagIso, 3).slice(0, 7);
  const zielMontage: string[] = [];
  for (let montag = tagVerschieben(quellMontagIso, 7); montag.slice(0, 7) === monat; montag = tagVerschieben(montag, 7)) {
    zielMontage.push(montag);
  }
  return { monat, zielMontage };
}

export function besatzungVonPlanSchicht(s: PlanSchicht, personen: Map<string, PlanPerson>): Besatzung {
  return {
    beifahrer: !!s.beifahrerId && !!personen.get(s.beifahrerId)?.active,
    scalamobil: s.scalamobil,
    fahrerEinweisung: !!personen.get(s.driverId)?.scalamobilEinweisung,
  };
}

export type PlanFahrt = {
  id: string;
  vehicleId: string | null;
  driverId: string | null;
  status: string;
  pickupAt: Date;
  anforderung: FahrtAnforderung;
};

/**
 * Welche zugewiesenen, noch nicht begonnenen Fahrten (DISPONIERT) verlieren durch die Änderung ihre
 * Schicht? Betroffen ist eine Fahrt, deren Abholzeit in einer wegfallenden Schicht ihres Fahrzeugs
 * lag und die danach keine Schicht desselben Fahrzeugs mit DEMSELBEN Fahrer und passender Besatzung
 * mehr hat (Zeit weggefallen, Fahrer gewechselt, Beifahrer oder Scalamobil entfernt).
 */
export function betroffeneFahrten(params: {
  fahrten: PlanFahrt[];
  entfernt: PlanSchicht[];
  stand: PlanSchicht[];
  kontext: PlanKontext;
}): PlanFahrt[] {
  const { fahrten, entfernt, stand, kontext } = params;
  const deckt = (s: PlanSchicht, f: PlanFahrt) => s.vehicleId === f.vehicleId && s.start <= f.pickupAt && f.pickupAt <= s.end;
  return fahrten
    .filter((f) => f.status === "DISPONIERT" && f.vehicleId && entfernt.some((s) => deckt(s, f)))
    .filter((f) => {
      const fahrzeug = kontext.fahrzeuge.get(f.vehicleId!);
      const weiterGedeckt = stand.some(
        (s) =>
          deckt(s, f) &&
          !s.unavailable &&
          s.driverId === f.driverId &&
          (!fahrzeug || besatzungPruefen(f.anforderung, fahrzeug, besatzungVonPlanSchicht(s, kontext.personen)).passt),
      );
      return !weiterGedeckt;
    })
    .sort((a, b) => a.pickupAt.getTime() - b.pickupAt.getTime());
}
