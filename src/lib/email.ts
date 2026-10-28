/**
 * E-Mail-Versand über Resend (https://resend.com), reine REST-Anfrage statt SDK, um die
 * Abhängigkeiten klein zu halten. RESEND_API_KEY kommt aus den Umgebungsvariablen.
 */
const ABSENDER = "Dispona <anmeldung@dispona.de>";

export async function emailSenden({
  an,
  betreff,
  html,
}: {
  an: string;
  betreff: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY ist nicht gesetzt.");
  }

  const antwort = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: ABSENDER, to: an, subject: betreff, html }),
  });

  if (!antwort.ok) {
    throw new Error(`E-Mail-Versand fehlgeschlagen (${antwort.status}): ${await antwort.text()}`);
  }
}
