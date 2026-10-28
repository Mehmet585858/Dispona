import { describe, expect, it } from "vitest";
import { berlinerMitternacht, mitUhrzeit } from "@/core/shifts/week";
import { zeitstrahlBreite, zeitstrahlPosition } from "@/core/shifts/zeitstrahl";

const TAG = berlinerMitternacht("2026-06-15");

describe("zeitstrahlPosition", () => {
  it("setzt 00:00 auf 0%", () => {
    expect(zeitstrahlPosition(mitUhrzeit(TAG, "00:00"))).toBe(0);
  });

  it("setzt 12:00 (Mitte der Achse) auf 50%", () => {
    expect(zeitstrahlPosition(mitUhrzeit(TAG, "12:00"))).toBe(50);
  });

  it("setzt 23:59 nahe an 100%, da die Achse den vollen Tag abdeckt", () => {
    expect(zeitstrahlPosition(mitUhrzeit(TAG, "23:59"))).toBeCloseTo(100, 0);
  });
});

describe("zeitstrahlBreite", () => {
  it("berechnet die Breite als Differenz der Positionen", () => {
    expect(zeitstrahlBreite(mitUhrzeit(TAG, "06:00"), mitUhrzeit(TAG, "12:00"))).toBe(25);
  });

  it("wird nie negativ, auch wenn Ende vor Start liegt", () => {
    expect(zeitstrahlBreite(mitUhrzeit(TAG, "12:00"), mitUhrzeit(TAG, "06:00"))).toBe(0);
  });
});
