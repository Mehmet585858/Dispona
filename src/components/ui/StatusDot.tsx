import { type ReactNode } from "react";

type Ton = "neutral" | "ok" | "warn";

const toene: Record<Ton, { pille: string; punkt: string }> = {
  neutral: { pille: "bg-ground text-ink-soft", punkt: "bg-[var(--live-free)]" },
  ok: { pille: "bg-ok-bg text-ok-ink", punkt: "bg-ok-dot" },
  warn: { pille: "bg-warn-bg text-warn-ink", punkt: "bg-late" },
};

/**
 * Status-Pille mit Punkt + Text (docs/DESIGN-GUIDE.md 2 „Status = Punkt 8 px + Text. Nie nur Farbe
 * ohne Text.“, ergänzt 02.11.2026), z. B. „Im Dienst bis 14:00“, „Beginnt um 16:00“.
 */
export function StatusDot({ children, ton = "neutral" }: { children: ReactNode; ton?: Ton }) {
  const stil = toene[ton];
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold ${stil.pille}`}>
      <span aria-hidden className={`h-2 w-2 flex-none rounded-full ${stil.punkt}`} />
      {children}
    </span>
  );
}
