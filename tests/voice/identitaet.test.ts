import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { werkzeugAusfuehren } from "@/core/voice/werkzeuge";
import { zusammenfassungLesbar } from "@/core/notify/anrufZusammenfassung";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/**
 * Maßnahme M-13 (Prüfbericht S2-002, docs/13 R2-11): Die KI am Telefon glaubte dem Anrufer seine
 * Telefonnummer. Wer die Handynummer einer fremden Person kannte, bekam Geburtsdatum und
 * Fahrgast-ID und konnte damit deren Fahrten ansehen, ändern und stornieren.
 */
describe("Identitätsbindung im Voice-Agent (M-13)", () => {
  const kennung = randomUUID().slice(0, 8);
  const ANRUFER = "+4911100000001";
  const FREMDE_NUMMER = "+4922200000002";
  let tenantId: string;
  let ortId: string;
  let eigenerFahrgast: string;
  let fremderFahrgast: string;
  let fremdeFahrt: string;
  let eigeneFahrt: string;
  let zaehler = 0;

  async function neuerAnruf(fromNumber: string | null = ANRUFER) {
    zaehler += 1;
    return (
      await prisma.call.create({
        data: { tenantId, providerCallId: `PRUEF_id_${kennung}_${zaehler}`, fromNumber, toNumber: "+4924010000000", startedAt: new Date() },
      })
    ).id;
  }

  function aufruf(callId: string, name: string, args: Record<string, unknown>) {
    zaehler += 1;
    return werkzeugAusfuehren(tenantId, callId, { id: `PRUEF_tc_${kennung}_${zaehler}`, name, arguments: args });
  }

  async function fahrt(passengerId: string) {
    return (
      await prisma.ride.create({
        data: {
          tenantId,
          passengerId,
          pickupPlaceId: ortId,
          dropoffPlaceId: ortId,
          pickupAt: new Date(Date.now() + 2 * 24 * 3600_000),
          transportType: "SITZEND",
          status: "ERFASST",
          source: "MANUELL",
        },
      })
    ).id;
  }

  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: `PRUEF_Identitaet ${kennung}` } })).id;
    ortId = (
      await prisma.place.create({
        data: { tenantId, label: "PRUEF Ort", street: "A 1", zip: "52062", city: "Aachen", lat: 50.77, lng: 6.08, type: "SONSTIGES" },
      })
    ).id;
    eigenerFahrgast = (
      await prisma.passenger.create({
        data: { tenantId, firstName: "PRUEF", lastName: "Anrufer", birthDate: new Date("1950-01-01T00:00:00Z"), phones: [ANRUFER] },
      })
    ).id;
    fremderFahrgast = (
      await prisma.passenger.create({
        data: { tenantId, firstName: "PRUEF", lastName: "Fremdperson", birthDate: new Date("1940-05-06T00:00:00Z"), phones: [FREMDE_NUMMER] },
      })
    ).id;
    fremdeFahrt = await fahrt(fremderFahrgast);
    eigeneFahrt = await fahrt(eigenerFahrgast);
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  it("M-13 (S2-002): Anruf von +49111…, genannte Nummer +49222… liefert keinen Treffer und kein Geburtsdatum", async () => {
    const callId = await neuerAnruf();
    const ergebnis = await aufruf(callId, "fahrgast_suchen", { telefon: FREMDE_NUMMER });
    expect(ergebnis.result ?? "").not.toContain(fremderFahrgast);
    expect(ergebnis.result ?? "").not.toContain("1940");
    expect(ergebnis.result ?? "").not.toContain("Fremdperson");
  });

  it("M-13: die echte Anrufernummer erkennt den Fahrgast – ohne sein Geburtsdatum vorzulesen", async () => {
    const callId = await neuerAnruf();
    const ergebnis = await aufruf(callId, "fahrgast_suchen", { telefon: ANRUFER });
    expect(ergebnis.result).toContain(eigenerFahrgast);
    expect(ergebnis.result).not.toContain("1950");
  });

  it("M-13 (R2-11): fahrt_stornieren mit fremder rideId wird abgelehnt, die Fahrt bleibt", async () => {
    const callId = await neuerAnruf();
    await aufruf(callId, "fahrgast_suchen", { telefon: ANRUFER });
    const ergebnis = await aufruf(callId, "fahrt_stornieren", { rideId: fremdeFahrt });
    expect(ergebnis.result ?? ergebnis.error).toMatch(/nicht bestätigt|gehört nicht/i);
    expect((await prisma.ride.findUniqueOrThrow({ where: { id: fremdeFahrt } })).status).toBe("ERFASST");
  });

  it("M-13: fahrt_aendern, abholzeit_auskunft und fahrt_finden für einen fremden Fahrgast werden abgelehnt", async () => {
    const callId = await neuerAnruf();
    const aendern = await aufruf(callId, "fahrt_aendern", { rideId: fremdeFahrt, abholzeit: "11:00" });
    expect(aendern.result ?? aendern.error).toMatch(/nicht bestätigt|gehört nicht/i);
    const auskunft = await aufruf(callId, "abholzeit_auskunft", { rideId: fremdeFahrt });
    expect(auskunft.result ?? auskunft.error).toMatch(/nicht bestätigt|gehört nicht/i);
    const finden = await aufruf(callId, "fahrt_finden", { passengerId: fremderFahrgast });
    expect(finden.result ?? finden.error).toMatch(/nicht bestätigt/i);
    expect(finden.result ?? "").not.toContain(fremdeFahrt);
  });

  it("M-13: fahrt_anlegen mit der passengerId eines nicht bestätigten Fahrgasts legt nichts an", async () => {
    const callId = await neuerAnruf();
    const vorher = await prisma.ride.count({ where: { tenantId, passengerId: fremderFahrgast } });
    const ergebnis = await aufruf(callId, "fahrt_anlegen", {
      passengerId: fremderFahrgast,
      pickupPlaceId: ortId,
      dropoffPlaceId: ortId,
      datum: "2026-11-20",
      abholzeit: "09:00",
      transportType: "SITZEND",
      prescription: "JA",
      approval: "NICHT_NOETIG",
    });
    expect(ergebnis.result ?? ergebnis.error).toMatch(/nicht bestätigt/i);
    expect(await prisma.ride.count({ where: { tenantId, passengerId: fremderFahrgast } })).toBe(vorher);
  });

  it("M-13: Nachname + Geburtsdatum bestätigen die Identität (Angehörige, andere Nummer); danach sind die Fahrten zugänglich", async () => {
    const callId = await neuerAnruf();
    const ohneGeburtsdatum = await aufruf(callId, "fahrgast_suchen", { nachname: "Fremdperson", telefon: FREMDE_NUMMER });
    expect(ohneGeburtsdatum.result ?? "").not.toContain(fremderFahrgast);

    const mit = await aufruf(callId, "fahrgast_suchen", { nachname: "Fremdperson", geburtsdatum: "1940-05-06" });
    expect(mit.result).toContain(fremderFahrgast);
    const finden = await aufruf(callId, "fahrt_finden", { passengerId: fremderFahrgast });
    expect(finden.result).toContain(fremdeFahrt);
  });

  it("M-13: über die Anrufernummer erkannte Fahrgäste dürfen ihre eigene Fahrt ändern", async () => {
    const callId = await neuerAnruf();
    const ergebnis = await aufruf(callId, "fahrt_aendern", { rideId: eigeneFahrt, assistanceNotes: "PRUEF Hinweis" });
    expect(ergebnis.error).toBeUndefined();
    expect(ergebnis.result).toMatch(/geändert/);
  });

  it("M-13: rueckruf_anlegen ergänzt die Zusammenfassung statt sie zu überschreiben", async () => {
    const callId = await neuerAnruf();
    await prisma.call.update({ where: { id: callId }, data: { summary: encrypt("PRUEF bisherige Notiz") } });
    await aufruf(callId, "rueckruf_anlegen", { telefon: "+4924010000009", anliegen: "PRUEF Anliegen" });
    const text = zusammenfassungLesbar((await prisma.call.findUniqueOrThrow({ where: { id: callId } })).summary) ?? "";
    expect(text).toContain("PRUEF bisherige Notiz");
    expect(text).toContain("PRUEF Anliegen");
  });
});
