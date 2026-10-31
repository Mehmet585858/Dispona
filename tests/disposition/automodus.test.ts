import { describe, expect, it } from "vitest";
import {
  automodusStatusText,
  pruefeBesterVorschlag,
  pruefeFahrerImDienst,
  pruefeGpsOderBetriebshof,
  pruefeKeineProbleme,
  pruefeZeitfenster,
  sicherheitsbedingungenPruefen,
  type SicherheitsbedingungenEingabe,
} from "@/core/disposition/automodus";

const NACHTS = new Date("2026-06-15T02:00:00+02:00"); // Montagnacht
const TAGSUEBER = new Date("2026-06-15T14:00:00+02:00"); // Montagmittag
const WOCHENENDE_TAG = new Date("2026-06-20T14:00:00+02:00"); // Samstagmittag

function basisEingabe(): SicherheitsbedingungenEingabe {
  return {
    problems: [],
    bester: { zuSpaet: false, score: 10 },
    zweitbesterScore: 20,
    minMarge: 5,
    gpsAlterMinuten: 3,
    startetVomBetriebshof: false,
    schicht: { onBreak: false, unavailable: false, start: new Date("2026-06-15T00:00:00+02:00"), end: new Date("2026-06-15T23:59:00+02:00") },
    pickupAt: new Date("2026-06-15T02:30:00+02:00"),
    autoMode: "NACHTS_WOCHENENDE",
    jetzt: NACHTS,
    maxTageVoraus: 3,
  };
}

describe("pruefeKeineProbleme", () => {
  it("lässt eine Fahrt ohne Probleme zu", () => {
    expect(pruefeKeineProbleme([]).erlaubt).toBe(true);
  });
  it("blockiert bei gemeldeten Problemen", () => {
    expect(pruefeKeineProbleme(["ADRESSE_UNSICHER"]).erlaubt).toBe(false);
  });
});

describe("pruefeBesterVorschlag", () => {
  it("blockiert, wenn der beste Vorschlag zu spät kommt", () => {
    expect(pruefeBesterVorschlag({ zuSpaet: true, score: 10 }, 20, 5).erlaubt).toBe(false);
  });
  it("blockiert, wenn der Abstand zum zweitbesten zu klein ist", () => {
    expect(pruefeBesterVorschlag({ zuSpaet: false, score: 10 }, 12, 5).erlaubt).toBe(false);
  });
  it("lässt zu, wenn kein zweiter Kandidat existiert", () => {
    expect(pruefeBesterVorschlag({ zuSpaet: false, score: 10 }, null, 5).erlaubt).toBe(true);
  });
  it("lässt zu, wenn pünktlich und deutlich besser", () => {
    expect(pruefeBesterVorschlag({ zuSpaet: false, score: 10 }, 20, 5).erlaubt).toBe(true);
  });
});

describe("pruefeGpsOderBetriebshof", () => {
  it("lässt zu bei aktuellem GPS", () => {
    expect(pruefeGpsOderBetriebshof(5, false).erlaubt).toBe(true);
  });
  it("lässt zu, wenn das Fahrzeug vom Betriebshof startet, auch ohne GPS", () => {
    expect(pruefeGpsOderBetriebshof(null, true).erlaubt).toBe(true);
  });
  it("blockiert bei altem oder fehlendem GPS ohne Betriebshof-Start", () => {
    expect(pruefeGpsOderBetriebshof(15, false).erlaubt).toBe(false);
    expect(pruefeGpsOderBetriebshof(null, false).erlaubt).toBe(false);
  });
});

describe("pruefeFahrerImDienst", () => {
  const schicht = { onBreak: false, unavailable: false, start: new Date("2026-06-15T06:00:00+02:00"), end: new Date("2026-06-15T14:00:00+02:00") };
  it("lässt zu, wenn der Fahrer im Dienst ist", () => {
    expect(pruefeFahrerImDienst(schicht, new Date("2026-06-15T10:00:00+02:00")).erlaubt).toBe(true);
  });
  it("blockiert ohne Schicht", () => {
    expect(pruefeFahrerImDienst(undefined, new Date("2026-06-15T10:00:00+02:00")).erlaubt).toBe(false);
  });
  it("blockiert bei Pause", () => {
    expect(pruefeFahrerImDienst({ ...schicht, onBreak: true }, new Date("2026-06-15T10:00:00+02:00")).erlaubt).toBe(false);
  });
  it("blockiert, wenn ausgefallen", () => {
    expect(pruefeFahrerImDienst({ ...schicht, unavailable: true }, new Date("2026-06-15T10:00:00+02:00")).erlaubt).toBe(false);
  });
  it("blockiert außerhalb der Schichtzeit", () => {
    expect(pruefeFahrerImDienst(schicht, new Date("2026-06-15T18:00:00+02:00")).erlaubt).toBe(false);
  });
});

