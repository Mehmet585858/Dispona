/**
 * Erfolgskennzahlen für eine Woche (docs/01-produkt.md "Erfolgskennzahlen im Pilot",
 * docs/09-bauplan.md Phase 10). Reine Berechnung aus schon geladenen Daten; null bedeutet
 * "in diesem Zeitraum keine Grundlage" statt eine irreführende 0 %.
 */
import type { CallOutcome, Decision } from "@/generated/prisma/enums";

export type KennzahlenEingabe = {
  anrufe: { outcome: CallOutcome | null }[];
  /** Fahrten mit outcome FAHRT_ERFASST: hat die Fahrt noch offene Probleme? */
  erfassteFahrtenHabenProbleme: boolean[];
  /** Vorschläge dieser Woche, deren Entscheidung schon feststeht (nicht mehr OFFEN). */
  entschiedeneVorschlaege: { decision: Decision }[];
  /** Fahrten dieser Woche mit zugewiesenem Fahrzeug. */
  disponierteFahrten: { dispatchMode: string | null }[];
  /** Erledigte Fahrten mit Termin, die sich auf Pünktlichkeit prüfen lassen. */
  fahrtenMitTermin: { puenktlich: boolean }[];
};

export type Kennzahlen = {
  anrufeGesamt: number;
  vollstaendigErfasstQuote: number | null;
  vorschlaegeUnveraendertQuote: number | null;
  automatischDisponiertQuote: number | null;
  puenktlichkeitQuote: number | null;
  weiterleitungenQuote: number | null;
};

function quote(zaehler: number, nenner: number): number | null {
  return nenner === 0 ? null : Math.round((zaehler / nenner) * 1000) / 10;
}

export function kennzahlenBerechnen(eingabe: KennzahlenEingabe): Kennzahlen {
  const anrufeGesamt = eingabe.anrufe.length;
  const ohneProbleme = eingabe.erfassteFahrtenHabenProbleme.filter((hatProbleme) => !hatProbleme).length;
  const weitergeleitet = eingabe.anrufe.filter((a) => a.outcome === "WEITERGELEITET").length;

  const angenommen = eingabe.entschiedeneVorschlaege.filter((v) => v.decision === "ANGENOMMEN").length;
  const automatisch = eingabe.disponierteFahrten.filter((f) => f.dispatchMode === "AUTO").length;
  const puenktlich = eingabe.fahrtenMitTermin.filter((f) => f.puenktlich).length;

  return {
    anrufeGesamt,
    // Nenner: alle Anrufe, nicht nur die mit Fahrt – ein Anruf ohne Fahrt zählt als nicht
    // vollständig erfasst.
    vollstaendigErfasstQuote: quote(ohneProbleme, anrufeGesamt),
    vorschlaegeUnveraendertQuote: quote(angenommen, eingabe.entschiedeneVorschlaege.length),
    automatischDisponiertQuote: quote(automatisch, eingabe.disponierteFahrten.length),
    puenktlichkeitQuote: quote(puenktlich, eingabe.fahrtenMitTermin.length),
    weiterleitungenQuote: quote(weitergeleitet, anrufeGesamt),
  };
}
