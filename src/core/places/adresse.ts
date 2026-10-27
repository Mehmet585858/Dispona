/**
 * Zerlegt eine deutsche Adresse aus einem Geocoding-Ergebnis ("Hauptstraße 12, 52499 Baesweiler,
 * Deutschland") in Straße, PLZ und Ort, weil Place diese Felder getrennt braucht. Schlägt die
 * Zerlegung fehl, landet die ganze Zeile in `street` – besser als eine Fahrt daran scheitern zu
 * lassen (docs/04-voice-agent.md, Werkzeug ort_suchen).
 */
export type DeutscheAdresse = { street: string; zip: string; city: string };

const PLZ_ORT = /^(\d{5})\s+(.+)$/;

export function parseDeutscheAdresse(label: string): DeutscheAdresse {
  const teile = label
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // Letzter Teil ist oft das Land ("Deutschland") – weglassen, wenn noch genug Teile übrig bleiben.
  if (teile.length > 2 && /^(deutschland|germany)$/i.test(teile[teile.length - 1])) {
    teile.pop();
  }

  if (teile.length >= 2) {
    const plzOrtTreffer = PLZ_ORT.exec(teile[teile.length - 1]);
    if (plzOrtTreffer) {
      return { street: teile.slice(0, -1).join(", "), zip: plzOrtTreffer[1], city: plzOrtTreffer[2] };
    }
  }

  return { street: label, zip: "", city: "" };
}
