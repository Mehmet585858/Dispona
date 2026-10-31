import { warteschlangeLeeren } from "./warteschlange";

/** Muss zum Namenspräfix in public/sw.js passen (dort ohne Import möglich). */
const CACHE_PRAEFIX = "fahrer-app-";

/** Muss zu AUFRAEUM_TAG in public/sw.js passen. */
export const TAGESCACHE_AUFRAEUMEN = "tagescache-aufraeumen";

/**
 * Tagesname des Zwischenspeichers wie in public/sw.js (JJJJ-MM-TT in der Zeit des Geräts). Bewusst
 * nicht über src/core/shifts/week.ts: der Service Worker benennt den Cache nach der Gerätezeit,
 * und genau dieser Name muss hier getroffen werden.
 */
function heutigerCacheTag(): string {
  return new Date().toLocaleDateString("sv-SE");
}

/**
 * Maßnahme M-08 Punkt 4 (docs/13 R3-10): löscht die Zwischenspeicher früherer Tage. Läuft beim Start
 * der Fahrer-App, alle 15 Minuten und beim Zurückholen in den Vordergrund (ServiceWorkerRegistrar)
 * – vorher verschwand der Vortag erst, wenn die App an einem späteren Tag eine Seite neu lud.
 */
export async function alteTagesCachesLoeschen(heute: string = heutigerCacheTag()): Promise<void> {
  try {
    if (typeof caches === "undefined" || !caches) return;
    const aktuell = `${CACHE_PRAEFIX}${heute}`;
    const schluessel = await caches.keys();
    await Promise.all(schluessel.filter((k) => k.startsWith(CACHE_PRAEFIX) && k !== aktuell).map((k) => caches.delete(k)));
  } catch {
    // Kein Zugriff auf die Cache-API – nichts zu löschen.
  }
}

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
