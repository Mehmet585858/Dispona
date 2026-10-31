const CACHE_PRAEFIX = "fahrer-app-";
const APP_SHELL = ["/fahrer", "/manifest.json", "/icon-192.png"];

// Zwischenspeicher nur für den Tag (docs/08-datenschutz-sicherheit.md): der Name trägt das
// Tagesdatum (lokale Zeit des Geräts), ältere Stände werden bei jeder Gelegenheit gelöscht –
// so bleiben Fahrgastdaten von gestern nicht unbegrenzt auf dem Handy liegen.
function heutigerCacheName() {
  const heute = new Date().toLocaleDateString("sv-SE"); // JJJJ-MM-TT, lokale Zeit
  return `${CACHE_PRAEFIX}${heute}`;
}

async function alteCachesLoeschen() {
  const aktuell = heutigerCacheName();
  const schluessel = await caches.keys();
  await Promise.all(
    schluessel.filter((k) => k.startsWith(CACHE_PRAEFIX) && k !== aktuell).map((k) => caches.delete(k)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(heutigerCacheName()).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(alteCachesLoeschen().then(() => self.clients.claim()));
});

// Was überhaupt zwischengespeichert werden darf (Prüfbericht S2-012). Vorher landete JEDE
// gleich-origin GET-Antwort im Cache – auch /api/export/abrechnung (alle Fahrgäste) und
// /dispo-Seiten. Jetzt nur noch: die Fahrer-Startseite als Seitenaufruf (der Tagesplan, bewusst
// und nur für den Tag, docs/08-datenschutz-sicherheit.md) sowie statische Dateien. Alles andere
// wird gar nicht erst abgefangen und geht normal ins Netz.
function darfZwischenspeichern(request, url) {
  if (url.pathname === "/fahrer") return request.mode === "navigate";
  if (url.pathname.startsWith("/_next/static/")) return true;
  return url.pathname === "/manifest.json" || url.pathname === "/icon-192.png" || url.pathname === "/icon-512.png";
}

// Netzwerk zuerst, bei Funkloch aus dem heutigen Zwischenspeicher (Fahrten des Tages bleiben sichtbar).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!darfZwischenspeichern(event.request, url)) return;

  event.respondWith(
    (async () => {
      await alteCachesLoeschen();
      const cache = await caches.open(heutigerCacheName());
      try {
        const antwort = await fetch(event.request);
        // Nur vollständige 200er-Antworten merken – keine Weiterleitungen (z. B. zur Anmeldung)
        // und keine Fehlerseiten.
        if (antwort.ok && antwort.type === "basic") cache.put(event.request, antwort.clone());
        return antwort;
      } catch {
        return (await cache.match(event.request)) || (await cache.match("/fahrer"));
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  let daten = { title: "Fahrdienst-KI", body: "Neue Nachricht." };
  try {
    daten = event.data ? event.data.json() : daten;
  } catch {
    // Text statt JSON – Vorgabe unverändert lassen.
  }
  event.waitUntil(
    self.registration.showNotification(daten.title, {
      body: daten.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: daten.tag || "fahrdienst-ki",
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { url: daten.url || "/fahrer" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const ziel = event.notification.data?.url || "/fahrer";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fensterListe) => {
      for (const fenster of fensterListe) {
        if (fenster.url.includes("/fahrer") && "focus" in fenster) return fenster.focus();
      }
      return self.clients.openWindow(ziel);
    }),
  );
});
