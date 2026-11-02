import { describe, expect, it } from "vitest";
import {
  betroffeneFahrten,
  bisMonatsendeZielwochen,
  entwuerfePruefen,
  ersetzungPlanen,
  scalamobilHoechstbelegung,
  wocheKopierenAenderungen,
  zielTage,
  type PlanKontext,
  type PlanSchicht,
  type SchichtEntwurf,
} from "@/core/shifts/schichtplan";
import { schichtZeitraum } from "@/core/shifts/dauer";
import { berlinerMitternacht, mitUhrzeit, uhrzeitBerlin } from "@/core/shifts/week";
import { SCHICHTPLAN_TEXTE as T } from "@/core/shifts/texte";

/** Schichtplan (02.11.2026): Prüfungen beim Speichern, "Gilt für", Woche kopieren, betroffene Fahrten. */
const kontext = (scalamobilAnzahl = 1): PlanKontext => ({
  personen: new Map([
    ["albers", { id: "albers", name: "Jana Albers", active: true, scalamobilEinweisung: true }],
    ["brandt", { id: "brandt", name: "Tobias Brandt", active: true, scalamobilEinweisung: false }],
    ["becker", { id: "becker", name: "Nils Becker", active: true, scalamobilEinweisung: false }],
    ["weg", { id: "weg", name: "Ex Kollege", active: false, scalamobilEinweisung: false }],
  ]),
  fahrzeuge: new Map([
    ["v101", { id: "v101", plate: "AC-MK 101", wheelchairSpots: 0, carryChair: false, stretcher: false }],
    ["v201", { id: "v201", plate: "AC-MK 201", wheelchairSpots: 1, carryChair: false, stretcher: false }],
    ["v301", { id: "v301", plate: "AC-MK 301", wheelchairSpots: 0, carryChair: true, stretcher: false }],
    ["v401", { id: "v401", plate: "AC-MK 401", wheelchairSpots: 0, carryChair: false, stretcher: true }],
  ]),
  scalamobilAnzahl,
});

function schicht(vehicleId: string, tagIso: string, von: string, bis: string, extra: Partial<PlanSchicht> = {}): PlanSchicht {
  return {
    id: `${vehicleId}-${tagIso}-${von}`,
    vehicleId,
    driverId: "albers",
    beifahrerId: null,
    scalamobil: false,
    ...schichtZeitraum(berlinerMitternacht(tagIso), von, bis),
    ...extra,
  };
}

const entwurf = (extra: Partial<SchichtEntwurf> = {}): SchichtEntwurf => ({
  von: "06:00",
  bis: "14:00",
  fahrerId: "brandt",
  beifahrerId: null,
  scalamobil: false,
  ...extra,
});

describe("zielTage – Gilt für", () => {
  it("nur dieser Tag / Montag bis Freitag dieser Woche", () => {
    expect(zielTage("2026-11-04", "TAG")).toEqual(["2026-11-04"]);
    expect(zielTage("2026-11-04", "WOCHE")).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
  });

  it("jeden gleichen Wochentag im Monat / alle Werktage im Monat (November 2026)", () => {
    expect(zielTage("2026-11-04", "WOCHENTAG_MONAT")).toEqual(["2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25"]);
    const werktage = zielTage("2026-11-04", "WERKTAGE_MONAT");
    expect(werktage).toHaveLength(21);
    expect(werktage).not.toContain("2026-11-07");
    expect(werktage[0]).toBe("2026-11-02");
    expect(werktage.at(-1)).toBe("2026-11-30");
  });

  it("Woche über den Monatswechsel bleibt Montag bis Freitag derselben Woche", () => {
    expect(zielTage("2026-12-31", "WOCHE")).toEqual(["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01"]);
  });
});

