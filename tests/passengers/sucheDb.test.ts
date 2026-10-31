import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { werkzeugAusfuehren } from "@/core/voice/werkzeuge";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/**
 * Maßnahme M-06 / Prüfbericht S2-006: Die Namenssuche lud nur die ersten 300 Fahrgäste ohne
 * Sortierung – ab mittelgroßem Betrieb wurden Stammkunden nicht gefunden und doppelt angelegt.
 */
describe("fahrgast_suchen über die Datenbank (M-06, S2-006)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;
  let callId: string;
  let gesuchteId: string;

  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: `PRUEF_Suche500 ${kennung}` } })).id;
    callId = (
      await prisma.call.create({
        data: { tenantId, providerCallId: `PRUEF_suche_${kennung}`, toNumber: "+490", fromNumber: "+491700000412", startedAt: new Date() },
      })
    ).id;
    // 411 Fahrgäste davor, der gesuchte an Position 412, danach noch 88 weitere.
    const fueller = (von: number, bis: number) =>
      Array.from({ length: bis - von }, (_, i) => ({
        tenantId,
        firstName: "PRUEF",
        lastName: `Fueller${String(von + i).padStart(4, "0")}`,
        phones: [] as string[],
      }));
    await prisma.passenger.createMany({ data: fueller(0, 411) });
    gesuchteId = (
      await prisma.passenger.create({
        data: { tenantId, firstName: "PRUEF", lastName: "Schmitt", birthDate: new Date("1950-01-02"), phones: ["+491700000412"] },
      })
    ).id;
    await prisma.passenger.createMany({ data: fueller(411, 499) });
  });

  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  it("S2-006: findet Zeile 412 von 500 über den Nachnamen (mit Tippfehler) und die Anrufernummer", async () => {
    const ergebnis = await werkzeugAusfuehren(tenantId, callId, {
      id: randomUUID(),
      name: "fahrgast_suchen",
      arguments: { nachname: "Schmidt" },
    });
    expect(ergebnis.result).toContain(`passengerId ${gesuchteId}`);
  });

  it("findet Zeile 412 auch über Nachname + Geburtsdatum ohne passende Anrufernummer", async () => {
    const andererAnruf = await prisma.call.create({
      data: { tenantId, providerCallId: `PRUEF_suche2_${kennung}`, toNumber: "+490", fromNumber: "+491799999999", startedAt: new Date() },
    });
    const ergebnis = await werkzeugAusfuehren(tenantId, andererAnruf.id, {
      id: randomUUID(),
      name: "fahrgast_suchen",
      arguments: { nachname: "Schmitt", geburtsdatum: "1950-01-02" },
    });
    expect(ergebnis.result).toContain(`passengerId ${gesuchteId}`);
  });
});
