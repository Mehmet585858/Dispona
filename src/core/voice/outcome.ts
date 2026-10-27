/**
 * Ergebnis eines Anrufs bestimmen (docs/01-produkt.md Kennzahl "Anrufer, die zu einem Menschen
 * wechseln", docs/09-bauplan.md Phase 10 "Weiterleitungen an Menschen"). Nur die Fälle, die sich
 * zuverlässig aus den vorhandenen Daten ableiten lassen – AUSKUNFT, FAHRT_GEAENDERT und
 * NOTFALL_HINWEIS brauchen weitere Signale (z. B. welches Werkzeug zuletzt lief) und werden hier
 * bewusst nicht geraten.
 *
 * `endedReason === "assistant-forwarded-call"` ist Vapis dokumentierter Wert für eine erfolgreich
 * durchgeführte Übergabe an einen Menschen (docs.vapi.ai/calls/call-ended-reason), passend zu
 * unserem fest hinterlegten transferCall-Ziel (providers/voice/vapi.ts).
 */
import type { CallOutcome } from "@/generated/prisma/enums";

export function outcomeKlassifizieren(params: {
  endedReason?: string;
  hatFahrt: boolean;
  fahrtStorniert: boolean;
}): CallOutcome {
  if (params.endedReason === "assistant-forwarded-call") return "WEITERGELEITET";
  if (params.fahrtStorniert) return "FAHRT_STORNIERT";
  if (params.hatFahrt) return "FAHRT_ERFASST";
  return "ABGEBROCHEN";
}
