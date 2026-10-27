// Transportart-Farben aus docs/DESIGN-GUIDE.md Abschnitt 2 / 4.1 ("Gedämpft").
// Einzige Stelle, die diese Farben kennt – nie Hex-Werte verstreut im Code.
import type { TRANSPORT_TYPES } from "./validation";

type Transportart = (typeof TRANSPORT_TYPES)[number];
type Stufe = "main" | "solid" | "tint" | "faint" | "ink";

const CSS_VARIABLE: Record<Transportart, string> = {
  LIEGEND: "liegend",
  TRAGESTUHL: "tragestuhl",
  ROLLSTUHL: "rollstuhl",
  SITZEND: "sitzend",
};

/** Liefert die CSS-Variable (`var(--transport-...)`) für eine Transportart und Farbstufe. */
export function farbeFuerArt(art: Transportart, stufe: Stufe): string {
  return `var(--transport-${CSS_VARIABLE[art]}-${stufe})`;
}

export type Fahrtzustand = "erledigt" | "geplant" | "laeuft" | "verspaetet" | "vorschlag";

/** Hintergrund/Rahmen/Schrift für einen Zeitstrahl-/Kalender-Chip (docs/DESIGN-GUIDE.md 5.4). */
export function chipStil(art: Transportart, zustand: Fahrtzustand) {
  switch (zustand) {
    case "erledigt":
      return { background: farbeFuerArt(art, "faint"), border: `1px solid ${farbeFuerArt(art, "tint")}`, color: farbeFuerArt(art, "ink") };
    case "geplant":
      return { background: farbeFuerArt(art, "tint"), border: `1.5px solid ${farbeFuerArt(art, "main")}`, color: farbeFuerArt(art, "ink") };
    case "laeuft":
      return { background: farbeFuerArt(art, "solid"), border: "none", color: "#ffffff" };
    case "verspaetet":
      return {
        background: farbeFuerArt(art, "solid"),
        border: "none",
        color: "#ffffff",
        boxShadow: "0 0 0 2px var(--color-now)",
      };
    case "vorschlag":
      return { background: "#ffffff", border: `2px dashed ${farbeFuerArt(art, "solid")}`, color: farbeFuerArt(art, "ink") };
  }
}
