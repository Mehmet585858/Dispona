/** Die 8 Schritte des Einrichtungsassistenten (docs/06-oberflaeche.md, docs/09-bauplan.md Phase 9). */
export const EINRICHTUNG_SCHRITTE = [
  { nummer: 1, titel: "Firma anlegen" },
  { nummer: 2, titel: "Telefon verbinden" },
  { nummer: 3, titel: "Fahrzeuge eintragen" },
  { nummer: 4, titel: "Fahrer einladen" },
  { nummer: 5, titel: "Disposition einstellen" },
  { nummer: 6, titel: "KI anpassen" },
  { nummer: 7, titel: "Testanruf" },
  { nummer: 8, titel: "Live schalten" },
] as const;

export const LETZTER_SCHRITT = EINRICHTUNG_SCHRITTE.length;

export function istGueltigerSchritt(schritt: number): boolean {
  return Number.isInteger(schritt) && schritt >= 1 && schritt <= LETZTER_SCHRITT;
}

export function titelFuerSchritt(schritt: number): string {
  return EINRICHTUNG_SCHRITTE.find((s) => s.nummer === schritt)?.titel ?? "";
}
