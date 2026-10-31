"use client";

import { useEffect } from "react";

/** Meldet den Service Worker an, damit die Fahrer-App offline funktioniert und Push empfängt. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Geltungsbereich nur /fahrer (Prüfbericht S2-012): /dispo im selben Browser läuft ohne
      // Service Worker. Ältere Registrierungen mit Geltungsbereich "/" werden dabei entfernt.
      navigator.serviceWorker
        .getRegistrations()
        .then((registrierungen) =>
          Promise.all(
            registrierungen
              .filter((r) => !new URL(r.scope).pathname.startsWith("/fahrer"))
              .map((r) => r.unregister()),
          ),
        )
        .then(() => navigator.serviceWorker.register("/sw.js", { scope: "/fahrer" }))
        .catch(() => {
          // Kein Absturz nötig – ohne Service Worker funktioniert die Seite trotzdem, nur ohne Offline/Push.
        });
    }
  }, []);

  return null;
}
