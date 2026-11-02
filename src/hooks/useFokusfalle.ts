"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOKUSSIERBAR_SELEKTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Fokusfalle für Überlagerungen (docs/DESIGN-GUIDE.md Abschnitt 9, 5.6): Beim Öffnen springt der
 * Fokus hinein (auf `startSelektor` oder das erste bedienbare Element), Tab bleibt darin gefangen,
 * Esc schließt, und beim Schließen springt der Fokus zurück zum Auslöser. Genutzt von Modal und
 * SidePanel.
 */
export function useFokusfalle(ref: RefObject<HTMLElement | null>, onClose: () => void, startSelektor?: string) {
  // onClose über eine Ref: ein neu erzeugter Rückruf bei jedem Render soll den Fokus nicht wieder
  // an den Anfang springen lassen (die Falle wird nur beim Öffnen aufgebaut).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const ausloeser = document.activeElement as HTMLElement | null;
    const start =
      (startSelektor ? ref.current?.querySelector<HTMLElement>(startSelektor) : null) ??
      ref.current?.querySelector<HTMLElement>(FOKUSSIERBAR_SELEKTOR);
    (start ?? ref.current)?.focus();

    function aufTastendruck(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !ref.current) return;
      const fokussierbar = Array.from(ref.current.querySelectorAll<HTMLElement>(FOKUSSIERBAR_SELEKTOR));
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
      if (ausloeser && document.contains(ausloeser)) ausloeser.focus();
    };
  }, [ref, startSelektor]);
}
