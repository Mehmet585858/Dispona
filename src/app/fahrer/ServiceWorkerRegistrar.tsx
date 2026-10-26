"use client";

import { useEffect } from "react";

/** Meldet den Service Worker an, damit die Fahrer-App offline funktioniert und Push empfängt. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Kein Absturz nötig – ohne Service Worker funktioniert die Seite trotzdem, nur ohne Offline/Push.
      });
    }
  }, []);

  return null;
}
