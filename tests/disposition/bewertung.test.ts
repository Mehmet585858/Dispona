import { describe, expect, it } from "vitest";
import { bewerteKandidat, type KandidatEingabe } from "@/core/disposition/bewertung";

const PICKUP = new Date("2026-10-26T09:00:00+01:00");

const BASIS: KandidatEingabe = {
  vehicleId: "v1",
  driverId: "d1",
  plate: "AC-MK 101",
  transportType: "SITZEND",
  pickupAt: PICKUP,
  appointmentAt: null,
  startZeit: new Date("2026-10-26T08:00:00+01:00"),
  anfahrtMinuten: 10,
  fahrtMinuten: 15,
  leerKm: 3,
  auslastungDifferenz: 0,
};

describe("bewerteKandidat", () => {
  it("ein näheres Fahrzeug (kürzere Anfahrt) bekommt einen besseren (niedrigeren) Score", () => {
    const nah = bewerteKandidat({ ...BASIS, anfahrtMinuten: 5, leerKm: 1 });
    const fern = bewerteKandidat({ ...BASIS, anfahrtMinuten: 20, leerKm: 8 });
    expect(nah.score).toBeLessThan(fern.score);
  });

  it("ein pünktliches, aber etwas weiter entferntes Fahrzeug schlägt ein näheres, das zu spät käme", () => {
    const termin = new Date(PICKUP.getTime() + 30 * 60_000); // 09:30
    const nahAberSpaet = bewerteKandidat({
      ...BASIS,
      appointmentAt: termin,
      anfahrtMinuten: 5,
      fahrtMinuten: 40, // kommt nach 09:30 an -> zu spät
    });
    const fernAberPuenktlich = bewerteKandidat({
      ...BASIS,
      appointmentAt: termin,
      anfahrtMinuten: 15,
      fahrtMinuten: 5, // kommt rechtzeitig an
    });
    expect(nahAberSpaet.zuSpaet).toBe(true);
    expect(fernAberPuenktlich.zuSpaet).toBe(false);
    expect(fernAberPuenktlich.score).toBeLessThan(nahAberSpaet.score);
  });

  it("erkennt eine zerstörte Folgefahrt (negativer Puffer) und schließt den Kandidaten aus", () => {
    const bewertung = bewerteKandidat({ ...BASIS, folgefahrtPufferMinuten: -5 });
    expect(bewertung.passtRein).toBe(false);
  });

  it("lässt einen Kandidaten mit ausreichendem Puffer zur Folgefahrt zu", () => {
    const bewertung = bewerteKandidat({ ...BASIS, folgefahrtPufferMinuten: 30 });
    expect(bewertung.passtRein).toBe(true);
  });

  it("gleicht bei sonst gleichwertigen Kandidaten die Auslastung aus (weniger ausgelastetes Fahrzeug gewinnt)", () => {
    const vielBeschaeftigt = bewerteKandidat({ ...BASIS, auslastungDifferenz: 2 });
    const kaumBeschaeftigt = bewerteKandidat({ ...BASIS, auslastungDifferenz: -2 });
    expect(kaumBeschaeftigt.score).toBeLessThan(vielBeschaeftigt.score);
    expect(kaumBeschaeftigt.begruendung).toContain("gleicht Auslastung aus");
  });

  it("die Auslastung allein überstimmt nie eine deutlich kürzere Anfahrt", () => {
    const nahAberBeschaeftigt = bewerteKandidat({ ...BASIS, anfahrtMinuten: 5, auslastungDifferenz: 2 });
    const fernAberFrei = bewerteKandidat({ ...BASIS, anfahrtMinuten: 20, auslastungDifferenz: -2 });
    expect(nahAberBeschaeftigt.score).toBeLessThan(fernAberFrei.score);
  });

  it("baut eine lesbare Begründung", () => {
    const puenktlich = bewerteKandidat(BASIS);
    expect(puenktlich.begruendung).toContain("Anfahrt 10 Min");
    expect(puenktlich.begruendung).toContain("pünktlich am Ziel");

    const termin = new Date(PICKUP.getTime() + 1 * 60_000);
    const spaet = bewerteKandidat({ ...BASIS, appointmentAt: termin });
    expect(spaet.begruendung).toContain("zu spät");
  });
});
