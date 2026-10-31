/**
 * Rufnummer der KI (Einrichtungsschritt 2). Die Zuordnung Anruf → Mandant läuft ausschließlich
 * über PhoneNumber.e164 (src/core/voice/mandant.ts); deshalb wird hier streng E.164 verlangt
 * (Prüfbericht S2-011: vorher wurde jede Zeichenkette gespeichert).
 */
const E164 = /^\+[1-9]\d{6,14}$/;

/** Gibt die bereinigte E.164-Nummer zurück oder null, wenn die Eingabe keine gültige Rufnummer ist. */
export function rufnummerE164(eingabe: string): string | null {
  const roh = eingabe.trim().replace(/[\s\-/().]/g, "");
  const kandidat = roh.startsWith("00") ? `+${roh.slice(2)}` : roh;
  return E164.test(kandidat) ? kandidat : null;
}
