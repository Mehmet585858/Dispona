import type { ReactNode } from "react";

type Ton = "neutral" | "warn" | "info" | "danger" | "accent";

// "danger" rendert bewusst im Warnstil (orange), nicht in --color-danger-ink (rot): die
// Chips mit diesem Ton zeigen Fahrt-Probleme/Alarme, also "braucht Aufmerksamkeit", nicht
// eine zerstörende Aktion. Rot (--color-danger-*) bleibt reserviert für Formularfehler und
// zerstörende Aktionen (docs/DESIGN-GUIDE.md Abschnitt 1.2).
const toene: Record<Ton, string> = {
  neutral: "bg-ground text-ink-soft border border-line",
  warn: "bg-warn-bg text-warn-ink",
  info: "bg-info-bg text-info-ink",
  danger: "bg-warn-bg text-warn-ink",
  accent: "bg-accent-soft text-accent",
};

/** Kleine runde Beschriftung für Status (Ampel mit Text, nie Farbe allein). */
export function Chip({ children, ton = "neutral" }: { children: ReactNode; ton?: Ton }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${toene[ton]}`}>
      {children}
    </span>
  );
}
