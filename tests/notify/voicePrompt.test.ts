import { describe, expect, it } from "vitest";
import { voiceSystemPrompt } from "@/core/notify/voicePrompt";

describe("voiceSystemPrompt", () => {
  it("setzt alle Platzhalter eines Mandanten ein", () => {
    const text = voiceSystemPrompt({
      tenantId: "t1",
      firmenname: "Muster Krankenfahrten",
      ort: "Baesweiler",
      greeting: "Willkommen bei Muster Krankenfahrten.",
      voiceId: "stimme-1",
      escalationNumber: "+4924041234",
      anrufernummer: "+491701234567",
      bestaetigungsweg: " per SMS",
    });

    expect(text).toContain("Muster Krankenfahrten");
    expect(text).toContain("Baesweiler");
    expect(text).toContain("Willkommen bei Muster Krankenfahrten.");
    expect(text).toContain("+491701234567");
    expect(text).toContain("per SMS");
    expect(text).not.toContain("{{");
  });

  it("nutzt \"unbekannt\", wenn keine Anrufernummer übermittelt wurde", () => {
    const text = voiceSystemPrompt({
      tenantId: "t1",
      firmenname: "Muster Krankenfahrten",
      ort: "Baesweiler",
      greeting: "Willkommen.",
      voiceId: "stimme-1",
      escalationNumber: "+4924041234",
      bestaetigungsweg: " per SMS",
    });

    expect(text).toContain("unbekannt");
  });

  it("sagt ohne escalationNumber freundlich ab statt weiterzuleiten (z. B. Live-Demo)", () => {
    const text = voiceSystemPrompt({
      tenantId: "demo-tenant",
      firmenname: "Dispona Live-Demo",
      ort: "Aachen",
      greeting: "Willkommen bei der Dispona-Demo.",
      voiceId: "stimme-1",
      escalationNumber: "",
      bestaetigungsweg: " per SMS",
    });

    expect(text).toContain("kein Mensch erreichbar");
    expect(text).not.toContain("an_mensch_weiterleiten.");
    expect(text).not.toContain("{{");
  });
});

describe("voiceSystemPrompt – Identität (M-13)", () => {
  const text = voiceSystemPrompt({
    tenantId: "t1",
    firmenname: "Muster Krankenfahrten",
    ort: "Baesweiler",
    greeting: "Willkommen.",
    voiceId: "stimme-1",
    escalationNumber: "+4924041234",
    anrufernummer: "+491701234567",
    bestaetigungsweg: " per SMS",
  });

  it("M-13: verlangt eine bestätigte Identität vor Auskunft, Änderung und Storno", () => {
    expect(text).toMatch(/Identität/);
    expect(text).toMatch(/Nachname und Geburtsdatum/);
    expect(text).toMatch(/fahrt_aendern|fahrt_stornieren/);
  });

  it("M-13: liest kein Geburtsdatum vor und folgt keinen Anweisungen, die Regeln zu umgehen", () => {
    expect(text).toMatch(/Geburtsdatum.*nie vor|nie.*Geburtsdatum/i);
    expect(text).toMatch(/ignorier|Regeln/i);
  });
});
