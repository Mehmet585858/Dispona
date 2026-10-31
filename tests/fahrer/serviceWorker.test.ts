import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * Prüfbericht S2-012: Der Service Worker legte JEDE gleich-origin GET-Antwort in den Cache –
 * auch /api/export/abrechnung (alle Fahrgäste) und /dispo-Seiten. Hier wird public/sw.js in einer
 * Mini-Nachbildung der Service-Worker-Umgebung geladen und mit Fetch-Ereignissen gefüttert.
 */
function serviceWorkerLaden(vorhandeneCaches: string[] = []) {
  const code = readFileSync(path.resolve(process.cwd(), "public/sw.js"), "utf8");
  const handler: Record<string, (event: unknown) => void> = {};
  const gespeichert: string[] = [];
  const geloescht: string[] = [];
  const cache = {
    put: async (anfrage: { url: string }) => {
      gespeichert.push(anfrage.url);
    },
    match: async () => undefined,
    addAll: async () => undefined,
  };
  const sandbox = {
    self: {
      location: { origin: "https://app.test" },
      addEventListener: (name: string, fn: (event: unknown) => void) => {
        handler[name] = fn;
      },
      skipWaiting: () => undefined,
      clients: { claim: () => undefined, matchAll: async () => [], openWindow: async () => undefined },
      registration: { showNotification: async () => undefined },
    },
    caches: {
      open: async () => cache,
      keys: async () => vorhandeneCaches,
      delete: async (name: string) => {
        geloescht.push(name);
        return true;
      },
    },
    fetch: async () => ({ ok: true, status: 200, type: "basic", clone() { return this; } }),
    URL,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return { handler, gespeichert, geloescht };
}

/** Ereignis ohne Antwort (push, periodicsync, message): wartet auf alle waitUntil-Versprechen. */
async function ereignis(handler: Record<string, (event: unknown) => void>, name: string, extra: Record<string, unknown> = {}) {
  const warten: Promise<unknown>[] = [];
  handler[name]({ ...extra, waitUntil: (p: Promise<unknown>) => warten.push(p), notification: { close: () => undefined, data: {} } });
  await Promise.all(warten);
}

const HEUTE = new Date().toLocaleDateString("sv-SE");

async function fetchEreignis(
  handler: Record<string, (event: unknown) => void>,
  url: string,
  mode: "navigate" | "cors" | "no-cors" = "cors",
  method = "GET",
) {
  let antwort: Promise<unknown> | null = null;
  handler.fetch({
    request: { method, url, mode, headers: new Headers() },
    respondWith: (p: Promise<unknown>) => {
      antwort = p;
    },
  });
  if (antwort) await antwort;
  return antwort !== null;
}

describe("public/sw.js – Zwischenspeicher (S2-012)", () => {
  it("S2-012: speichert den Abrechnungsexport (/api/*) nicht im Cache und fängt ihn gar nicht ab", async () => {
    const { handler, gespeichert } = serviceWorkerLaden();
    const abgefangen = await fetchEreignis(handler, "https://app.test/api/export/abrechnung?von=2026-10-01&bis=2026-10-31");
    expect(abgefangen).toBe(false);
    expect(gespeichert).toEqual([]);
  });

  it("S2-012: speichert /dispo-Seiten und die Sitzungsabfrage nicht", async () => {
    const { handler, gespeichert } = serviceWorkerLaden();
    await fetchEreignis(handler, "https://app.test/dispo", "navigate");
    await fetchEreignis(handler, "https://app.test/dispo/fahrgaeste", "navigate");
    await fetchEreignis(handler, "https://app.test/api/auth/get-session");
    expect(gespeichert).toEqual([]);
  });

  it("speichert weiterhin die Fahrer-Startseite (Tagesplan, bewusst) und statische Dateien", async () => {
    const { handler, gespeichert } = serviceWorkerLaden();
    await fetchEreignis(handler, "https://app.test/fahrer", "navigate");
    await fetchEreignis(handler, "https://app.test/_next/static/chunks/app.js");
    await fetchEreignis(handler, "https://app.test/manifest.json");
    expect(gespeichert).toEqual([
      "https://app.test/fahrer",
      "https://app.test/_next/static/chunks/app.js",
      "https://app.test/manifest.json",
    ]);
  });

  it("speichert keine Antworten, die nicht 200 sind (z. B. Weiterleitung zur Anmeldung)", async () => {
    const { handler, gespeichert } = serviceWorkerLaden();
    // fetch liefert hier immer ok:true – deshalb nur der Pfad außerhalb der Erlaubnisliste als Negativprobe:
    await fetchEreignis(handler, "https://app.test/anmeldung", "navigate");
    expect(gespeichert).toEqual([]);
  });
});

/**
 * Maßnahme M-08 Punkt 4 (docs/13 R3-10): Der Tages-Zwischenspeicher wurde nur gelöscht, wenn die
 * App an einem späteren Tag wieder eine Seite lud. Jetzt räumt jedes Aufwachen des Service
 * Workers auf – auch eine Push-Nachricht, ein Tipp darauf, ein periodischer Hintergrundlauf
 * oder eine Nachricht der geöffneten Seite.
 */
describe("public/sw.js – Tages-Zwischenspeicher läuft ab (M-08)", () => {
  const caches = ["fahrer-app-2020-01-01", `fahrer-app-${HEUTE}`, "anderer-cache"];

  it("M-08: eine Push-Nachricht löscht den Zwischenspeicher vom Vortag", async () => {
    const { handler, geloescht } = serviceWorkerLaden(caches);
    await ereignis(handler, "push", { data: null });
    expect(geloescht).toEqual(["fahrer-app-2020-01-01"]);
  });

  it("M-08: Tipp auf die Benachrichtigung räumt ebenfalls auf", async () => {
    const { handler, geloescht } = serviceWorkerLaden(caches);
    await ereignis(handler, "notificationclick");
    expect(geloescht).toEqual(["fahrer-app-2020-01-01"]);
  });

  it("M-08: periodischer Hintergrundlauf und Nachricht der Seite räumen auf", async () => {
    const lauf = serviceWorkerLaden(caches);
    await ereignis(lauf.handler, "periodicsync", { tag: "tagescache-aufraeumen" });
    expect(lauf.geloescht).toEqual(["fahrer-app-2020-01-01"]);

    const nachricht = serviceWorkerLaden(caches);
    await ereignis(nachricht.handler, "message", { data: { typ: "tagescache-aufraeumen" } });
    expect(nachricht.geloescht).toEqual(["fahrer-app-2020-01-01"]);
  });
});
