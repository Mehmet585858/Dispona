const CACHE_NAME = "fahrer-app-v1";
const APP_SHELL = ["/fahrer", "/manifest.json", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((schluessel) => Promise.all(schluessel.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Netzwerk zuerst, bei Funkloch aus dem Zwischenspeicher (Fahrten des Tages bleiben sichtbar).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((antwort) => {
        const kopie = antwort.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, kopie));
        return antwort;
      })
      .catch(() => caches.match(event.request).then((treffer) => treffer || caches.match("/fahrer"))),
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
