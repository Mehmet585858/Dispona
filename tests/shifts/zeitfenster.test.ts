import { describe, expect, it } from "vitest";
import { istNachtsInBerlin, istWochenendeInBerlin } from "@/core/shifts/zeitfenster";

describe("istNachtsInBerlin", () => {
  it("erkennt die Nacht vor 6 Uhr und ab 22 Uhr", () => {
    expect(istNachtsInBerlin(new Date("2026-06-15T03:00:00+02:00"))).toBe(true);
    expect(istNachtsInBerlin(new Date("2026-06-15T23:00:00+02:00"))).toBe(true);
  });

  it("erkennt den Tag zwischen 6 und 22 Uhr nicht als Nacht", () => {
    expect(istNachtsInBerlin(new Date("2026-06-15T14:00:00+02:00"))).toBe(false);
    expect(istNachtsInBerlin(new Date("2026-06-15T06:00:00+02:00"))).toBe(false);
  });
});

describe("istWochenendeInBerlin", () => {
  it("erkennt Samstag und Sonntag", () => {
    expect(istWochenendeInBerlin(new Date("2026-06-20T12:00:00+02:00"))).toBe(true); // Samstag
    expect(istWochenendeInBerlin(new Date("2026-06-21T12:00:00+02:00"))).toBe(true); // Sonntag
  });

  it("erkennt Werktage nicht als Wochenende", () => {
    expect(istWochenendeInBerlin(new Date("2026-06-19T12:00:00+02:00"))).toBe(false); // Freitag
  });
});
