/**
 * Ob die KI gerade Anrufe annehmen soll (docs/06-oberflaeche.md Einrichtungsschritt 8 "Live
 * schalten"): der Schalter (aiActive) UND, falls gesetzt, der Zeitplan (aiSchedule) müssen passen.
 * Reine Funktion, damit sie unabhängig vom Webhook testbar ist.
 */
import { istNachtsInBerlin, istWochenendeInBerlin } from "@/core/shifts/zeitfenster";

export type AiSchedule = { modus: "NACHTS_WOCHENENDE" | "IMMER" } | null;

export function aiJetztErreichbar(aiActive: boolean, aiSchedule: unknown, jetzt: Date): boolean {
  if (!aiActive) return false;
  const modus = (aiSchedule as AiSchedule)?.modus;
  if (modus === "NACHTS_WOCHENENDE") {
    return istNachtsInBerlin(jetzt) || istWochenendeInBerlin(jetzt);
  }
  return true;
}
