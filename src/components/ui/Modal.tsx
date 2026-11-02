"use client";

import { useRef } from "react";
import { useFokusfalle } from "@/hooks/useFokusfalle";

/** Zentriertes Überlagerungs-Fenster (docs/DESIGN-GUIDE.md Abschnitt 9): für Fahrt-Details und
 * Formulare. Pflicht laut Guide: role="dialog", Fokusfalle, Esc – der Fokus springt beim Öffnen
 * hinein, bleibt per Tab darin gefangen und danach zum Auslöser zurück (useFokusfalle). */
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
  const dialogRef = useRef<HTMLDivElement>(null);
  useFokusfalle(dialogRef, onClose);

  return (
    <div
      className="fixed inset-0 z-20 flex items-start justify-center overflow-auto bg-ink/40 p-4 pt-20"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={titel}
        tabIndex={-1}
        className={`w-full ${breit ? "max-w-2xl" : "max-w-lg"} overflow-hidden rounded-2xl bg-surface shadow-2xl outline-none`}
      >
        {children}
      </div>
    </div>
  );
}
