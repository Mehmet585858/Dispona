import { afterEach, describe, expect, it, vi } from "vitest";

/** Prüfbericht S2-009: Ohne VAPID-Schlüssel landete der Push-Text (Uhrzeit + Abholadresse) im
 * Server-Log – in Produktion identisch. Logs dürfen nur IDs enthalten. */
describe("pushAnFahrer ohne VAPID-Schlüssel (S2-009)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("S2-009: schreibt den Nachrichtentext (Adresse) nicht ins Log", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.resetModules();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { pushAnFahrer } = await import("@/core/notify/push");

    const ergebnis = await pushAnFahrer("PRUEF_tenant", "PRUEF_driver", {
      title: "Neue Fahrt",
      body: "Neue Fahrt 06:30 Geheimweg 7 → Dialysezentrum. Bitte App öffnen.",
    });
    expect(ergebnis).toEqual({ versucht: 0, zugestellt: 0 });
    const alleZeilen = [...log.mock.calls, ...warn.mock.calls].map((a) => String(a[0]));
    for (const zeile of alleZeilen) expect(zeile).not.toContain("Geheimweg");
  });
});
