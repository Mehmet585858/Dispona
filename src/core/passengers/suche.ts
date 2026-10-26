/** Fahrgast-Suche: Telefonnummer, Name + Geburtsdatum, unscharfe Namenssuche (docs/09-bauplan.md Phase 3). */

function normalisieren(text: string): string {
  return text.trim().toLowerCase();
}

/** Levenshtein-Distanz: Anzahl Einfügen/Löschen/Ersetzen, um a in b zu verwandeln. */
export function levenshteinDistanz(a: string, b: string): number {
  const x = normalisieren(a);
  const y = normalisieren(b);
  const zeilen = x.length + 1;
  const spalten = y.length + 1;
  const matrix: number[][] = Array.from({ length: zeilen }, (_, i) =>
    Array.from({ length: spalten }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i < zeilen; i += 1) {
    for (let j = 1; j < spalten; j += 1) {
      const kosten = x[i - 1] === y[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // löschen
        matrix[i][j - 1] + 1, // einfügen
        matrix[i - 1][j - 1] + kosten, // ersetzen
      );
    }
  }
  return matrix[zeilen - 1][spalten - 1];
}

/** Wie viele Zeichen dürfen bei gegebener Namenslänge abweichen, damit noch "ähnlich" gilt. */
function erlaubteAbweichung(laenge: number): number {
  if (laenge <= 4) return 1;
  if (laenge <= 8) return 2;
  return 3;
}

export function istAehnlicherName(a: string, b: string): boolean {
  if (normalisieren(a) === normalisieren(b)) return true;
  const distanz = levenshteinDistanz(a, b);
  return distanz <= erlaubteAbweichung(Math.max(a.length, b.length));
}

type FahrgastKandidat = { id: string; firstName: string; lastName: string };

/** Unscharfe Namenssuche: "Schmidt" findet auch "Schmitt". */
export function fahrgaesteAehnlicheNamen<T extends FahrgastKandidat>(
  alle: T[],
  nachname: string,
): T[] {
  return alle.filter((f) => istAehnlicherName(f.lastName, nachname));
}

/** Normalisiert eine Telefonnummer grob für den Vergleich (nur Ziffern, führende 0 -> +49). */
export function telefonNormalisieren(nummer: string): string {
  const ziffern = nummer.replace(/[^0-9+]/g, "");
  if (ziffern.startsWith("0")) {
    return `+49${ziffern.slice(1)}`;
  }
  return ziffern;
}
