import { describe, expect, it } from "vitest";
import { kennzahlenBerechnen, type KennzahlenEingabe } from "@/core/auswertung/kennzahlen";

function leer(): KennzahlenEingabe {
  return {
    anrufe: [],
    erfassteFahrtenHabenProbleme: [],
    entschiedeneVorschlaege: [],
    disponierteFahrten: [],
    fahrtenMitTermin: [],
  };
}

describe("kennzahlenBerechnen", () => {
  it("liefert überall null, wenn es in der Woche keine Daten gibt", () => {
    const ergebnis = kennzahlenBerechnen(leer());
    expect(ergebnis).toEqual({
      anrufeGesamt: 0,
      vollstaendigErfasstQuote: null,
      vorschlaegeUnveraendertQuote: null,
      automatischDisponiertQuote: null,
      puenktlichkeitQuote: null,
      weiterleitungenQuote: null,
    });
  });

  it("berechnet 'vollständig erfasst' als Anteil problemfreier Fahrten an allen Anrufen", () => {
    const eingabe = leer();
    eingabe.anrufe = [{ outcome: "FAHRT_ERFASST" }, { outcome: "FAHRT_ERFASST" }, { outcome: "ABGEBROCHEN" }];
    eingabe.erfassteFahrtenHabenProbleme = [false, true]; // 2 Fahrten erfasst, 1 davon mit Problem
    expect(kennzahlenBerechnen(eingabe).vollstaendigErfasstQuote).toBeCloseTo(33.3, 1);
  });

  it("berechnet 'Vorschläge unverändert übernommen' nur über entschiedene Vorschläge", () => {
    const eingabe = leer();
    eingabe.entschiedeneVorschlaege = [{ decision: "ANGENOMMEN" }, { decision: "ANGENOMMEN" }, { decision: "GEAENDERT" }];
    expect(kennzahlenBerechnen(eingabe).vorschlaegeUnveraendertQuote).toBeCloseTo(66.7, 1);
  });

  it("berechnet 'automatisch disponiert' über alle disponierten Fahrten", () => {
    const eingabe = leer();
    eingabe.disponierteFahrten = [{ dispatchMode: "AUTO" }, { dispatchMode: "AUTO" }, { dispatchMode: "MANUELL" }, { dispatchMode: "MANUELL" }];
    expect(kennzahlenBerechnen(eingabe).automatischDisponiertQuote).toBe(50);
  });

  it("berechnet Pünktlichkeit nur über Fahrten mit Termin", () => {
    const eingabe = leer();
    eingabe.fahrtenMitTermin = [{ puenktlich: true }, { puenktlich: true }, { puenktlich: true }, { puenktlich: false }];
    expect(kennzahlenBerechnen(eingabe).puenktlichkeitQuote).toBe(75);
  });

  it("berechnet Weiterleitungen über alle Anrufe", () => {
    const eingabe = leer();
    eingabe.anrufe = [{ outcome: "WEITERGELEITET" }, { outcome: "FAHRT_ERFASST" }, { outcome: "FAHRT_ERFASST" }, { outcome: "FAHRT_ERFASST" }];
    expect(kennzahlenBerechnen(eingabe).weiterleitungenQuote).toBe(25);
    expect(kennzahlenBerechnen(eingabe).anrufeGesamt).toBe(4);
  });
});
