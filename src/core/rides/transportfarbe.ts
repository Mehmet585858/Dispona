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

/**
 * Hintergrund/Schrift für einen Zeitstrahl-Chip – nur noch 3 flächige Farben für den Zustand der
 * Fahrt, ohne Rahmen und unabhängig von der Transportart (die früher zusätzlich eingefärbt hat,
 * jetzt nur noch als Text im Chip steht, siehe Zeitstrahl.tsx/LiveZeitstrahl.tsx): Grün = erledigt,
 * Blau = gerade im Auto (unterwegs/an Bord – auch verspätet, das zeigt die Kachel stattdessen über
 * den "+X"-Minuten-Text, nicht über eine eigene Farbe), helles Orange = liegt noch in der Zukunft
 * (geplant oder nur vorgeschlagen, optisch bewusst nicht mehr unterschieden).
 */
export function chipStil(zustand: Fahrtzustand) {
  switch (zustand) {
    case "erledigt":
      return { background: "var(--chip-erledigt)", color: "#ffffff" };
    case "laeuft":
    case "verspaetet":
      return { background: "var(--chip-laeuft)", color: "#ffffff" };
    case "geplant":
    case "vorschlag":
      return { background: "var(--chip-geplant)", color: "var(--chip-geplant-ink)" };
  }
}
