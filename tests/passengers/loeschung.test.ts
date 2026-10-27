import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fahrgastAnonymisieren, fahrgastExportieren } from "@/core/passengers/loeschung";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

describe("fahrgastExportieren / fahrgastAnonymisieren", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let ortId: string;
  let passengerId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({ data: { name: `Test-Loeschung ${kennung}` } });
    tenantId = tenant.id;
    const ort = await prisma.place.create({
      data: { tenantId, label: "Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
    });
    ortId = ort.id;
    const passenger = await prisma.passenger.create({
      data: {
        tenantId,
        firstName: "Erika",
        lastName: "Schmitz",
        birthDate: new Date("1945-03-12"),
        phones: ["+4924011112222"],
        insurer: "AOK",
        notes: "Rollstuhl",
      },
    });
    passengerId = passenger.id;
  });

  afterAll(async () => {
    await prisma.rideStatusEvent.deleteMany({ where: { tenantId } });
    await prisma.suggestion.deleteMany({ where: { tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.ride.deleteMany({ where: { tenantId } });
    await prisma.call.deleteMany({ where: { tenantId } });
    await prisma.approval.deleteMany({ where: { tenantId } });
    await prisma.place.deleteMany({ where: { tenantId } });
    await prisma.passenger.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  async function neueFahrt(status: "ERFASST" | "ERLEDIGT") {
    return prisma.ride.create({
      data: {
        tenantId,
        passengerId,
        pickupPlaceId: ortId,
        dropoffPlaceId: ortId,
        pickupAt: new Date(),
        transportType: "SITZEND",
        status,
        source: "MANUELL",
      },
    });
  }

  it("exportiert Stammdaten, Fahrten und entschlüsseltes Transkript", async () => {
    const call = await prisma.call.create({
      data: {
        tenantId,
        providerCallId: `call-${kennung}`,
        toNumber: "+4924010000000",
        startedAt: new Date(),
        transcript: encrypt("Anrufer: Hallo, ich brauche eine Fahrt."),
      },
    });
    await prisma.ride.create({
      data: {
        tenantId,
        passengerId,
        pickupPlaceId: ortId,
        dropoffPlaceId: ortId,
        pickupAt: new Date(),
        transportType: "SITZEND",
        status: "ERFASST",
        source: "ANRUF",
        callId: call.id,
      },
    });

    const export_ = await fahrgastExportieren(tenantId, passengerId);
    expect(export_.fahrgast.firstName).toBe("Erika");
    expect(export_.fahrgast.insurer).toBe("AOK");
    expect(export_.fahrten).toHaveLength(1);
    expect(export_.fahrten[0].anruf?.transkript).toBe("Anrufer: Hallo, ich brauche eine Fahrt.");

    await prisma.ride.deleteMany({ where: { passengerId } });
    await prisma.call.delete({ where: { id: call.id } });
  });

  it("anonymisiert die Stammdaten und storniert noch nicht begonnene Fahrten, lässt erledigte unangetastet", async () => {
    const offeneFahrt = await neueFahrt("ERFASST");
    const erledigteFahrt = await neueFahrt("ERLEDIGT");

    const ergebnis = await fahrgastAnonymisieren(tenantId, passengerId);
    expect(ergebnis.stornierteFahrten).toBe(1);

    const fahrgast = await prisma.passenger.findUniqueOrThrow({ where: { id: passengerId } });
    expect(fahrgast.firstName).toBe("Gelöscht");
    expect(fahrgast.lastName).toBe("");
    expect(fahrgast.birthDate).toBeNull();
    expect(fahrgast.phones).toEqual([]);
    expect(fahrgast.insurer).toBeNull();
    expect(fahrgast.notes).toBeNull();

    const aktualisierteOffeneFahrt = await prisma.ride.findUniqueOrThrow({ where: { id: offeneFahrt.id } });
    expect(aktualisierteOffeneFahrt.status).toBe("STORNIERT");

    const aktualisierteErledigteFahrt = await prisma.ride.findUniqueOrThrow({ where: { id: erledigteFahrt.id } });
    expect(aktualisierteErledigteFahrt.status).toBe("ERLEDIGT");
  });

  it("löscht Genehmigungen beim Anonymisieren", async () => {
    const neuerFahrgast = await prisma.passenger.create({
      data: { tenantId, firstName: "Test", lastName: "Fahrgast", phones: [] },
    });
    await prisma.approval.create({
      data: { tenantId, passengerId: neuerFahrgast.id, validFrom: new Date(), validUntil: new Date() },
    });

    await fahrgastAnonymisieren(tenantId, neuerFahrgast.id);

    const genehmigungen = await prisma.approval.findMany({ where: { passengerId: neuerFahrgast.id } });
    expect(genehmigungen).toHaveLength(0);
  });
});
