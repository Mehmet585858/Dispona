import { describe, expect, it, vi } from "vitest";
import { fehlendeUmgebungsvariablen, PFLICHT_IN_PRODUKTION, umgebungPruefen } from "@/lib/umgebung";
import { anmeldeCodeZustellen } from "@/lib/anmeldeCode";

const VOLLSTAENDIG = Object.fromEntries(PFLICHT_IN_PRODUKTION.map((v) => [v.name, "x"]));

describe("M-03: Umgebungsprüfung beim Start", () => {
  it("meldet nichts, wenn alle Pflichtvariablen gesetzt sind", () => {
    expect(fehlendeUmgebungsvariablen(VOLLSTAENDIG)).toEqual([]);
    expect(umgebungPruefen(VOLLSTAENDIG, "production")).toEqual([]);
  });

  it("M-03 (S4-013): Start in Produktion scheitert mit klarer Meldung, wenn RESEND_API_KEY oder VAPID-Schlüssel fehlen", () => {
    const ohneMail = { ...VOLLSTAENDIG, RESEND_API_KEY: "" };
    expect(() => umgebungPruefen(ohneMail, "production")).toThrow(/RESEND_API_KEY/);
    const ohnePush = { ...VOLLSTAENDIG, VAPID_PRIVATE_KEY: undefined };
    expect(() => umgebungPruefen(ohnePush, "production")).toThrow(/VAPID_PRIVATE_KEY/);
  });

  it("warnt in Entwicklung nur, statt zu werfen", () => {
    const warnen = vi.fn();
    const fehlend = umgebungPruefen({ ...VOLLSTAENDIG, CRON_SECRET: undefined }, "development", warnen);
    expect(fehlend).toHaveLength(1);
    expect(warnen).toHaveBeenCalledTimes(1);
  });

  it("verlangt (noch) keinen SMS-Schlüssel – der Anbieter ist eine offene Entscheidung", () => {
    expect(PFLICHT_IN_PRODUKTION.map((v) => v.name)).not.toContain("SMS_API_KEY");
  });
});

describe("M-03: Einmal-Code fürs Büro", () => {
  it("M-03 (S4-013): ohne RESEND_API_KEY wirft die Zustellung statt still zu scheitern", async () => {
    const senden = vi.fn(async () => {});
    await expect(anmeldeCodeZustellen({ email: "b@test.de", otp: "123456" }, { apiKeyVorhanden: false, senden })).rejects.toThrow(
      /RESEND_API_KEY/,
    );
    expect(senden).not.toHaveBeenCalled();
  });

  it("schickt den Code per E-Mail, wenn der Schlüssel da ist", async () => {
    const senden = vi.fn(async () => {});
    await anmeldeCodeZustellen({ email: "b@test.de", otp: "123456" }, { apiKeyVorhanden: true, senden });
    expect(senden).toHaveBeenCalledTimes(1);
    const [nachricht] = senden.mock.calls[0] as unknown as [{ an: string; betreff: string; html: string }];
    expect(nachricht.an).toBe("b@test.de");
    expect(nachricht.html).toContain("123456");
  });
});
