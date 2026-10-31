import { describe, expect, it } from "vitest";
import { rufnummerE164 } from "@/core/einrichtung/rufnummer";

describe("rufnummerE164 (S2-011)", () => {
  it("nimmt gültige E.164-Nummern an und entfernt Trennzeichen", () => {
    expect(rufnummerE164("+49 2401 111 2222")).toBe("+4924011112222");
    expect(rufnummerE164("0049 2401 1112222")).toBe("+4924011112222");
  });

  it("S2-011: lehnt beliebige Zeichenketten, nationale Schreibweise und leere Eingaben ab", () => {
    expect(rufnummerE164("irgendwas")).toBeNull();
    expect(rufnummerE164("02401 1112222")).toBeNull();
    expect(rufnummerE164("+49")).toBeNull();
    expect(rufnummerE164("")).toBeNull();
  });
});
