import { afterEach, describe, expect, it, vi } from "vitest";
import { geraeteDatenLoeschen } from "@/app/fahrer/geraeteDaten";

/** Prüfbericht S2-012: Beim Abmelden blieben Cache (Tagesplan mit Namen) und die
 * Offline-Warteschlange auf dem Gerät – auch nach Kündigung oder Geräteverkauf. */
describe("geraeteDatenLoeschen (S2-012)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("S2-012: löscht alle Fahrer-App-Caches und die Offline-Warteschlange", async () => {
    const geloescht: string[] = [];
    vi.stubGlobal("caches", {
      keys: async () => ["fahrer-app-2026-10-30", "fahrer-app-2026-10-31", "anderer-cache"],
      delete: async (name: string) => {
        geloescht.push(name);
        return true;
      },
    });
    const entfernt: string[] = [];
    vi.stubGlobal("localStorage", {
      removeItem: (schluessel: string) => entfernt.push(schluessel),
      getItem: () => null,
      setItem: () => undefined,
    });
    vi.stubGlobal("window", { dispatchEvent: () => true });

    await geraeteDatenLoeschen();

    expect(geloescht.sort()).toEqual(["fahrer-app-2026-10-30", "fahrer-app-2026-10-31"]);
    expect(entfernt).toContain("fahrdienst-ki:warteschlange");
  });

  it("wirft nicht, wenn der Browser keine Cache-API hat", async () => {
    vi.stubGlobal("caches", undefined);
    vi.stubGlobal("localStorage", { removeItem: () => undefined });
    vi.stubGlobal("window", { dispatchEvent: () => true });
    await expect(geraeteDatenLoeschen()).resolves.toBeUndefined();
  });
});
