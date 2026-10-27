import { describe, expect, it } from "vitest";
import { telefonMaskiert } from "@/core/notify/telefonMaskierung";

describe("telefonMaskiert", () => {
  it("versteckt die letzten 4 Ziffern", () => {
    expect(telefonMaskiert("+491701234567")).toBe("+49170123· · · ·");
  });

  it("lässt sehr kurze Nummern unverändert", () => {
    expect(telefonMaskiert("12345")).toBe("12345");
  });
});
