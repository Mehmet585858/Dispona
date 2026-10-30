"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Misst laufend die Höhe eines Elements per ResizeObserver - für zwei nebeneinanderstehende
 * Karten, von denen die zweite exakt so hoch sein soll wie die erste (Anruf-Karte = Höhe der
 * Zeitstrahl-Karte, siehe DispoClient.tsx/LiveClient.tsx), deren Höhe aber vom Inhalt abhängt
 * (Anzahl Fahrzeugzeilen) und sich deshalb nicht fest in CSS angeben lässt. Startet bei
 * anfangsHoehe (sinnvoller Platzhalter, bis die erste echte Messung da ist), statt bei undefined -
 * sonst hätte die zweite Karte vor der ersten Messung keine definierte Höhe und ein `height: 100%`
 * innen würde kurz auf 0px zusammenklappen.
 */
export function useGemesseneHoehe<T extends HTMLElement>(anfangsHoehe: number) {
  const ref = useRef<T>(null);
  const [hoehe, setHoehe] = useState(anfangsHoehe);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const beobachter = new ResizeObserver(([eintrag]) => setHoehe(eintrag.contentRect.height));
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);

  return { ref, hoehe };
}
