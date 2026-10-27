import type { ReactNode } from "react";

/** Leerer Zustand (docs/DESIGN-GUIDE.md 5.9): ein Satz + passende Aktion, keine Illustration. */
export function EmptyState({ text, aktion }: { text: string; aktion?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[14px] border border-line bg-surface p-4">
      <p className="text-sm text-muted">{text}</p>
      {aktion}
    </div>
  );
}
