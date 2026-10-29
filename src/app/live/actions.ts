"use server";

// Öffentliche Server Action für die Live-Demo (/live) - bewusst kein requireSession(), die Seite
// ist ohne Login erreichbar. Lädt NUR den fest verdrahteten Demo-Mandanten (DEMO_TENANT_ID), nie
// eine von außen übergebene tenantId - das ist die einzige Absicherung gegen Mandanten-übergreifende
// Zugriffe hier, siehe src/core/demo/const.ts.
import { fahrplanFuerMandantLaden } from "@/app/dispo/fahrten/actions";
import { withTenant } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { DEMO_TENANT_ID } from "@/core/demo/const";

/** Erste-Buchstaben-Darstellung statt vollem Namen - echte Anrufer der Live-Demo sind reale
 * Personen, nicht erfundene Demo-Daten, und die Seite ist ohne Login für jeden einsehbar. */
function anonymisiert(firstName: string, lastName: string): { firstName: string; lastName: string } {
  return {
    firstName: firstName ? `${firstName.charAt(0)}.` : "",
    lastName: lastName ? `${lastName.charAt(0)}.` : "",
  };
}

export async function liveDemoLaden() {
  const daten = await fahrplanFuerMandantLaden(DEMO_TENANT_ID, undefined, "tag");
  return {
    ...daten,
    fahrten: daten.fahrten.map((fahrt) => ({
      ...fahrt,
      passenger: { ...anonymisiert(fahrt.passenger.firstName, fahrt.passenger.lastName), phones: [], insurer: null },
    })),
    // Enthält sonst den vollen Fahrgastnamen in "zusatz" (z. B. "Fährt zum Fahrgast: M. Mustermann,
    // 14:00") - wird von der Live-Demo-Seite aktuell nirgends angezeigt, aber steckt trotzdem im an
    // den Browser gesendeten JSON und wäre über die Entwicklertools einsehbar.
    fahrzeugZeilen: daten.fahrzeugZeilen.map((zeile) => ({ ...zeile, live: { ...zeile.live, zusatz: "" } })),
    liveAnrufe: daten.liveAnrufe.map((anruf) => ({
      ...anruf,
      fahrt: anruf.fahrt
        ? { ...anruf.fahrt, passenger: anonymisiert(anruf.fahrt.passenger.firstName, anruf.fahrt.passenger.lastName) }
        : null,
      // "Nummer bekannt von <Name>" würde einen wiederkehrenden echten Anrufer identifizieren -
      // für die öffentliche Demo nicht nötig.
      bekannterFahrgast: null,
    })),
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
