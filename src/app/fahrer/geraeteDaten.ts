import { warteschlangeLeeren } from "./warteschlange";

/** Muss zum Namenspräfix in public/sw.js passen (dort ohne Import möglich). */
const CACHE_PRAEFIX = "fahrer-app-";

/**
 * Löscht alles, was die Fahrer-App lokal auf dem Gerät hält: den Tages-Zwischenspeicher des
 * Service Workers (enthält den Tagesplan mit Namen) und die Offline-Warteschlange. Wird beim
 * Abmelden aufgerufen (Prüfbericht S2-012: vorher blieb beides nach Logout liegen).
 */
export async function geraeteDatenLoeschen(): Promise<void> {
  try {
    if (typeof caches !== "undefined" && caches) {
      const schluessel = await caches.keys();
      await Promise.all(schluessel.filter((k) => k.startsWith(CACHE_PRAEFIX)).map((k) => caches.delete(k)));
    }
  } catch {
    // Kein Zugriff auf die Cache-API (z. B. privater Modus) – dann gibt es auch nichts zu löschen.
  }
  warteschlangeLeeren();
}
