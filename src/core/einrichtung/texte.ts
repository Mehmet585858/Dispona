/**
 * Alle Texte des Einrichtungsassistenten an einer Stelle (docs/09-bauplan.md Phase 9: "Alle Texte
 * in texte.ts"), damit sie sich leicht prüfen und später übersetzen lassen.
 */

export const RUFUMLEITUNGS_ANLEITUNGEN = [
  {
    anbieter: "Telekom (Festnetz/Mobilfunk)",
    schritte: [
      "Bei Nichtmelden auf die KI-Nummer umleiten: **61*KI-NUMMER# wählen und mit der Anruftaste bestätigen.",
      "Bei Besetzt umleiten: **67*KI-NUMMER# wählen und bestätigen.",
      "Zum Abschalten der Umleitungen: ##004# wählen.",
    ],
  },
  {
    anbieter: "Vodafone",
    schritte: [
      "Bei Nichtmelden: **61*KI-NUMMER# wählen und bestätigen.",
      "Bei Besetzt: **67*KI-NUMMER# wählen und bestätigen.",
      "Alle Umleitungen abschalten: ##002# wählen.",
    ],
  },
  {
    anbieter: "1&1",
    schritte: [
      "Im Kundencenter unter „Rufumleitung“ die KI-Nummer für „Nicht erreichbar“ und „Besetzt“ eintragen.",
      "Alternativ per Telefon: **61*KI-NUMMER# (Nichtmelden), **67*KI-NUMMER# (Besetzt).",
    ],
  },
  {
    anbieter: "Fritzbox",
    schritte: [
      "Telefonie → Rufumleitung → Neue Rufumleitung.",
      "Bedingung „Bei Besetzt“ und „Bei Nichtmelden“ auswählen, Ziel: die KI-Nummer.",
      "Speichern – die Fritzbox leitet ab sofort weiter.",
    ],
  },
] as const;

export function testanrufWarteText(): string {
  return "Wir warten auf Ihren Testanruf … Rufen Sie jetzt die oben stehende Nummer an.";
}

export function testanrufErfolgText(anrufernummer: string): string {
  return `Anruf angekommen (von ${anrufernummer}). Die Rufumleitung funktioniert.`;
}

export function schleifenWarnungText(): string {
  return "Achtung: Die Weiterleitungsnummer (Schritt 6) ist dieselbe wie Ihre KI-Nummer. Das kann eine Dauerschleife verursachen – bitte eine andere Nummer eintragen.";
}

/** Maßnahme M-47 (S2-019): Weiterleitungsnummer lässt sich nicht als Rufnummer lesen. */
export const WEITERLEITUNGSNUMMER_UNGUELTIG = "Weiterleitungsnummer ungültig. Beispiel: 0171 2345678 oder +49 171 2345678.";

/** Maßnahme M-47 (S2-019): Handynummer bei der Registrierung – wird die erste Weiterleitungsnummer. */
export const HANDYNUMMER_UNGUELTIG = "Handynummer ungültig. Beispiel: 0171 2345678.";

export function willkommenGruss(firmenname: string): string {
  return `Herzlich willkommen bei ${firmenname}. Dieses Gespräch wird von einer KI geführt und zur Qualitätssicherung aufgezeichnet.`;
}
