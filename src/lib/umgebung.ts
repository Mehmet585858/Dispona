/**
 * Prüfung der Umgebungsvariablen beim Start (Maßnahme M-03, Punkt 3; Prüfbericht S4-013):
 * Fehlt in Produktion ein Schlüssel, ohne den Anmeldung, Verschlüsselung, Webhooks oder Push
 * nicht funktionieren, soll der Start laut scheitern – statt dass der Nutzer "Code gesendet"
 * sieht und im Log eine Fehlerzeile versickert. Reine Funktion, damit sie testbar bleibt;
 * aufgerufen aus src/instrumentation.ts.
 *
 * Bewusst (noch) nicht verlangt: SMS_API_KEY – es gibt noch keinen SMS-Anbieter (Entscheidung des
 * Auftraggebers offen, siehe Behebungsprotokoll); ohne Anbieter scheitert jeder SMS-Versand ohnehin
 * laut (src/providers/sms/index.ts).
 */
export const PFLICHT_IN_PRODUKTION = [
  { name: "DATABASE_URL", wofuer: "Datenbankverbindung" },
  { name: "AUTH_SECRET", wofuer: "Anmeldung (Sitzungen signieren)" },
  { name: "APP_URL", wofuer: "Anmelde-Links und Webhook-Adresse" },
  { name: "ENCRYPTION_KEY", wofuer: "Verschlüsselung von Gesprächsprotokollen" },
  { name: "CRON_SECRET", wofuer: "Schutz der Cron-Endpunkte" },
  { name: "VAPI_WEBHOOK_SECRET", wofuer: "Prüfung der Webhook-Anfragen vom Telefon-Anbieter" },
  { name: "RESEND_API_KEY", wofuer: "Einmal-Codes per E-Mail ans Büro" },
  { name: "VAPID_PUBLIC_KEY", wofuer: "Push an die Fahrer-App" },
  { name: "VAPID_PRIVATE_KEY", wofuer: "Push an die Fahrer-App" },
  { name: "NEXT_PUBLIC_VAPID_PUBLIC_KEY", wofuer: "Push-Anmeldung im Browser der Fahrer-App" },
] as const;

export function fehlendeUmgebungsvariablen(env: Record<string, string | undefined>): string[] {
  return PFLICHT_IN_PRODUKTION.filter((v) => !env[v.name] || env[v.name]?.trim() === "").map(
    (v) => `${v.name} (${v.wofuer})`,
  );
}

/**
 * Wirft in Produktion, wenn Pflichtvariablen fehlen; in Entwicklung/Test nur eine Warnung
 * (dort läuft vieles bewusst ohne externe Dienste). Gibt die Liste der fehlenden zurück.
 */
export function umgebungPruefen(
  env: Record<string, string | undefined>,
  nodeEnv: string | undefined,
  warnen: (meldung: string) => void = (m) => console.warn(m),
): string[] {
  const fehlend = fehlendeUmgebungsvariablen(env);
  if (fehlend.length === 0) return fehlend;
  const meldung = `Fehlende Umgebungsvariablen: ${fehlend.join(", ")}.`;
  if (nodeEnv === "production") {
    throw new Error(`Start abgebrochen – ${meldung} Werte in den Umgebungsvariablen des Servers setzen (.env.example).`);
  }
  warnen(`[Entwicklung] ${meldung}`);
  return fehlend;
}
