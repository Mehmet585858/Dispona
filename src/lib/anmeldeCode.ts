/**
 * Büro-Anmeldung per Einmal-Code (CLAUDE.md): better-auth erzeugt den Code, wir stellen ihn per
 * E-Mail zu. Prüfbericht S4-013: ohne RESEND_API_KEY scheiterte der Versand nur im Server-Log,
 * die Anmeldeseite meldete trotzdem "Code gesendet". Jetzt wirft die Zustellung einen klaren
 * Fehler, den src/lib/auth.ts als definierte API-Antwort (503) an die Anmeldeseite weitergibt.
 */
import { emailSenden } from "./email";

export function anmeldeCodeMail(otp: string): { betreff: string; html: string } {
  return {
    betreff: `Anmelde-Code: ${otp}`,
    html: `
      <p>Der Anmelde-Code für Dispona lautet:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px">${otp}</p>
      <p>Der Code ist 10 Minuten gültig. Wer das nicht angefordert hat, kann diese E-Mail ignorieren.</p>
    `,
  };
}

export async function anmeldeCodeZustellen(
  { email, otp }: { email: string; otp: string },
  abhaengigkeiten: {
    apiKeyVorhanden?: boolean;
    senden?: (nachricht: { an: string; betreff: string; html: string }) => Promise<void>;
  } = {},
): Promise<void> {
  const apiKeyVorhanden = abhaengigkeiten.apiKeyVorhanden ?? Boolean(process.env.RESEND_API_KEY);
  if (!apiKeyVorhanden) {
    throw new Error("Kein E-Mail-Versand eingerichtet (RESEND_API_KEY fehlt). Der Anmelde-Code kann nicht gesendet werden.");
  }
  const senden = abhaengigkeiten.senden ?? emailSenden;
  const { betreff, html } = anmeldeCodeMail(otp);
  await senden({ an: email, betreff, html });
}
