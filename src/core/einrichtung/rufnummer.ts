/**
 * Rufnummer der KI (Einrichtungsschritt 2). Die Zuordnung Anruf → Mandant läuft ausschließlich
 * über PhoneNumber.e164 (src/core/voice/mandant.ts); deshalb wird hier streng E.164 verlangt
 * (Prüfbericht S2-011: vorher wurde jede Zeichenkette gespeichert).
 */
import { telefonNormalisieren } from "@/core/passengers/suche";

const E164 = /^\+[1-9]\d{6,14}$/;

/** Gibt die bereinigte E.164-Nummer zurück oder null, wenn die Eingabe keine gültige Rufnummer ist. */
export function rufnummerE164(eingabe: string): string | null {
  const roh = eingabe.trim().replace(/[\s\-/().]/g, "");
  const kandidat = roh.startsWith("00") ? `+${roh.slice(2)}` : roh;
  return E164.test(kandidat) ? kandidat : null;
}

/**
 * Maßnahme M-47 Punkt 3 (Prüfbericht S2-019, V-015): Weiterleitungsnummer an einen Menschen
 * (Handy des Inhabers, Durchwahl). Anders als die KI-Nummer wird sie meist national eingegeben
 * ("0171 2345678") – deshalb erst mit denselben Regeln wie alle anderen Telefonnummern normalisieren
 * (telefonNormalisieren, M-21), dann streng E.164 prüfen. Vapi erwartet E.164; eine leere oder
 * national geschriebene Nummer ging vorher ungeprüft als Weiterleitungsziel hinaus.
 * Gibt null zurück, wenn daraus keine gültige Rufnummer wird.
 */
export function weiterleitungsnummerE164(eingabe: string): string | null {
  const kandidat = telefonNormalisieren(eingabe);
  return E164.test(kandidat) ? kandidat : null;
}
