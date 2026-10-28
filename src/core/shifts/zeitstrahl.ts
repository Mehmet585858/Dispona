// Positionsrechnung für den Fahrer-Zeitstrahl auf der Fahrplan-Seite (docs/03-datenmodell.md
// Schicht, Ride). Die Achse deckt den vollen Tag ab (00:00–24:00 Berliner Zeit), damit auch
// sehr frühe oder sehr späte Fahrten nie fehlen; die Seite macht daraus einen horizontal
// scrollbaren Zeitstrahl statt alles in die Breite des Bildschirms zu quetschen.
import { minutenSeitMitternacht } from "./week";

export const ZEITSTRAHL_START_STUNDE = 0;
export const ZEITSTRAHL_ENDE_STUNDE = 24;

const START_MIN = ZEITSTRAHL_START_STUNDE * 60;
const GESAMT_MIN = (ZEITSTRAHL_ENDE_STUNDE - ZEITSTRAHL_START_STUNDE) * 60;

/** Position (0–100) eines Zeitpunkts auf dem Zeitstrahl, an den Rand geklemmt. */
export function zeitstrahlPosition(datum: Date): number {
  const minuten = minutenSeitMitternacht(datum) - START_MIN;
  return Math.min(100, Math.max(0, (minuten / GESAMT_MIN) * 100));
}

/** Breite (≥0) eines Zeitraums auf dem Zeitstrahl, in denselben Prozent-Einheiten. */
export function zeitstrahlBreite(start: Date, ende: Date): number {
  return Math.max(0, zeitstrahlPosition(ende) - zeitstrahlPosition(start));
}