describe("entwuerfePruefen – Prüfungen beim Speichern", () => {
  const tag = "2026-11-10";

  it("Fahrer muss gesetzt sein, Zeiten gültig und nicht gleich", () => {
    expect(entwuerfePruefen("v101", tag, [entwurf({ fahrerId: "" })], [], kontext())).toEqual({ ok: false, fehler: T.fahrerFehlt });
    expect(entwuerfePruefen("v101", tag, [entwurf({ von: "halb acht" })], [], kontext())).toEqual({ ok: false, fehler: T.zeitUngueltig });
    expect(entwuerfePruefen("v101", tag, [entwurf({ bis: "06:00" })], [], kontext())).toEqual({ ok: false, fehler: T.zeitGleich });
  });

  it("Ende vor Beginn = Nachtschicht bis zum Folgetag (M-18)", () => {
    const ergebnis = entwuerfePruefen("v101", tag, [entwurf({ von: "22:00", bis: "06:00" })], [], kontext());
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.schichten[0].end.toISOString()).toBe(mitUhrzeit(berlinerMitternacht("2026-11-11"), "06:00").toISOString());
  });

  it("Fahrer ≠ Beifahrer, deaktivierte und unbekannte Personen werden abgewiesen", () => {
    expect(entwuerfePruefen("v101", tag, [entwurf({ beifahrerId: "brandt" })], [], kontext())).toEqual({
      ok: false,
      fehler: T.fahrerGleichBeifahrer,
    });
    expect(entwuerfePruefen("v101", tag, [entwurf({ beifahrerId: "weg" })], [], kontext())).toEqual({
      ok: false,
      fehler: T.deaktiviert("Ex Kollege"),
    });
    expect(entwuerfePruefen("v101", tag, [entwurf({ fahrerId: "fremd" })], [], kontext())).toEqual({ ok: false, fehler: T.personUnbekannt });
    expect(entwuerfePruefen("fremd", tag, [entwurf()], [], kontext())).toEqual({ ok: false, fehler: T.fahrzeugUnbekannt });
  });

  it("mehrere Schichten am Tag dürfen sich nicht überschneiden; die Meldung nennt die Nummer", () => {
    const ergebnis = entwuerfePruefen("v101", tag, [entwurf(), entwurf({ von: "13:00", bis: "18:00", fahrerId: "becker" })], [], kontext());
    expect(ergebnis).toEqual({ ok: false, fehler: T.ueberschneidungEntwurf(1, 2) });
    expect(entwuerfePruefen("v101", tag, [entwurf(), entwurf({ fahrerId: "", von: "14:00", bis: "18:00" })], [], kontext())).toEqual({
      ok: false,
      fehler: T.mitSchichtNummer(2, T.fahrerFehlt),
    });
    // Aneinander anschließend ist erlaubt.
    expect(entwuerfePruefen("v101", tag, [entwurf(), entwurf({ von: "14:00", bis: "20:00", fahrerId: "becker" })], [], kontext()).ok).toBe(true);
  });

  it("Fahrzeug: keine Überschneidung mit einer Nachtschicht vom Vortag", () => {
    const nacht = schicht("v101", "2026-11-09", "22:00", "07:00", { driverId: "becker" });
    const ergebnis = entwuerfePruefen("v101", tag, [entwurf()], [nacht], kontext());
    expect(ergebnis).toEqual({ ok: false, fehler: T.fahrzeugBelegt("AC-MK 101", "Montag, 09.11.", "22:00", "07:00") });
  });

  it("Person nicht doppelt verplant – weder als Fahrer noch als Beifahrer, über alle Fahrzeuge", () => {
    const andere = schicht("v301", tag, "08:00", "16:00", { driverId: "becker", beifahrerId: "brandt" });
    expect(entwuerfePruefen("v101", tag, [entwurf()], [andere], kontext())).toEqual({
      ok: false,
      fehler: T.personBelegt("Tobias Brandt", "Dienstag, 10.11.", "AC-MK 301", "08:00", "16:00"),
    });
    expect(entwuerfePruefen("v101", tag, [entwurf({ fahrerId: "albers", beifahrerId: "becker" })], [andere], kontext())).toEqual({
      ok: false,
      fehler: T.personBelegt("Nils Becker", "Dienstag, 10.11.", "AC-MK 301", "08:00", "16:00"),
    });
    // Nach Schichtende darf dieselbe Person weiterfahren.
    expect(entwuerfePruefen("v101", tag, [entwurf({ von: "16:00", bis: "20:00" })], [andere], kontext()).ok).toBe(true);
  });

  it("ausgefallene Schichten blockieren nicht (Ersatzfahrer auf demselben Fahrzeug, M-72)", () => {
    const ausgefallen = schicht("v101", tag, "06:00", "14:00", { driverId: "becker", unavailable: true });
    expect(entwuerfePruefen("v101", tag, [entwurf()], [ausgefallen], kontext()).ok).toBe(true);
  });

  it("Scalamobil: Anzahl eingehalten, nur auf Fahrzeugen mit Tragestuhl oder Rollstuhlplatz", () => {
    const mitGeraet = schicht("v201", tag, "08:00", "16:00", { driverId: "becker", scalamobil: true });
    expect(entwuerfePruefen("v301", tag, [entwurf({ scalamobil: true })], [mitGeraet], kontext(1))).toEqual({
      ok: false,
      fehler: T.scalamobilBelegt("Dienstag, 10.11.", 1, "AC-MK 201 (08:00–16:00)"),
    });
    expect(entwuerfePruefen("v301", tag, [entwurf({ scalamobil: true })], [mitGeraet], kontext(2)).ok).toBe(true);
    expect(entwuerfePruefen("v301", tag, [entwurf({ scalamobil: true, von: "16:00", bis: "20:00" })], [mitGeraet], kontext(1)).ok).toBe(true);
    expect(entwuerfePruefen("v301", tag, [entwurf({ scalamobil: true })], [], kontext(0))).toEqual({ ok: false, fehler: T.scalamobilKeins });
    expect(entwuerfePruefen("v101", tag, [entwurf({ scalamobil: true })], [], kontext(1))).toEqual({ ok: false, fehler: T.scalamobilFahrzeug });
  });

  it("Scalamobil bei 2 Geräten: drei gleichzeitige Schichten sind zu viel, zwei nacheinander nicht", () => {
    const a = schicht("v201", tag, "06:00", "10:00", { driverId: "becker", scalamobil: true });
    const b = schicht("v401", tag, "10:00", "14:00", { driverId: "albers", scalamobil: true });
    // a und b laufen nie gleichzeitig: mit der neuen Schicht höchstens 2 auf einmal.
    expect(entwuerfePruefen("v301", tag, [entwurf({ scalamobil: true })], [a, b], kontext(2)).ok).toBe(true);
    const c = schicht("v101", tag, "09:00", "11:00", { driverId: "albers", scalamobil: true });
    expect(entwuerfePruefen("v301", tag, [entwurf({ scalamobil: true })], [a, c], kontext(2)).ok).toBe(false);
  });
});

