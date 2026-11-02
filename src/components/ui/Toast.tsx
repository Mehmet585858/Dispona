"use client";

import { useEffect } from "react";

/**
 * Kurze Meldung unten in der Mitte (docs/DESIGN-GUIDE.md 5.8 „Erfolgszeile mit Rückgängig“, als
 * schwebende Meldung; ergänzt 02.11.2026): sagt, was passiert ist, optional mit einer Aktion
 * („Rückgängig“). Wird per aria-live angesagt und verschwindet nach `dauerMs` von selbst.
 */
export function Toast({
  text,
  aktion,
  onAktion,
  onSchliessen,
  dauerMs = 8_000,
}: {
  text: string;
  aktion?: string;
  onAktion?: () => void;
  onSchliessen: () => void;
  dauerMs?: number;
}) {
  useEffect(() => {
    const id = setTimeout(onSchliessen, dauerMs);
    return () => clearTimeout(id);
  }, [text, dauerMs, onSchliessen]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-1/2 z-40 flex max-w-[min(620px,calc(100vw-32px))] -translate-x-1/2 items-center gap-3 rounded-xl bg-ink py-2.5 pl-4 pr-3 text-sm text-surface shadow-2xl"
    >
      <span>{text}</span>
      {aktion && onAktion ? (
        <button
          type="button"
          onClick={onAktion}
          className="min-h-9 flex-none rounded-lg border border-muted px-3 font-semibold text-surface hover:bg-ink-soft"
        >
          {aktion}
        </button>
      ) : null}
    </div>
  );
}
