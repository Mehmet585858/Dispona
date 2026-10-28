"use client";

import { useEffect, useRef } from "react";

const FOKUSSIERBAR_SELEKTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Zentriertes Überlagerungs-Fenster (docs/DESIGN-GUIDE.md Abschnitt 9): für Fahrt-Details und
 * Formulare. Pflicht laut Guide: role="dialog", Fokusfalle, Esc – der Fokus springt beim Öffnen
 * hinein, bleibt per Tab darin gefangen und danach zum Auslöser zurück. */
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

  useEffect(() => {
    const ausloeser = document.activeElement as HTMLElement | null;
    const erstesFeld = dialogRef.current?.querySelector<HTMLElement>(FOKUSSIERBAR_SELEKTOR);
    (erstesFeld ?? dialogRef.current)?.focus();

    function aufTastendruck(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const fokussierbar = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOKUSSIERBAR_SELEKTOR));
      if (fokussierbar.length === 0) return;
      const erste = fokussierbar[0];
      const letzte = fokussierbar[fokussierbar.length - 1];
      if (event.shiftKey && document.activeElement === erste) {
        event.preventDefault();
        letzte.focus();
      } else if (!event.shiftKey && document.activeElement === letzte) {
        event.preventDefault();
        erste.focus();
      }
    }
    document.addEventListener("keydown", aufTastendruck);
    return () => {
      document.removeEventListener("keydown", aufTastendruck);
      ausloeser?.focus();
    };
  }, [onClose]);

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