describe("ersetzungPlanen – ersetzen je Fahrzeug und Tag", () => {
  const heute = "2026-11-10";

  it("ersetzt die Schichten des Tages, lässt andere Fahrzeuge und Tage stehen", () => {
    const alt = schicht("v101", heute, "06:00", "14:00", { driverId: "becker" });
    const morgen = schicht("v101", "2026-11-11", "06:00", "14:00", { driverId: "becker" });
    const plan = ersetzungPlanen({
      aenderungen: [{ vehicleId: "v101", tagIso: heute, entwuerfe: [entwurf()] }],
      bestand: [alt, morgen],
      heuteIso: heute,
      kontext: kontext(),
      modus: "STRENG",
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.loeschen).toEqual([alt]);
    expect(plan.anlegen).toHaveLength(1);
    expect(plan.stand).toContain(morgen);
  });

  it("nie vergangene Tage oder begonnene Schichten überschreiben – übersprungen und gemeldet", () => {
    const gestern = schicht("v101", "2026-11-09", "06:00", "14:00", { driverId: "becker" });
    const laeuft = schicht("v101", heute, "06:00", "10:00", { driverId: "becker", startedAt: mitUhrzeit(berlinerMitternacht(heute), "06:02") });
    const plan = ersetzungPlanen({
      aenderungen: [
        { vehicleId: "v101", tagIso: "2026-11-09", entwuerfe: [] },
        { vehicleId: "v101", tagIso: heute, entwuerfe: [entwurf({ von: "10:00", bis: "18:00" })] },
      ],
      bestand: [gestern, laeuft],
      heuteIso: heute,
      kontext: kontext(),
      modus: "STRENG",
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.loeschen).toEqual([]);
    expect(plan.uebersprungen).toEqual([{ vehicleId: "v101", tagIso: "2026-11-09", grund: T.vergangenerTag }]);
    expect(plan.behalten).toEqual([{ vehicleId: "v101", tagIso: heute, grund: T.laufendeSchicht("06:00", "10:00") }]);
    expect(plan.stand).toContain(gestern);
    expect(plan.stand).toContain(laeuft);
  });

  it("eine neue Schicht über eine laufende hinweg wird abgelehnt", () => {
    const laeuft = schicht("v101", heute, "06:00", "14:00", { driverId: "becker", startedAt: new Date() });
    const plan = ersetzungPlanen({
      aenderungen: [{ vehicleId: "v101", tagIso: heute, entwuerfe: [entwurf({ von: "12:00", bis: "18:00" })] }],
      bestand: [laeuft],
      heuteIso: heute,
      kontext: kontext(),
      modus: "STRENG",
    });
    expect(plan.ok).toBe(false);
  });

  it("STRENG bricht beim ersten Fehler ab, UEBERSPRINGEN meldet den Tag und macht weiter", () => {
    const belegt = schicht("v301", "2026-11-12", "06:00", "14:00", { driverId: "brandt" });
    const aenderungen = ["2026-11-11", "2026-11-12", "2026-11-13"].map((tagIso) => ({ vehicleId: "v101", tagIso, entwuerfe: [entwurf()] }));
    const streng = ersetzungPlanen({ aenderungen, bestand: [belegt], heuteIso: heute, kontext: kontext(), modus: "STRENG" });
    expect(streng).toEqual({ ok: false, fehler: T.personBelegt("Tobias Brandt", "Donnerstag, 12.11.", "AC-MK 301", "06:00", "14:00") });
    const weich = ersetzungPlanen({ aenderungen, bestand: [belegt], heuteIso: heute, kontext: kontext(), modus: "UEBERSPRINGEN" });
    expect(weich.ok).toBe(true);
    if (!weich.ok) return;
    expect(weich.anlegen).toHaveLength(2);
    expect(weich.uebersprungen.map((m) => m.tagIso)).toEqual(["2026-11-12"]);
  });
});

describe("Woche kopieren und bis Monatsende wiederholen", () => {
  it("kopiert je Fahrzeug und Wochentag, ein leerer Quelltag leert den Zieltag", () => {
    const bestand = [
      schicht("v101", "2026-11-09", "06:00", "14:00", { beifahrerId: "becker", scalamobil: false }),
      schicht("v101", "2026-11-17", "08:00", "12:00", { driverId: "brandt" }),
    ];
    const aenderungen = wocheKopierenAenderungen({ bestand, quellMontagIso: "2026-11-09", zielMontagIso: "2026-11-16", fahrzeugIds: ["v101"] });
    expect(aenderungen).toHaveLength(7);
    expect(aenderungen[0]).toEqual({
      vehicleId: "v101",
      tagIso: "2026-11-16",
      entwuerfe: [{ von: "06:00", bis: "14:00", fahrerId: "albers", beifahrerId: "becker", scalamobil: false }],
    });
    expect(aenderungen[1]).toEqual({ vehicleId: "v101", tagIso: "2026-11-17", entwuerfe: [] });
    const plan = ersetzungPlanen({ aenderungen, bestand, heuteIso: "2026-11-10", kontext: kontext(), modus: "UEBERSPRINGEN" });
    expect(plan.ok && plan.loeschen.map((s) => s.id)).toEqual([bestand[1].id]);
  });

  it("bis Monatsende: Monat des Donnerstags, nur Zieltage in diesem Monat", () => {
    expect(bisMonatsendeZielwochen("2026-11-02")).toEqual({ monat: "2026-11", zielMontage: ["2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"] });
    expect(bisMonatsendeZielwochen("2026-11-30")).toEqual({ monat: "2026-12", zielMontage: ["2026-12-07", "2026-12-14", "2026-12-21", "2026-12-28"] });
    expect(bisMonatsendeZielwochen("2026-11-23").zielMontage).toEqual(["2026-11-30"]);
    const aenderungen = wocheKopierenAenderungen({
      bestand: [],
      quellMontagIso: "2026-11-23",
      zielMontagIso: "2026-11-30",
      fahrzeugIds: ["v101"],
      nurMonat: "2026-11",
    });
    expect(aenderungen.map((a) => a.tagIso)).toEqual(["2026-11-30"]);
  });
});

describe("betroffeneFahrten – Schicht ändern, wenn schon Fahrten darin liegen", () => {
  const tag = "2026-11-10";
  const alt = schicht("v401", tag, "06:00", "14:00", { driverId: "albers", beifahrerId: "becker" });
  const fahrt = (uhr: string, extra: Record<string, unknown> = {}) => ({
    id: `f-${uhr}`,
    vehicleId: "v401",
    driverId: "albers",
    status: "DISPONIERT",
    pickupAt: mitUhrzeit(berlinerMitternacht(tag), uhr),
    anforderung: { transportType: "SITZEND" as const, treppe: false },
    ...extra,
  });

  it("Fahrten in der wegfallenden Zeit sind betroffen, andere nicht", () => {
    const kuerzer = schicht("v401", tag, "06:00", "10:00", { driverId: "albers", beifahrerId: "becker" });
    const betroffen = betroffeneFahrten({
      fahrten: [fahrt("08:00"), fahrt("11:00"), fahrt("12:30"), fahrt("12:00", { status: "UNTERWEGS" })],
      entfernt: [alt],
      stand: [kuerzer],
      kontext: kontext(),
    });
    expect(betroffen.map((f) => uhrzeitBerlin(f.pickupAt))).toEqual(["11:00", "12:30"]);
  });

  it("Fahrerwechsel und entfernter Beifahrer (Liegend) machen Fahrten betroffen; Löschen alle", () => {
    const andererFahrer = schicht("v401", tag, "06:00", "14:00", { driverId: "brandt", beifahrerId: "becker" });
    expect(betroffeneFahrten({ fahrten: [fahrt("08:00")], entfernt: [alt], stand: [andererFahrer], kontext: kontext() })).toHaveLength(1);
    const ohneBeifahrer = schicht("v401", tag, "06:00", "14:00", { driverId: "albers" });
    const liegend = fahrt("09:00", { anforderung: { transportType: "LIEGEND", treppe: false } });
    expect(betroffeneFahrten({ fahrten: [fahrt("08:00"), liegend], entfernt: [alt], stand: [ohneBeifahrer], kontext: kontext() }).map((f) => f.id)).toEqual([
      "f-09:00",
    ]);
    expect(betroffeneFahrten({ fahrten: [fahrt("08:00"), liegend], entfernt: [alt], stand: [], kontext: kontext() })).toHaveLength(2);
  });
});

describe("scalamobilHoechstbelegung und Rückgängig-Stand", () => {
  it("zählt gleichzeitige Scalamobil-Schichten, ausgefallene nicht", () => {
    const tag = "2026-11-10";
    const a = schicht("v201", tag, "06:00", "12:00", { scalamobil: true });
    const b = schicht("v301", tag, "10:00", "14:00", { scalamobil: true, driverId: "brandt" });
    const c = schicht("v101", tag, "12:00", "16:00", { scalamobil: true, driverId: "becker" });
    expect(scalamobilHoechstbelegung([a, c])).toEqual({ anzahl: 1, tagIso: tag });
    expect(scalamobilHoechstbelegung([a, b, c]).anzahl).toBe(2);
    expect(scalamobilHoechstbelegung([a, { ...b, unavailable: true }]).anzahl).toBe(1);
    expect(scalamobilHoechstbelegung([])).toEqual({ anzahl: 0, tagIso: null });
  });

  it("ersetzungPlanen liefert den vorherigen Stand je Fahrzeug-Tag (einmal, vor der ersten Änderung)", () => {
    const alt = schicht("v101", "2026-11-11", "06:00", "14:00", { driverId: "becker", beifahrerId: "brandt" });
    const plan = ersetzungPlanen({
      aenderungen: [
        { vehicleId: "v101", tagIso: "2026-11-11", entwuerfe: [entwurf()] },
        { vehicleId: "v101", tagIso: "2026-11-11", entwuerfe: [entwurf({ von: "07:00" })] },
      ],
      bestand: [alt],
      heuteIso: "2026-11-10",
      kontext: kontext(),
      modus: "STRENG",
    });
    expect(plan.ok && plan.vorher).toEqual([
      { vehicleId: "v101", tagIso: "2026-11-11", entwuerfe: [{ von: "06:00", bis: "14:00", fahrerId: "becker", beifahrerId: "brandt", scalamobil: false }] },
    ]);
    expect(plan.ok && plan.anlegen).toHaveLength(1);
    expect(plan.ok && plan.loeschen).toEqual([alt]);
  });
});
