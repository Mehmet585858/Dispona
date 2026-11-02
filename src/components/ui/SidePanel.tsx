"use client";

import { useRef, type ReactNode } from "react";
import { useFokusfalle } from "@/hooks/useFokusfalle";

/**
 * Seitenfenster von rechts (docs/DESIGN-GUIDE.md Abschnitt 10, ergänzt 02.11.2026 für den
 * Schichtplan): zum Bearbeiten, ohne die Seite dahinter zu verlassen. Wie Modal: role="dialog",
 * Fokusfalle, Esc und Klick auf den Hintergrund schließen, der Fokus springt danach zurück zum
 * Auslöser. Kopf mit Meta-Zeile (Mono), Titel und Schließen-Knopf; `fuss` bleibt unten stehen.
 * Auf schmalen Bildschirmen nimmt es die volle Breite ein.
 */
export function SidePanel({
  titel,
  meta,
  onClose,
  children,
  fuss,
}: {
  titel: string;
  meta?: string;
  onClose: () => void;
  children: ReactNode;
  fuss?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFokusfalle(panelRef, onClose, "[data-autofokus]");

  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-ink/30" aria-hidden onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seitenfenster-titel"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col bg-surface shadow-2xl outline-none"
      >
        <div className="flex items-start gap-3 border-b border-line px-5 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            {meta ? <p className="font-mono text-sm font-semibold text-muted">{meta}</p> : null}
            <h2 id="seitenfenster-titel" className="text-[22px] font-bold text-ink">
              {titel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            data-autofokus
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-line bg-surface text-xl text-ink hover:bg-accent-soft"
          >
            ×
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
        {fuss ? <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">{fuss}</div> : null}
      </div>
    </div>
  );
}
