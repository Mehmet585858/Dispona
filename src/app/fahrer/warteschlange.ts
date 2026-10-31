import type { RideStatus } from "@/generated/prisma/enums";
import type { ProblemArt } from "./actions";

/**
 * Offline-Warteschlange für Statusmeldungen: läuft rein im Browser (localStorage), damit
 * Tippen auf Losgefahren/Fahrgast abgeholt/Erledigt/Problem melden/Gesehen bei Funkloch nicht
 * verloren geht, sondern automatisch nachgesendet wird, sobald wieder Empfang da ist
 * (docs/09-bauplan.md). Schicht starten/beenden passiert in der Regel am Betriebshof (mit
 * Empfang) und bleibt deshalb bewusst außen vor.
 */

export type WarteschlangenEintrag =
  | { id: string; typ: "STATUS"; daten: { rideId: string; status: RideStatus } }
  | { id: string; typ: "PROBLEM"; daten: { rideId: string; art: ProblemArt } }
  | { id: string; typ: "GESEHEN"; daten: { rideId: string } };

const SCHLUESSEL = "fahrdienst-ki:warteschlange";
export const WARTESCHLANGE_EREIGNIS = "fahrdienst-ki:warteschlange-geaendert";

export function warteschlangeLaden(): WarteschlangenEintrag[] {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    return roh ? (JSON.parse(roh) as WarteschlangenEintrag[]) : [];
  } catch {
    return [];
  }
}

function warteschlangeSpeichern(eintraege: WarteschlangenEintrag[]) {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(eintraege));
  } catch {
    // Kein Speicherplatz oder localStorage gesperrt – dann eben ohne Zwischenspeicher.
  }
  window.dispatchEvent(new Event(WARTESCHLANGE_EREIGNIS));
}

export function warteschlangeHinzufuegen(eintrag: Omit<WarteschlangenEintrag, "id">): WarteschlangenEintrag[] {
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const eintraege = [...warteschlangeLaden(), { ...eintrag, id } as WarteschlangenEintrag];
  warteschlangeSpeichern(eintraege);
  return eintraege;
}

export function warteschlangeEntfernen(id: string): WarteschlangenEintrag[] {
  const eintraege = warteschlangeLaden().filter((e) => e.id !== id);
  warteschlangeSpeichern(eintraege);
  return eintraege;
}

/** Alles verwerfen – beim Abmelden (src/app/fahrer/geraeteDaten.ts). */
export function warteschlangeLeeren(): void {
  try {
    localStorage.removeItem(SCHLUESSEL);
  } catch {
    // localStorage gesperrt – dann war auch nichts gespeichert.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(WARTESCHLANGE_EREIGNIS));
}
