import { afterEach, describe, expect, it, vi } from "vitest";

/** Prüfbericht S1-002 / S2-009: Platzhalter-SMS dürfen in Produktion nicht still "gelingen" und
 * dürfen außerhalb der lokalen Entwicklung keine Rufnummern/Texte ins Log schreiben. */
describe("smsProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("S1-002: wirft in Produktion ohne eingerichteten Anbieter statt still nichts zu senden", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { smsProvider, SmsNichtEingerichtetError } = await import("@/providers/sms");
    expect(smsProvider.name).toBe("nicht-eingerichtet");
    await expect(smsProvider.send("+491700000001", "PRUEF Text")).rejects.toBeInstanceOf(SmsNichtEingerichtetError);
  });

  it("S2-009: schreibt im Test-/Produktionslauf weder Rufnummer noch Text ins Log", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.resetModules();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { smsProvider } = await import("@/providers/sms");
    await smsProvider.send("+491700000001", "Neue Fahrt 02:09 Geheimweg 7 → Dialyse");
    expect(log).not.toHaveBeenCalled();
  });

  it("S2-009: in der lokalen Entwicklung wird die Rufnummer maskiert", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { smsProvider } = await import("@/providers/sms");
    await smsProvider.send("+491700000001", "PRUEF Text");
    expect(log).toHaveBeenCalledTimes(1);
    const zeile = String(log.mock.calls[0][0]);
    expect(zeile).not.toContain("+491700000001");
    expect(zeile).toContain("· · · ·");
  });
});
