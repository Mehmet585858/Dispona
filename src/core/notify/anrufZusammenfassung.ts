/**
 * Zusammenfassung des Gesprächs für den Disponenten, höchstens 3 Zeilen (docs/04-voice-agent.md).
 * Mit Claude, wenn ANTHROPIC_API_KEY gesetzt ist. Ohne Schlüssel oder bei einem Fehler gibt es
 * NUR einen Hinweis – nie mehr die ersten Transkriptzeilen im Klartext (Maßnahme M-10,
 * Prüfbericht S3-024: das Roh-Transkript landete so dauerhaft und unverschlüsselt in Call.summary).
 * Gespeichert wird die Zusammenfassung verschlüsselt wie das Transkript (S3-012);
 * zusammenfassungLesbar() entschlüsselt beim Lesen und versteht Bestandszeilen im Klartext.
 */
import { claudeClient, CLAUDE_MODELL } from "@/lib/anthropic";
import { decrypt, istVerschluesselt } from "@/lib/crypto";

export const ZUSAMMENFASSUNG_NICHT_VERFUEGBAR = "Keine Zusammenfassung verfügbar – bitte Transkript ansehen.";

export async function anrufZusammenfassen(transcript: string | null | undefined): Promise<string | null> {
  if (!transcript) return null;

  const claude = claudeClient();
  if (!claude) return ZUSAMMENFASSUNG_NICHT_VERFUEGBAR;

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
    return text && text.type === "text" && text.text.trim() ? text.text.trim() : ZUSAMMENFASSUNG_NICHT_VERFUEGBAR;
  } catch {
    return ZUSAMMENFASSUNG_NICHT_VERFUEGBAR;
  }
}

/** Gespeicherte Zusammenfassung lesbar machen: neue Zeilen sind verschlüsselt, alte im Klartext. */
export function zusammenfassungLesbar(gespeichert: string | null | undefined): string | null {
  if (!gespeichert) return null;
  if (!istVerschluesselt(gespeichert)) return gespeichert;
  try {
    return decrypt(gespeichert);
  } catch {
    return ZUSAMMENFASSUNG_NICHT_VERFUEGBAR;
  }
}
