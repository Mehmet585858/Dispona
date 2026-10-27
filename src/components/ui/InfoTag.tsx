import type { ReactNode } from "react";

/** Kleines graues Etikett neben einem Hauptobjekt, z. B. Fahrer neben dem Kennzeichen (docs/DESIGN-GUIDE.md 5.2). */
export function InfoTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[6px] bg-ground px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft">
      {children}
    </span>
  );
}
