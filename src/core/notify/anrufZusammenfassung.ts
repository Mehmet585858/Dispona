/**
 * Zusammenfassung des Gesprächs für den Disponenten, höchstens 3 Zeilen (docs/04-voice-agent.md).
 * Mit Claude, wenn ANTHROPIC_API_KEY gesetzt ist; sonst eine einfache Kurzfassung ohne
 * Sprachmodell, damit "Anruf anhören" auf /dispo trotzdem etwas Lesbares zeigt.
 */
import { claudeClient, CLAUDE_MODELL } from "@/lib/anthropic";

function kurzfassungOhneModell(transcript: string): string {
  const zeilen = transcript
    .split("\n")
    .map((z) => z.trim())
    .filter(Boolean);
  const kurz = zeilen.slice(0, 3).join(" ");
  return kurz.length > 300 ? `${kurz.slice(0, 297)}…` : kurz;
}

export async function anrufZusammenfassen(transcript: string | null | undefined): Promise<string | null> {
  if (!transcript) return null;

  const claude = claudeClient();
  if (!claude) return kurzfassungOhneModell(transcript);

  try {
    const antwort = await claude.messages.create({
      model: CLAUDE_MODELL,
      max_tokens: 200,
      system:
        "Fasse das folgende Telefongespräch mit einem Krankenfahrdienst für den Disponenten in höchstens " +
        "3 kurzen Zeilen auf Deutsch zusammen (Fahrgast, worum es ging, Ergebnis). Keine Einleitung, nur die Zusammenfassung.",
      messages: [{ role: "user", content: transcript }],
    });
    const text = antwort.content.find((b) => b.type === "text");
    return text && text.type === "text" ? text.text.trim() : kurzfassungOhneModell(transcript);
  } catch {
    return kurzfassungOhneModell(transcript);
  }
}
