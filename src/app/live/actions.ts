"use server";

// Öffentliche Server Action für die Live-Demo (/live) - bewusst kein requireSession(), die Seite
// ist ohne Login erreichbar. Lädt NUR den fest verdrahteten Demo-Mandanten (DEMO_TENANT_ID), nie
// eine von außen übergebene tenantId - das ist die einzige Absicherung gegen Mandanten-übergreifende
// Zugriffe hier, siehe src/core/demo/const.ts.
import { fahrplanFuerMandantLaden } from "@/app/dispo/fahrten/actions";
import { withTenant } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { DEMO_TENANT_ID } from "@/core/demo/const";

export async function liveDemoLaden() {
  // oeffentlich=true lässt fahrzeugLiveStatus() den Fahrgastnamen aus "zusatz" weg (sonst z. B.
  // "Fährt zum Fahrgast: M. Mustermann, 14:00") - der einzige Live-Status-Text, der je einen Namen
  // enthält. Alle anderen Zustände (Ankunftszeit, Verspätung, "am Betriebshof") bleiben wie beim
  // echten Dashboard sichtbar. Fahrgastnamen selbst werden NICHT mehr anonymisiert: alle Fahrten
  // der Demo kommen jetzt aus dem festen, erfundenen Fahrgast-Stamm (src/core/demo/const.ts,
  // DEMO_PASSAGIER_ROSTER) über die simulierte Dispona-Disposition (src/core/demo/
  // betriebSimulieren.ts) - keine echten Anrufer mehr, die Telefonnummer ist noch gar nicht
  // angeschaltet (siehe LiveClient.tsx). Sollte die Demo-Nummer später live gehen, braucht ECHTE
  // Anrufer-Daten hier wieder eine eigene Anonymisierung.
  const daten = await fahrplanFuerMandantLaden(DEMO_TENANT_ID, undefined, "tag", true);
  return {
    ...daten,
    liveAnrufe: daten.liveAnrufe.map((anruf) => ({ ...anruf, bekannterFahrgast: null })),
  };
}

/** anrufTranskriptLaden aus dem internen Dispo-Bereich braucht eine Sitzung (requireSession) und
 * schreibt einen AuditLog-Eintrag mit userId - beides für einen anonymen Demo-Besucher unpassend.
 * Eigene, offene Variante hier, aber ebenso fest auf DEMO_TENANT_ID beschränkt. */
export async function liveTranskriptLaden(callId: string): Promise<string | null> {
  const db = withTenant(DEMO_TENANT_ID);
  const anruf = await db.call.findUnique({ where: { id: callId }, select: { transcript: true } });
  if (!anruf?.transcript) return null;
  return decrypt(anruf.transcript);
}
