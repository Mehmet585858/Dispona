import { describe, expect, it } from "vitest";
import {
  besatzungAusSchicht,
  besatzungKann,
  besatzungPruefen,
  besatzungsEtiketten,
  fahrtAnforderung,
  type Besatzung,
} from "@/core/shifts/besatzung";
import { BESATZUNG_TEXTE } from "@/core/shifts/texte";

/** Schichtplan (02.11.2026): "Was kann diese Besatzung?" – Regeln aus docs/05-disposition.md. */
const SITZEND = { wheelchairSpots: 0, carryChair: false, stretcher: false };
const ROLLSTUHL = { wheelchairSpots: 1, carryChair: false, stretcher: false };
const TRAGESTUHL = { wheelchairSpots: 0, carryChair: true, stretcher: false };
const LIEGEND = { wheelchairSpots: 0, carryChair: false, stretcher: true };

const allein: Besatzung = { beifahrer: false, scalamobil: false, fahrerEinweisung: false };
const zuZweit: Besatzung = { beifahrer: true, scalamobil: false, fahrerEinweisung: false };
const scalamobilEingewiesen: Besatzung = { beifahrer: false, scalamobil: true, fahrerEinweisung: true };
const scalamobilOhneEinweisung: Besatzung = { beifahrer: false, scalamobil: true, fahrerEinweisung: false };

describe("besatzungKann", () => {
  it("Liegend nur mit Trage UND 2 Personen", () => {
    expect(besatzungKann(LIEGEND, allein).liegend).toBe(false);
    expect(besatzungKann(LIEGEND, zuZweit).liegend).toBe(true);
    expect(besatzungKann(TRAGESTUHL, zuZweit).liegend).toBe(false);
  });

  it("Treppe: zu zweit nur mit Tragestuhl, mit Scalamobil auch auf Rollstuhlplatz-Fahrzeugen", () => {
    expect(besatzungKann(TRAGESTUHL, zuZweit).treppe).toBe("ZWEI_PERSONEN");
    expect(besatzungKann(ROLLSTUHL, zuZweit).treppe).toBe("NUR_EBENERDIG");
    expect(besatzungKann(ROLLSTUHL, scalamobilEingewiesen).treppe).toBe("SCALAMOBIL");
    expect(besatzungKann(TRAGESTUHL, scalamobilEingewiesen).treppe).toBe("SCALAMOBIL");
    expect(besatzungKann(TRAGESTUHL, scalamobilOhneEinweisung).treppe).toBe("NUR_EBENERDIG");
    expect(besatzungKann(SITZEND, scalamobilEingewiesen).treppe).toBe("NUR_EBENERDIG");
  });
});

describe("besatzungsEtiketten (wie in der Vorschau)", () => {
  it("Liegend-Fahrzeug: möglich mit 2 Personen, sonst Warnung", () => {
    expect(besatzungsEtiketten(LIEGEND, zuZweit)).toEqual([{ ton: "ok", text: BESATZUNG_TEXTE.etikettLiegendOk }]);
    expect(besatzungsEtiketten(LIEGEND, allein)).toEqual([{ ton: "warn", text: BESATZUNG_TEXTE.etikettLiegendFehlt }]);
  });

  it("BTW: Treppe mit 2 Personen / mit Scalamobil / Fahrer ohne Einweisung / nur ebenerdig", () => {
    expect(besatzungsEtiketten(TRAGESTUHL, zuZweit)[0]).toEqual({ ton: "ok", text: BESATZUNG_TEXTE.etikettTreppeZwei });
    expect(besatzungsEtiketten(ROLLSTUHL, scalamobilEingewiesen)[0]).toEqual({ ton: "ok", text: BESATZUNG_TEXTE.etikettTreppeScalamobil });
    expect(besatzungsEtiketten(ROLLSTUHL, scalamobilOhneEinweisung)[0]).toEqual({
      ton: "warn",
      text: BESATZUNG_TEXTE.etikettScalamobilOhneEinweisung,
    });
    expect(besatzungsEtiketten(TRAGESTUHL, allein)[0]).toEqual({ ton: "neutral", text: BESATZUNG_TEXTE.etikettNurEbenerdig });
  });

  it("Sitzend-Fahrzeug bekommt kein Etikett", () => {
    expect(besatzungsEtiketten(SITZEND, zuZweit)).toEqual([]);
  });
});

describe("besatzungPruefen", () => {
  const liegend = { transportType: "LIEGEND" as const, treppe: false };
  const trageTreppe = { transportType: "TRAGESTUHL" as const, treppe: true };
  const trageEben = { transportType: "TRAGESTUHL" as const, treppe: false };

  it("Liegend-Fahrt ohne Beifahrer wird mit klarer Meldung abgelehnt", () => {
    expect(besatzungPruefen(liegend, LIEGEND, allein)).toEqual({ passt: false, grund: BESATZUNG_TEXTE.liegendOhneBeifahrer });
    expect(besatzungPruefen(liegend, LIEGEND, zuZweit).passt).toBe(true);
  });

  it("Tragestuhl mit Treppe: 2 Personen mit Tragestuhl oder Scalamobil mit Einweisung", () => {
    expect(besatzungPruefen(trageTreppe, TRAGESTUHL, zuZweit).passt).toBe(true);
    expect(besatzungPruefen(trageTreppe, ROLLSTUHL, scalamobilEingewiesen).passt).toBe(true);
    expect(besatzungPruefen(trageTreppe, TRAGESTUHL, allein)).toEqual({ passt: false, grund: BESATZUNG_TEXTE.treppeOhneBesatzung });
    expect(besatzungPruefen(trageTreppe, ROLLSTUHL, scalamobilOhneEinweisung)).toEqual({
      passt: false,
      grund: BESATZUNG_TEXTE.treppeScalamobilOhneEinweisung,
    });
    expect(besatzungPruefen(trageTreppe, ROLLSTUHL, zuZweit)).toEqual({ passt: false, grund: BESATZUNG_TEXTE.treppeOhneTragestuhl });
  });

  it("Tragestuhl ebenerdig, Sitzend und Rollstuhl brauchen keine zweite Person", () => {
    expect(besatzungPruefen(trageEben, ROLLSTUHL, allein).passt).toBe(true);
    expect(besatzungPruefen({ transportType: "SITZEND", treppe: true }, SITZEND, allein).passt).toBe(true);
    expect(besatzungPruefen({ transportType: "ROLLSTUHL", treppe: true }, ROLLSTUHL, allein).passt).toBe(true);
  });

  it("nur ein AKTIVER Beifahrer zählt; Treppe am Abhol- ODER Zielort", () => {
    const schicht = { scalamobil: false, driver: { scalamobilEinweisung: false }, beifahrer: { active: false } };
    expect(besatzungAusSchicht(schicht).beifahrer).toBe(false);
    expect(besatzungAusSchicht({ ...schicht, beifahrer: { active: true } }).beifahrer).toBe(true);
    expect(besatzungAusSchicht({ ...schicht, beifahrer: null }).beifahrer).toBe(false);
    expect(fahrtAnforderung({ transportType: "TRAGESTUHL", pickupPlace: { treppe: false }, dropoffPlace: { treppe: true } }).treppe).toBe(true);
    expect(fahrtAnforderung({ transportType: "TRAGESTUHL", pickupPlace: { treppe: false }, dropoffPlace: { treppe: false } }).treppe).toBe(false);
  });
});
