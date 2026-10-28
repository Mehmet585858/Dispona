"use client";

import { useEffect } from "react";

/** Zentriertes Überlagerungs-Fenster (docs/DESIGN-GUIDE.md Abschnitt 9): für Fahrt-Details und Formulare. */
export function Modal({
  titel,
  onClose,
  children,
  breit,
}: {
  titel: string;
  onClose: () => void;
  children: React.ReactNode;
  breit?: boolean;
}) {
  useEffect(() => {
    function aufEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", aufEscape);
    return () => document.removeEventListener("keydown", aufEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-20 flex items-start justify-center overflow-auto bg-ink/40 p-4 pt-20"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titel}
        className={`w-full ${breit ? "max-w-2xl" : "max-w-lg"} overflow-hidden rounded-2xl bg-surface shadow-2xl`}
      >
        {children}
      </div>
    </div>
  );
}
