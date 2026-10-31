"use client";

import { useEffect } from "react";
import { alteTagesCachesLoeschen, TAGESCACHE_AUFRAEUMEN } from "./geraeteDaten";

/** Wie oft die geöffnete Fahrer-App den Zwischenspeicher vom Vortag abräumt. */
const AUFRAEUMEN_ALLE_MS = 15 * 60 * 1000;

type RegistrierungMitPeriodicSync = ServiceWorkerRegistration & {
  periodicSync?: { register: (tag: string, optionen: { minInterval: number }) => Promise<void> };
};

/** Meldet den Service Worker an, damit die Fahrer-App offline funktioniert und Push empfängt. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

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
      .then((registrierung: RegistrierungMitPeriodicSync) =>
        // Maßnahme M-08 Punkt 4: wo der Browser es anbietet (installierte App, Chrome/Android),
        // weckt er den Service Worker auch bei geschlossener App etwa zweimal täglich zum Aufräumen.
        registrierung.periodicSync?.register(TAGESCACHE_AUFRAEUMEN, { minInterval: 12 * 60 * 60 * 1000 }),
      )
      .catch(() => {
        // Kein Absturz nötig – ohne Service Worker funktioniert die Seite trotzdem, nur ohne Offline/Push.
      });

    // Maßnahme M-08 Punkt 4: solange die App offen ist, verschwindet der Vortag spätestens nach
    // 15 Minuten bzw. sobald sie wieder in den Vordergrund kommt – nicht erst beim nächsten Neuladen.
    const aufraeumen = () => {
      void alteTagesCachesLoeschen();
      navigator.serviceWorker.controller?.postMessage({ typ: TAGESCACHE_AUFRAEUMEN });
    };
    const beiSichtbarkeit = () => {
      if (document.visibilityState === "visible") aufraeumen();
    };
    aufraeumen();
    const takt = window.setInterval(aufraeumen, AUFRAEUMEN_ALLE_MS);
    document.addEventListener("visibilitychange", beiSichtbarkeit);
    return () => {
      window.clearInterval(takt);
      document.removeEventListener("visibilitychange", beiSichtbarkeit);
    };
  }, []);

  return null;
}
