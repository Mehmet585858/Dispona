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

describe("fahrgastAnonymisieren – vollständiger Datensatz (S2-016)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;

  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: `PRUEF_Loeschung-Voll ${kennung}` } })).id;
  });

  afterAll(async () => {
    await prisma.rideStatusEvent.deleteMany({ where: { tenantId } });
    await prisma.suggestion.deleteMany({ where: { tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.ride.deleteMany({ where: { tenantId } });
    await prisma.rideSeries.deleteMany({ where: { tenantId } });
    await prisma.call.deleteMany({ where: { tenantId } });
    await prisma.approval.deleteMany({ where: { tenantId } });
    await prisma.place.deleteMany({ where: { tenantId } });
    await prisma.passenger.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  it("S2-016: entfernt Hinweise, Zusammenfassung, Anrufernummer, Serienvorlage, GPS-Punkte und den Wohnort-Namen", async () => {
    const wohnung = await prisma.place.create({
      data: { tenantId, label: "Wohnung PRUEF-Testmann", street: "Geheimweg 7", zip: "52062", city: "Aachen", lat: 50.7, lng: 6.0, type: "WOHNUNG" },
    });
    const dialyse = await prisma.place.create({
      data: { tenantId, label: "Dialysezentrum PRUEF", street: "Klinikweg 1", zip: "52062", city: "Aachen", lat: 50.8, lng: 6.1, type: "DIALYSE" },
    });
    const andererFahrgast = await prisma.passenger.create({ data: { tenantId, firstName: "PRUEF", lastName: "Andere", phones: [] } });
    const fahrgast = await prisma.passenger.create({
      data: { tenantId, firstName: "PRUEF", lastName: "Testmann", phones: ["+491700000001"], homePlaceId: wohnung.id },
    });
    const call = await prisma.call.create({
      data: {
        tenantId,
        providerCallId: `PRUEF_call_${kennung}`,
        fromNumber: "+491700000001",
        toNumber: "+4924010000000",
        startedAt: new Date(),
        summary: "PRUEF Testmann bestellt Dialysefahrt Mo 06:30, Rückruf +491700000001",
        transcript: encrypt("PRUEF Transkript"),
        audioUrl: "https://example.com/pruef.mp3",
      },
    });
    const fahrt = await prisma.ride.create({
      data: {
        tenantId, passengerId: fahrgast.id, pickupPlaceId: wohnung.id, dropoffPlaceId: dialyse.id,
        pickupAt: new Date(Date.now() - 86_400_000), transportType: "SITZEND", status: "ERLEDIGT", source: "ANRUF",
        callId: call.id, assistanceNotes: "Sauerstoffgerät, Treppenhilfe 3. OG",
      },
    });
    await prisma.rideStatusEvent.create({ data: { tenantId, rideId: fahrt.id, status: "AN_BORD", lat: 50.7, lng: 6.0 } });
    const serie = await prisma.rideSeries.create({
      data: {
        tenantId, passengerId: fahrgast.id, rrule: "FREQ=WEEKLY;BYDAY=MO", pickupTime: "06:30", until: new Date(Date.now() + 86_400_000 * 30),
        template: { pickupPlaceId: wohnung.id, dropoffPlaceId: dialyse.id, assistanceNotes: "dement, Begleitung", transportType: "SITZEND" },
      },
    });
    // Das Dialysezentrum nutzt auch ein anderer Fahrgast – es darf nicht anonymisiert werden.
    await prisma.ride.create({
      data: {
        tenantId, passengerId: andererFahrgast.id, pickupPlaceId: dialyse.id, dropoffPlaceId: dialyse.id,
        pickupAt: new Date(), transportType: "SITZEND", status: "ERLEDIGT", source: "MANUELL",
      },
    });

    await fahrgastAnonymisieren(tenantId, fahrgast.id);

    const callDanach = await prisma.call.findUniqueOrThrow({ where: { id: call.id } });
    expect(callDanach.summary).toBeNull();
    expect(callDanach.fromNumber).toBeNull();
    expect(callDanach.transcript).toBeNull();
    expect(callDanach.audioUrl).toBeNull();

    const fahrtDanach = await prisma.ride.findUniqueOrThrow({ where: { id: fahrt.id } });
    expect(fahrtDanach.assistanceNotes).toBeNull();
    expect(fahrtDanach.status).toBe("ERLEDIGT");

    const ereignis = await prisma.rideStatusEvent.findFirstOrThrow({ where: { rideId: fahrt.id } });
    expect(ereignis.lat).toBeNull();
    expect(ereignis.lng).toBeNull();

    const serieDanach = await prisma.rideSeries.findUniqueOrThrow({ where: { id: serie.id } });
    expect((serieDanach.template as { assistanceNotes?: string }).assistanceNotes ?? "").toBe("");
    expect(serieDanach.until.getTime()).toBeLessThanOrEqual(Date.now());

    const wohnungDanach = await prisma.place.findUniqueOrThrow({ where: { id: wohnung.id } });
    expect(wohnungDanach.label).not.toContain("Testmann");
    const dialyseDanach = await prisma.place.findUniqueOrThrow({ where: { id: dialyse.id } });
    expect(dialyseDanach.label).toBe("Dialysezentrum PRUEF");
  });
});
