"use client";

import { useEffect, useRef, useState } from "react";
import { fahrtStatusSetzenFahrer, gesehenBestaetigen, problemMelden } from "./actions";
import {
  WARTESCHLANGE_EREIGNIS,
  warteschlangeEntfernen,
  warteschlangeLaden,
  type WarteschlangenEintrag,
} from "./warteschlange";

const WIEDERHOLUNG_MS = 20_000;

async function eintragSenden(eintrag: WarteschlangenEintrag): Promise<void> {
  switch (eintrag.typ) {
    case "STATUS":
      await fahrtStatusSetzenFahrer(eintrag.daten.rideId, eintrag.daten.status);
      return;
    case "PROBLEM":
      await problemMelden(eintrag.daten.rideId, eintrag.daten.art);
      return;
    case "GESEHEN":
      await gesehenBestaetigen(eintrag.daten.rideId);
      return;
  }
}

/**
 * Sendet die Offline-Warteschlange erneut, sobald wieder Empfang da ist – ohne dass der
 * Fahrer etwas tun muss. Zeigt dabei einen kleinen, sichtbaren Hinweis (Ampel mit Text).
 */
export function OfflineSync() {
  const [laenge, setLaenge] = useState(0);
  const sendetGerade = useRef(false);

  useEffect(() => {
    function aufFrisch() {
      setLaenge(warteschlangeLaden().length);
    }

    async function verarbeiten() {
      if (sendetGerade.current || !navigator.onLine) return;
      sendetGerade.current = true;
      try {
        for (const eintrag of warteschlangeLaden()) {
          if (!navigator.onLine) break;
          try {
            await eintragSenden(eintrag);
            warteschlangeEntfernen(eintrag.id);
          } catch {
            // Online, aber abgelehnt (z. B. Status inzwischen anders) – nicht endlos wiederholen.
            if (navigator.onLine) warteschlangeEntfernen(eintrag.id);
          }
        }
      } finally {
        sendetGerade.current = false;
        aufFrisch();
      }
    }

    Promise.resolve().then(aufFrisch);
    verarbeiten();

    window.addEventListener(WARTESCHLANGE_EREIGNIS, aufFrisch);
    window.addEventListener("online", verarbeiten);
    const intervallId = setInterval(verarbeiten, WIEDERHOLUNG_MS);

    return () => {
      window.removeEventListener(WARTESCHLANGE_EREIGNIS, aufFrisch);
      window.removeEventListener("online", verarbeiten);
      clearInterval(intervallId);
    };
  }, []);

  if (laenge === 0) return null;

  return (
    <p className="mt-4 text-sm text-warn-ink">
      {laenge} {laenge === 1 ? "Meldung wird" : "Meldungen werden"} gesendet, sobald wieder Empfang da ist.
    </p>
  );
}
