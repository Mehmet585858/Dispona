import { describe, expect, it } from "vitest";
import {
  berlinerMitternacht,
  datumIso,
  kalenderwocheIso,
  mitUhrzeit,
  monatsTageIso,
  montagVonIso,
  tagKurzIso,
  tagVerschieben,
  wochenStart,
  wochenTage,
  wochentagVonIso,
} from "@/core/shifts/week";

describe("core/shifts/week – Zeitzone Europe/Berlin", () => {
  it("findet für einen Montag in der Winterzeit denselben Tag als Wochenstart", () => {
    // 2026-10-26 ist ein Montag, kurz nach der Umstellung auf Winterzeit.
    const montag = berlinerMitternacht("2026-10-26");
    expect(datumIso(wochenStart(montag))).toBe("2026-10-26");
  });

  it("findet für einen Tag mitten in der Woche den richtigen Montag, über den DST-Wechsel hinweg", () => {
    // 2026-10-30 (Freitag) liegt in derselben Woche wie der 2026-10-26 (Montag),
    // obwohl der DST-Wechsel (25.10.) dazwischenliegt.
    const freitag = berlinerMitternacht("2026-10-30");
    expect(datumIso(wochenStart(freitag))).toBe("2026-10-26");
  });

  it("liefert 7 aufeinanderfolgende Kalendertage", () => {
    const montag = berlinerMitternacht("2026-10-26");
    const tage = wochenTage(montag).map(datumIso);
    expect(tage).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("datumIso(berlinerMitternacht(x)) ist wieder x (Rundreise)", () => {
    for (const tag of ["2026-01-01", "2026-03-29", "2026-10-25", "2026-10-26", "2026-12-31"]) {
      expect(datumIso(berlinerMitternacht(tag))).toBe(tag);
    }
  });

  it("mitUhrzeit setzt die Uhrzeit auf den richtigen Kalendertag, auch über den DST-Wechsel", () => {
    const tag = berlinerMitternacht("2026-10-26");
    const start = mitUhrzeit(tag, "06:00");
    expect(datumIso(start)).toBe("2026-10-26");
    expect(start.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })).toBe(
      "06:00",
    );
  });

  it("tagVerschieben rechnet kalendersicher über Monats- und DST-Grenzen", () => {
    expect(tagVerschieben("2026-10-31", 1)).toBe("2026-11-01");
    expect(tagVerschieben("2026-10-24", 7)).toBe("2026-10-31");
  });

  it("Schichtplan-Helfer: Wochentag, Monatstage, Montag, Kurzdatum, Kalenderwoche aus Kalendertagen", () => {
    expect(wochentagVonIso("2026-11-02")).toBe(0);
    expect(wochentagVonIso("2026-11-08")).toBe(6);
    expect(monatsTageIso("2026-11-15")).toHaveLength(30);
    expect(monatsTageIso("2028-02-10").at(-1)).toBe("2028-02-29");
    expect(montagVonIso("2026-11-01")).toBe("2026-10-26");
    expect(montagVonIso("2026-11-02")).toBe("2026-11-02");
    expect(tagKurzIso("2026-11-02")).toBe("02.11.");
    expect(kalenderwocheIso("2026-11-02")).toBe(45);
    expect(kalenderwocheIso("2027-01-01")).toBe(53);
    expect(kalenderwocheIso("2027-01-04")).toBe(1);
  });
});
