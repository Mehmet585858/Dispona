import { describe, expect, it, vi } from "vitest";
import { anmeldeLinkZustellen } from "@/lib/anmeldeLink";

describe("anmeldeLinkZustellen (S1-002)", () => {
  it("S1-002: schickt den Einmal-Link per SMS an die Handynummer des Fahrerkontos", async () => {
    const senden = vi.fn(async () => ({ id: "x" }));
    await anmeldeLinkZustellen(
      { email: "fahrer-491700000001@fahrer.intern", url: "https://app.example/api/auth/magic-link/verify?token=abc" },
      { handynummerSuchen: async () => "+491700000001", senden },
    );
    expect(senden).toHaveBeenCalledTimes(1);
    const [an, text] = senden.mock.calls[0] as unknown as [string, string];
    expect(an).toBe("+491700000001");
    expect(text).toContain("token=abc");
  });

  it("S1-002: wirft, wenn keine Handynummer hinterlegt ist – statt 'Link gesendet' zu melden", async () => {
    const senden = vi.fn(async () => ({ id: "x" }));
    await expect(
      anmeldeLinkZustellen({ email: "x@fahrer.intern", url: "https://x" }, { handynummerSuchen: async () => null, senden }),
    ).rejects.toThrow(/keine Handynummer/);
    expect(senden).not.toHaveBeenCalled();
  });

  it("S1-002: reicht den Fehler des SMS-Anbieters durch (kein stilles Verschlucken)", async () => {
    await expect(
      anmeldeLinkZustellen(
        { email: "x@fahrer.intern", url: "https://x" },
        { handynummerSuchen: async () => "+491700000001", senden: async () => { throw new Error("Kein SMS-Anbieter eingerichtet."); } },
      ),
    ).rejects.toThrow(/Kein SMS-Anbieter/);
  });
});
