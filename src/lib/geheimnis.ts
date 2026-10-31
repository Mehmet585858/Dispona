import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Zeitkonstanter Vergleich zweier Geheimnisse (Maßnahme M-14 Punkt 3, Prüfbericht S4-007). `===`
 * bricht beim ersten abweichenden Zeichen ab – über viele Anfragen verrät die Laufzeit so, wie viel
 * eines geratenen Geheimnisses schon stimmt. Beide Seiten werden vorher gehasht, damit auch
 * unterschiedliche Längen nicht früher scheitern. Fehlt ein Wert (oder ist er leer): immer false.
 */
export function geheimnisGleich(erhalten: string | null | undefined, erwartet: string | null | undefined): boolean {
  if (!erhalten || !erwartet) return false;
  const a = createHash("sha256").update(erhalten).digest();
  const b = createHash("sha256").update(erwartet).digest();
  return timingSafeEqual(a, b);
}

/** Prüft `Authorization: Bearer <geheimnis>` (Cron-Endpunkte). Ohne eingerichtetes Geheimnis: false. */
export function bearerErlaubt(anfrage: Request, geheimnis: string | null | undefined): boolean {
  const kopf = anfrage.headers.get("authorization") ?? "";
  const token = kopf.startsWith("Bearer ") ? kopf.slice("Bearer ".length) : "";
  return geheimnisGleich(token, geheimnis);
}
