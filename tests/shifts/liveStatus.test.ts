import { describe, expect, it } from "vitest";
import { fahrzeugLiveStatus, type FahrtFuerLiveStatus } from "@/core/shifts/liveStatus";

function fahrt(teil: Partial<FahrtFuerLiveStatus>): FahrtFuerLiveStatus {
  return {
    status: "DISPONIERT",
    pickupAt: new Date("2026-10-28T13:00:00+01:00"),
    geplantesEnde: new Date("2026-10-28T13:30:00+01:00"),
    completedAt: null,
    driverDelayMin: null,
    passagierName: "J. Kramer",
    ...teil,
  };
}

describe("fahrzeugLiveStatus", () => {
  it("zeigt 'Fahrgast im Auto' mit Ankunftszeit, wenn eine Fahrt AN_BORD ist", () => {
    const jetzt = new Date("2026-10-28T13:10:00+01:00");
    const status = fahrzeugLiveStatus([fahrt({ status: "AN_BORD" })], jetzt);
    expect(status).toEqual({ punkt: "in", label: "Fahrgast im Auto", zusatz: "Ankunft 13:30" });
  });

  it("zeigt 'Fährt zum Fahrgast' mit Namen und Zeit, wenn pünktlich unterwegs", () => {
    const jetzt = new Date("2026-10-28T12:50:00+01:00");
    const status = fahrzeugLiveStatus([fahrt({ status: "UNTERWEGS" })], jetzt);
    expect(status).toEqual({ punkt: "go", label: "Fährt zum Fahrgast", zusatz: "J. Kramer, 13:00" });
  });

  it("zeigt die Verspätung statt Name/Zeit, wenn der Fahrer eine Verzögerung gemeldet hat", () => {
    const jetzt = new Date("2026-10-28T13:05:00+01:00");
    const status = fahrzeugLiveStatus([fahrt({ status: "UNTERWEGS", driverDelayMin: 12 })], jetzt);
    expect(status).toEqual({ punkt: "late", label: "Fährt zum Fahrgast", zusatz: "+12 Min." });
  });

  it("zeigt 'Fahrgast am Ziel seit ...' für eine kürzlich erledigte Fahrt", () => {
    const jetzt = new Date("2026-10-28T13:25:00+01:00");
    const status = fahrzeugLiveStatus(
      [fahrt({ status: "ERLEDIGT", completedAt: new Date("2026-10-28T13:20:00+01:00") })],
      jetzt,
    );
    expect(status).toEqual({ punkt: "at", label: "Fahrgast am Ziel", zusatz: "seit 13:20" });
  });

  it("verbirgt 'Fahrgast am Ziel' nach einer Stunde und zeigt stattdessen Frei", () => {
    const jetzt = new Date("2026-10-28T15:00:00+01:00");
    const status = fahrzeugLiveStatus(
      [fahrt({ status: "ERLEDIGT", completedAt: new Date("2026-10-28T13:20:00+01:00") })],
      jetzt,
    );
    expect(status).toEqual({ punkt: "free", label: "Frei", zusatz: "am Betriebshof" });
  });

  it("zeigt Frei, wenn es heute keine relevante Fahrt gibt", () => {
    const jetzt = new Date("2026-10-28T09:00:00+01:00");
    const status = fahrzeugLiveStatus([], jetzt);
    expect(status).toEqual({ punkt: "free", label: "Frei", zusatz: "am Betriebshof" });
  });

  it("bevorzugt AN_BORD, auch wenn eine andere Fahrt heute schon erledigt ist", () => {
    const jetzt = new Date("2026-10-28T13:10:00+01:00");
    const status = fahrzeugLiveStatus(
      [
        fahrt({ status: "ERLEDIGT", completedAt: new Date("2026-10-28T11:00:00+01:00") }),
        fahrt({ status: "AN_BORD" }),
      ],
      jetzt,
    );
    expect(status.label).toBe("Fahrgast im Auto");
  });
});
