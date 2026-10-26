export type ImportFeld = { schlüssel: string; label: string; pflicht: boolean };

function normalisieren(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Rät für jedes Zielfeld die passende Spalte aus der Datei, über Ähnlichkeit der Namen.
 * Erst genaue Treffer (Spaltenname == Feldname/-schlüssel), erst danach Teilstring-Treffer –
 * sonst gewinnt bei ähnlichen Namen (z. B. "Sitzplätze" vs. "Rollstuhlplätze") leicht die
 * falsche Spalte. Jede Spalte wird höchstens einem Feld zugeordnet.
 */
export function spaltenVorschlagen(
  felder: readonly ImportFeld[],
  spalten: string[],
): Record<string, string> {
  const zuordnung: Record<string, string> = {};
  const belegteSpalten = new Set<string>();

  for (const feld of felder) {
    const ziel = normalisieren(feld.label);
    const zielSchlüssel = normalisieren(feld.schlüssel);
    const treffer = spalten.find((spalte) => {
      if (belegteSpalten.has(spalte)) return false;
      const quelle = normalisieren(spalte);
      return quelle === ziel || quelle === zielSchlüssel;
    });
    if (treffer) {
      zuordnung[feld.schlüssel] = treffer;
      belegteSpalten.add(treffer);
    }
  }

  for (const feld of felder) {
    if (zuordnung[feld.schlüssel]) continue;
    const ziel = normalisieren(feld.label);
    const zielSchlüssel = normalisieren(feld.schlüssel);
    const treffer = spalten.find((spalte) => {
      if (belegteSpalten.has(spalte)) return false;
      const quelle = normalisieren(spalte);
      if (quelle.length < 4) return false;
      return ziel.includes(quelle) || quelle.includes(zielSchlüssel);
    });
    if (treffer) {
      zuordnung[feld.schlüssel] = treffer;
      belegteSpalten.add(treffer);
    }
  }

  return zuordnung;
}

/** Wendet die Spaltenzuordnung auf alle Zeilen an: {Spaltenname: Wert} -> {Feldschlüssel: Wert}. */
export function zeilenZuordnen(
  zeilen: Record<string, string>[],
  zuordnung: Record<string, string>,
): Record<string, string>[] {
  return zeilen.map((zeile) => {
    const ergebnis: Record<string, string> = {};
    for (const [feldSchlüssel, spalte] of Object.entries(zuordnung)) {
      if (spalte) {
        ergebnis[feldSchlüssel] = (zeile[spalte] ?? "").trim();
      }
    }
    return ergebnis;
  });
}
