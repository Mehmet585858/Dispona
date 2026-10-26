import type { ReactNode } from "react";

type Ton = "neutral" | "warn" | "info" | "danger" | "accent";

const toene: Record<Ton, string> = {
  neutral: "bg-ground text-ink-soft border border-line",
  warn: "bg-warn-bg text-warn-ink",
  info: "bg-info-bg text-info-ink",
  danger: "bg-danger-bg text-danger-ink",
  accent: "bg-accent-soft text-accent",
};

/** Kleine runde Beschriftung für Status (Ampel mit Text, nie Farbe allein). */
export function Chip({ children, ton = "neutral" }: { children: ReactNode; ton?: Ton }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${toene[ton]}`}>
      {children}
    </span>
  );
}
