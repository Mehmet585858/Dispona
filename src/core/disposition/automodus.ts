/**
 * Sicherheitsbedingungen für den Automodus (docs/05-disposition.md). Reine Prüf-Funktionen ohne
 * Datenbankzugriff, damit sie einzeln testbar sind; die Datenbeschaffung macht
 * src/core/disposition/automatischDisponieren.ts.
 */
import type { AutoMode } from "@/generated/prisma/enums";
import { istNachtsInBerlin, istWochenendeInBerlin } from "@/core/shifts/zeitfenster";

export type Sicherheitscheck = { erlaubt: boolean; grund?: string };

const ok: Sicherheitscheck = { erlaubt: true };

/** Bedingung 1: Die Fahrt darf keine erkannten Probleme haben. */
export function pruefeKeineProbleme(problems: string[]): Sicherheitscheck {
  if (problems.length > 0) return { erlaubt: false, grund: `Probleme gemeldet: ${problems.join(", ")}` };
  return ok;
}

/**
 * Bedingung 2: Der beste Vorschlag muss pünktlich sein und mindestens `minMarge` Punkte besser
 * als der zweitbeste (kleinerer Score = besser). Gibt es keinen zweiten Kandidaten, zählt die
 * Marge als erfüllt.
 */
export function pruefeBesterVorschlag(
  bester: { zuSpaet: boolean; score: number },
  zweitbesterScore: number | null,
  minMarge: number,
): Sicherheitscheck {
  if (bester.zuSpaet) return { erlaubt: false, grund: "Bester Vorschlag kommt zu spät zum Termin" };
  if (zweitbesterScore !== null && zweitbesterScore - bester.score < minMarge) {
    return { erlaubt: false, grund: "Bester Vorschlag ist nicht deutlich besser als die Alternative" };
  }
  return ok;
}

/** Bedingung 3: GPS des Fahrzeugs ist aktuell (≤10 Min), oder es startet ohne vorherige Fahrt heute vom Betriebshof. */
export function pruefeGpsOderBetriebshof(gpsAlterMinuten: number | null, startetVomBetriebshof: boolean): Sicherheitscheck {
  if (startetVomBetriebshof) return ok;
  if (gpsAlterMinuten !== null && gpsAlterMinuten <= 10) return ok;
  return { erlaubt: false, grund: "Kein aktueller Standort des Fahrzeugs" };
}

/** Bedingung 4: Der Fahrer muss zur Abholzeit im Dienst sein, ohne Pause. */
export function pruefeFahrerImDienst(
  schicht: { onBreak: boolean; unavailable: boolean; start: Date; end: Date } | undefined,
  pickupAt: Date,
): Sicherheitscheck {
  if (!schicht) return { erlaubt: false, grund: "Fahrer ist zur Abholzeit nicht im Dienst" };
  if (schicht.unavailable) return { erlaubt: false, grund: "Fahrer ist ausgefallen" };
  if (schicht.onBreak) return { erlaubt: false, grund: "Fahrer hat Pause" };
  if (schicht.start > pickupAt || schicht.end < pickupAt) {
    return { erlaubt: false, grund: "Fahrer ist zur Abholzeit nicht im Dienst" };
  }
  return ok;
}

/** Bedingung 5: Die Fahrt muss im Zeitfenster des Automodus liegen und höchstens `maxTageVoraus` Tage in der Zukunft. */
export function pruefeZeitfenster(
  autoMode: AutoMode,
  jetzt: Date,
  pickupAt: Date,
  maxTageVoraus: number,
): Sicherheitscheck {
  if (autoMode === "AUS") return { erlaubt: false, grund: "Automodus ist ausgeschaltet" };
  if (autoMode === "NACHTS_WOCHENENDE" && !istNachtsInBerlin(jetzt) && !istWochenendeInBerlin(jetzt)) {
    return { erlaubt: false, grund: "Außerhalb des Zeitfensters (nur nachts und am Wochenende)" };
  }
  const tageVoraus = (pickupAt.getTime() - jetzt.getTime()) / (24 * 60 * 60_000);
  if (tageVoraus > maxTageVoraus) {
    return { erlaubt: false, grund: `Fahrt liegt mehr als ${maxTageVoraus} Tage in der Zukunft` };
  }
  return ok;
}

export type SicherheitsbedingungenEingabe = {
  problems: string[];
  bester: { zuSpaet: boolean; score: number };
  zweitbesterScore: number | null;
  minMarge: number;
  gpsAlterMinuten: number | null;
  startetVomBetriebshof: boolean;
  schicht: { onBreak: boolean; unavailable: boolean; start: Date; end: Date } | undefined;
  pickupAt: Date;
  autoMode: AutoMode;
  jetzt: Date;
  maxTageVoraus: number;
};

/** Prüft alle 5 Sicherheitsbedingungen der Reihe nach, gibt die erste Verletzung zurück. */
export function sicherheitsbedingungenPruefen(eingabe: SicherheitsbedingungenEingabe): Sicherheitscheck {
  const pruefungen = [
    () => pruefeKeineProbleme(eingabe.problems),
    () => pruefeBesterVorschlag(eingabe.bester, eingabe.zweitbesterScore, eingabe.minMarge),
    () => pruefeGpsOderBetriebshof(eingabe.gpsAlterMinuten, eingabe.startetVomBetriebshof),
    () => pruefeFahrerImDienst(eingabe.schicht, eingabe.pickupAt),
    () => pruefeZeitfenster(eingabe.autoMode, eingabe.jetzt, eingabe.pickupAt, eingabe.maxTageVoraus),
  ];
  for (const pruefung of pruefungen) {
    const ergebnis = pruefung();
    if (!ergebnis.erlaubt) return ergebnis;
  }
  return ok;
}
