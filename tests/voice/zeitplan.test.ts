import { describe, expect, it } from "vitest";
import { aiJetztErreichbar } from "@/core/voice/zeitplan";

const NACHTS = new Date("2026-06-15T02:00:00+02:00"); // Montagnacht
const TAGSUEBER = new Date("2026-06-15T14:00:00+02:00"); // Montagmittag
const WOCHENENDE_TAG = new Date("2026-06-20T14:00:00+02:00"); // Samstagmittag

describe("aiJetztErreichbar", () => {
  it("blockiert immer, wenn aiActive aus ist", () => {
    expect(aiJetztErreichbar(false, { modus: "IMMER" }, TAGSUEBER)).toBe(false);
    expect(aiJetztErreichbar(false, null, NACHTS)).toBe(false);
  });

  it("lässt bei fehlendem Zeitplan jederzeit zu", () => {
    expect(aiJetztErreichbar(true, null, TAGSUEBER)).toBe(true);
  });

  it("IMMER lässt auch werktags tagsüber zu", () => {
    expect(aiJetztErreichbar(true, { modus: "IMMER" }, TAGSUEBER)).toBe(true);
  });

  it("NACHTS_WOCHENENDE lässt nachts zu", () => {
    expect(aiJetztErreichbar(true, { modus: "NACHTS_WOCHENENDE" }, NACHTS)).toBe(true);
  });

  it("NACHTS_WOCHENENDE lässt am Wochenende tagsüber zu", () => {
    expect(aiJetztErreichbar(true, { modus: "NACHTS_WOCHENENDE" }, WOCHENENDE_TAG)).toBe(true);
  });

  it("NACHTS_WOCHENENDE blockiert werktags tagsüber", () => {
    expect(aiJetztErreichbar(true, { modus: "NACHTS_WOCHENENDE" }, TAGSUEBER)).toBe(false);
  });
});
