/**
 * Zusammenfassung des Gesprächs für den Disponenten, höchstens 3 Zeilen (docs/04-voice-agent.md).
 *
 * TODO: Noch keine echte KI-Zusammenfassung – dafür fehlt ein konfigurierter Sprachmodell-Zugang
 * (ANTHROPIC_API_KEY o. Ä.), das ist mit dem Nutzer noch zu klären. Bis dahin: einfache Kurzfassung
 * ohne Sprachmodell, damit "Anruf anhören" auf /dispo trotzdem etwas Lesbares zeigt.
 */
export function anrufZusammenfassen(transcript: string | null | undefined): string | null {
  if (!transcript) return null;
  const zeilen = transcript
    .split("\n")
    .map((z) => z.trim())
    .filter(Boolean);
  const kurz = zeilen.slice(0, 3).join(" ");
  return kurz.length > 300 ? `${kurz.slice(0, 297)}…` : kurz;
}
