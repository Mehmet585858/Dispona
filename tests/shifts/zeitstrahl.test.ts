import { describe, expect, it } from "vitest";
import { berlinerMitternacht, mitUhrzeit } from "@/core/shifts/week";
import { zeitstrahlBreite, zeitstrahlPosition } from "@/core/shifts/zeitstrahl";

const TAG = berlinerMitternacht("2026-06-15");

describe("zeitstrahlPosition", () => {
  it("setzt 06:00 auf 0% und 22:00 auf 100%", () => {
    expect(zeitstrahlPosition(mitUhrzeit(TAG, "06:00"))).toBe(0);
    expect(zeitstrahlPosition(mitUhrzeit(TAG, "22:00"))).toBe(100);
  });

  it("setzt 14:00 (Mitte der Achse) auf 50%", () => {
    expect(zeitstrahlPosition(mitUhrzeit(TAG, "14:00"))).toBe(50);
  });

  it("klemmt Zeiten vor 06:00 und nach 22:00 an den Rand", () => {
    expect(zeitstrahlPosition(mitUhrzeit(TAG, "02:00"))).toBe(0);
    expect(zeitstrahlPosition(mitUhrzeit(TAG, "23:30"))).toBe(100);
  });
});

describe("zeitstrahlBreite", () => {
  it("berechnet die Breite als Differenz der Positionen", () => {
    expect(zeitstrahlBreite(mitUhrzeit(TAG, "08:00"), mitUhrzeit(TAG, "12:00"))).toBe(25);
  });

  it("wird nie negativ, auch wenn Ende vor Start liegt", () => {
    expect(zeitstrahlBreite(mitUhrzeit(TAG, "12:00"), mitUhrzeit(TAG, "08:00"))).toBe(0);
  });
});
