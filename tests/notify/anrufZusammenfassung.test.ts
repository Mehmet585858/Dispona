import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { encrypt, istVerschluesselt } from "@/lib/crypto";
import { anrufAbschliessen } from "@/core/voice/anruf";
import { prisma } from "@/lib/prisma";
import { mandantKomplettLoeschen } from "@/lib/seedSchutz";

/**
 * Maßnahme M-10 (Prüfbericht S3-024, S3-012): Ohne KI-Schlüssel landete das Roh-Transkript im
 * Klartext in Call.summary; die Zusammenfassung war nie verschlüsselt.
 */
describe("anrufZusammenfassen ohne KI-Schlüssel (M-10, S3-024)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("S3-024: liefert nur einen Hinweis, nie Zeilen des Transkripts", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.resetModules();
    const { anrufZusammenfassen, ZUSAMMENFASSUNG_NICHT_VERFUEGBAR } = await import("@/core/notify/anrufZusammenfassung");
    const ergebnis = await anrufZusammenfassen("KI: Guten Tag.\nAnrufer: Hier PRUEF Testmann, Geheimweg 7, Dialyse Montag.");
    expect(ergebnis).toBe(ZUSAMMENFASSUNG_NICHT_VERFUEGBAR);
    expect(ergebnis).not.toContain("Testmann");
    expect(ergebnis).not.toContain("Geheimweg");
    expect(await anrufZusammenfassen(null)).toBeNull();
  });

  it("zusammenfassungLesbar entschlüsselt neue Zeilen und lässt Bestandszeilen im Klartext durch", async () => {
    const { zusammenfassungLesbar } = await import("@/core/notify/anrufZusammenfassung");
    expect(istVerschluesselt("PRUEF Klartext: alt")).toBe(false);
    expect(zusammenfassungLesbar("PRUEF Klartext: alt")).toBe("PRUEF Klartext: alt");
    const verschluesselt = encrypt("PRUEF neu");
    expect(istVerschluesselt(verschluesselt)).toBe(true);
    expect(zusammenfassungLesbar(verschluesselt)).toBe("PRUEF neu");
    expect(zusammenfassungLesbar(null)).toBeNull();
  });
});

describe("anrufAbschliessen speichert die Zusammenfassung verschlüsselt (M-10, S3-012)", () => {
  const kennung = randomUUID().slice(0, 8);
  let tenantId: string;

  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: `PRUEF_Zusammenfassung ${kennung}` } })).id;
  });
  afterAll(async () => {
    await mandantKomplettLoeschen(tenantId);
  });

  it("S3-012: Call.summary enthält den Text nicht im Klartext", async () => {
    const { zusammenfassungLesbar } = await import("@/core/notify/anrufZusammenfassung");
    const callId = await anrufAbschliessen(
      tenantId,
      { providerCallId: `PRUEF_zf_${kennung}`, fromNumber: "+491700000001", toNumber: "+490", startedAt: new Date(), durationSec: 60, transcript: "PRUEF Transkript", endedReason: "customer-ended-call" },
      "PRUEF Testmann bestellt Dialysefahrt",
    );
    const roh = await prisma.call.findUniqueOrThrow({ where: { id: callId } });
    expect(roh.summary).not.toContain("Testmann");
    expect(istVerschluesselt(roh.summary ?? "")).toBe(true);
    expect(zusammenfassungLesbar(roh.summary)).toBe("PRUEF Testmann bestellt Dialysefahrt");
  });
});
