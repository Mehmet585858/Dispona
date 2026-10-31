import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fahrtErfassen } from "@/core/rides/erfassen";
import { fahrtAendern } from "@/core/rides/aendern";
import { serieAnlegen } from "@/core/rides/serie";
import { fahrzeugZuweisen } from "@/core/disposition/zuweisen";
import { referenzenPruefen } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/**
 * Prüfbericht S2-008: withTenant() filtert die Zieltabelle, aber nicht die Fremdschlüssel im
 * Schreibvorgang. Eine Fahrt für Mandant A durfte auf Fahrgast und Ort von Mandant B zeigen –
 * danach sah A über include den Namen und das Geburtsdatum des fremden Fahrgasts.
 */
describe("Fremdschlüssel über die Mandantengrenze (S2-008)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantA: string;
  let tenantB: string;
  let fahrgastB: string;
  let ortB: string;
  let fahrzeugB: string;
  let fahrgastA: string;
  let ortA: string;

  beforeAll(async () => {
    const a = await prisma.tenant.create({
      data: {
        name: `PRUEF_A ${kennung}`,
        settings: { create: { greeting: "x", voiceId: "x", escalationNumber: "+4900", openingHours: {}, serviceAreaCenter: { lat: 50.77, lng: 6.08 } } },
      },
    });
    const b = await prisma.tenant.create({ data: { name: `PRUEF_B ${kennung}` } });
    tenantA = a.id;
    tenantB = b.id;
    fahrgastB = (
      await prisma.passenger.create({
        data: { tenantId: tenantB, firstName: "PRUEF", lastName: "B-Fremd", birthDate: new Date("1941-05-03"), phones: [] },
      })
    ).id;
    ortB = (
      await prisma.place.create({
        data: { tenantId: tenantB, label: "PRUEF Ort B", street: "B 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "WOHNUNG" },
      })
    ).id;
    fahrzeugB = (await prisma.vehicle.create({ data: { tenantId: tenantB, plate: `PRUEF-B-${kennung}` } })).id;
    fahrgastA = (await prisma.passenger.create({ data: { tenantId: tenantA, firstName: "PRUEF", lastName: "A", phones: [] } })).id;
    ortA = (
      await prisma.place.create({
        data: { tenantId: tenantA, label: "PRUEF Ort A", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
      })
    ).id;
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantA);
    await mandantKomplettLoeschen(tenantB);
  });

  const eingabe = {
    datum: "2026-11-02",
    abholzeit: "09:00",
    terminzeit: "",
    rueckfahrt: false,
    rueckfahrtzeit: "",
    transportType: "SITZEND" as const,
    companion: false,
    assistanceNotes: "",
    prescription: "JA" as const,
    approval: "NICHT_NOETIG" as const,
  };

  it("S2-008: fahrtErfassen lehnt Fahrgast und Orte eines anderen Mandanten ab und legt nichts an", async () => {
    await expect(
      fahrtErfassen(tenantA, { ...eingabe, passengerId: fahrgastB, pickupPlaceId: ortB, dropoffPlaceId: ortB }, { source: "MANUELL" }),
    ).rejects.toThrow();
    await expect(
      fahrtErfassen(tenantA, { ...eingabe, passengerId: fahrgastA, pickupPlaceId: ortA, dropoffPlaceId: ortB }, { source: "MANUELL" }),
    ).rejects.toThrow();
    expect(await prisma.ride.count({ where: { tenantId: tenantA } })).toBe(0);
    expect(await prisma.ride.count({ where: { passengerId: fahrgastB } })).toBe(0);
  });

  it("S2-008: serieAnlegen lehnt fremde Referenzen ab, bevor die Serie entsteht", async () => {
    await expect(
      serieAnlegen(
        tenantA,
        { ...eingabe, passengerId: fahrgastB, pickupPlaceId: ortA, dropoffPlaceId: ortA, wochentage: ["MO"], bis: "2026-12-31" },
        { source: "MANUELL" },
      ),
    ).rejects.toThrow();
    expect(await prisma.rideSeries.count({ where: { tenantId: tenantA } })).toBe(0);
  });

  it("S2-008: fahrtAendern lehnt einen fremden Ort ab", async () => {
    const fahrt = await prisma.ride.create({
      data: { tenantId: tenantA, passengerId: fahrgastA, pickupPlaceId: ortA, dropoffPlaceId: ortA, pickupAt: new Date(), transportType: "SITZEND", status: "ERFASST", source: "MANUELL" },
    });
    await expect(fahrtAendern(tenantA, fahrt.id, { pickupPlaceId: ortB })).rejects.toThrow();
    const danach = await prisma.ride.findUniqueOrThrow({ where: { id: fahrt.id } });
    expect(danach.pickupPlaceId).toBe(ortA);
  });

  it("S2-008: fahrzeugZuweisen lehnt ein Fahrzeug eines anderen Mandanten ab", async () => {
    const fahrt = await prisma.ride.create({
      data: { tenantId: tenantA, passengerId: fahrgastA, pickupPlaceId: ortA, dropoffPlaceId: ortA, pickupAt: new Date(Date.now() + 3_600_000), transportType: "SITZEND", status: "ERFASST", source: "MANUELL" },
    });
    await expect(fahrzeugZuweisen(tenantA, fahrt.id, fahrzeugB, { dispatchMode: "MANUELL" })).rejects.toThrow();
    const danach = await prisma.ride.findUniqueOrThrow({ where: { id: fahrt.id } });
    expect(danach.vehicleId).toBeNull();
  });

  it("referenzenPruefen: eigene IDs gehen durch, fremde und unbekannte nicht", async () => {
    await expect(referenzenPruefen(tenantA, { passenger: [fahrgastA], place: [ortA, ortA] })).resolves.toBeUndefined();
    await expect(referenzenPruefen(tenantA, { passenger: [fahrgastB] })).rejects.toThrow(/Fahrgast/);
    await expect(referenzenPruefen(tenantA, { vehicle: ["gibt-es-nicht"] })).rejects.toThrow(/Fahrzeug/);
  });
});
