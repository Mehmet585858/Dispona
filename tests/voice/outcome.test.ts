import { describe, expect, it } from "vitest";
import { outcomeKlassifizieren } from "@/core/voice/outcome";

describe("outcomeKlassifizieren", () => {
  it("erkennt eine Weiterleitung an einen Menschen zuerst, auch wenn schon eine Fahrt erfasst wurde", () => {
    expect(
      outcomeKlassifizieren({ endedReason: "assistant-forwarded-call", hatFahrt: true, fahrtStorniert: false }),
    ).toBe("WEITERGELEITET");
  });

  it("erkennt eine Stornierung während des Gesprächs", () => {
    expect(outcomeKlassifizieren({ hatFahrt: true, fahrtStorniert: true })).toBe("FAHRT_STORNIERT");
  });

  it("erkennt eine erfasste Fahrt", () => {
    expect(outcomeKlassifizieren({ hatFahrt: true, fahrtStorniert: false })).toBe("FAHRT_ERFASST");
  });

  it("fällt ohne Fahrt und ohne Weiterleitung auf 'abgebrochen' zurück", () => {
    expect(outcomeKlassifizieren({ hatFahrt: false, fahrtStorniert: false })).toBe("ABGEBROCHEN");
  });
});