describe("pruefeZeitfenster", () => {
  it("blockiert immer, wenn Automodus aus ist", () => {
    expect(pruefeZeitfenster("AUS", NACHTS, NACHTS, 3).erlaubt).toBe(false);
  });
  it("NACHTS_WOCHENENDE lässt nachts zu", () => {
    expect(pruefeZeitfenster("NACHTS_WOCHENENDE", NACHTS, NACHTS, 3).erlaubt).toBe(true);
  });
  it("NACHTS_WOCHENENDE lässt am Wochenende tagsüber zu", () => {
    expect(pruefeZeitfenster("NACHTS_WOCHENENDE", WOCHENENDE_TAG, WOCHENENDE_TAG, 3).erlaubt).toBe(true);
  });
  it("NACHTS_WOCHENENDE blockiert werktags tagsüber", () => {
    expect(pruefeZeitfenster("NACHTS_WOCHENENDE", TAGSUEBER, TAGSUEBER, 3).erlaubt).toBe(false);
  });
  it("IMMER lässt auch werktags tagsüber zu", () => {
    expect(pruefeZeitfenster("IMMER", TAGSUEBER, TAGSUEBER, 3).erlaubt).toBe(true);
  });
  it("blockiert, wenn die Fahrt zu weit in der Zukunft liegt", () => {
    const inZehnTagen = new Date(NACHTS.getTime() + 10 * 24 * 60 * 60_000);
    expect(pruefeZeitfenster("IMMER", NACHTS, inZehnTagen, 3).erlaubt).toBe(false);
  });
});

describe("sicherheitsbedingungenPruefen", () => {
  it("erlaubt die automatische Disposition, wenn alles passt", () => {
    expect(sicherheitsbedingungenPruefen(basisEingabe()).erlaubt).toBe(true);
  });

  it("blockiert bei Problemen, auch wenn alles andere passt", () => {
    const eingabe = { ...basisEingabe(), problems: ["DOPPELBUCHUNG"] };
    const ergebnis = sicherheitsbedingungenPruefen(eingabe);
    expect(ergebnis.erlaubt).toBe(false);
    expect(ergebnis.grund).toContain("Probleme");
  });

  it("blockiert außerhalb des Zeitfensters", () => {
    const eingabe: SicherheitsbedingungenEingabe = { ...basisEingabe(), jetzt: TAGSUEBER, pickupAt: TAGSUEBER };
    expect(sicherheitsbedingungenPruefen(eingabe).erlaubt).toBe(false);
  });
});

describe("automodusStatusText", () => {
  it("zeigt aus, wenn der Automodus ausgeschaltet ist", () => {
    expect(automodusStatusText("AUS", TAGSUEBER)).toBe("Automodus: aus");
  });
  it("zeigt immer aktiv bei IMMER", () => {
    expect(automodusStatusText("IMMER", TAGSUEBER)).toBe("Automodus: immer aktiv");
  });
  it("zeigt aktiv bis 6 Uhr nachts bei NACHTS_WOCHENENDE", () => {
    expect(automodusStatusText("NACHTS_WOCHENENDE", NACHTS)).toBe("Automodus: aktiv bis 6:00 Uhr");
  });
  it("zeigt aktiv am Wochenende", () => {
    expect(automodusStatusText("NACHTS_WOCHENENDE", WOCHENENDE_TAG)).toBe("Automodus: aktiv (Wochenende)");
  });
  it("zeigt aus werktags tagsüber bei NACHTS_WOCHENENDE", () => {
    expect(automodusStatusText("NACHTS_WOCHENENDE", TAGSUEBER)).toContain("aus");
  });
});

/**
 * Maßnahme M-17 (Prüfbericht S2-003): GPS-Frische (≤ 10 Min) gilt nur für Sofort-Disposition
 * (Abholung in < 60 Minuten). Für Vorausplanung startet das Fahrzeug am Betriebshof bzw. am Ziel
 * der vorherigen geplanten Fahrt – das rechnet die Vorschlagsberechnung bereits so.
 */
describe("pruefeGpsOderBetriebshof – Vorausplanung (M-17)", () => {
  it("M-17: Fahrt in 3 Stunden ohne GPS und nicht vom Betriebshof → erlaubt (Vorausplanung)", () => {
    expect(pruefeGpsOderBetriebshof(null, false, 180).erlaubt).toBe(true);
  });
  it("M-17: Fahrt in 30 Minuten ohne GPS → weiterhin blockiert (Sofort-Disposition)", () => {
    expect(pruefeGpsOderBetriebshof(null, false, 30).erlaubt).toBe(false);
    expect(pruefeGpsOderBetriebshof(15, false, 59).erlaubt).toBe(false);
  });
  it("M-17: sicherheitsbedingungenPruefen nachts um 3 Uhr für eine Fahrt am nächsten Morgen ohne GPS → erlaubt", () => {
    const eingabe = basisEingabe();
    eingabe.gpsAlterMinuten = null;
    eingabe.startetVomBetriebshof = false;
    eingabe.jetzt = new Date("2026-06-15T03:00:00+02:00");
    eingabe.pickupAt = new Date("2026-06-15T08:00:00+02:00");
    expect(sicherheitsbedingungenPruefen(eingabe).erlaubt).toBe(true);
  });
});
