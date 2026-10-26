import type { SmsProvider } from "./types";

/**
 * Entwicklungs-Anbieter: schreibt die SMS nur ins Terminal.
 * Ein echter EU-SMS-Anbieter (z. B. seven.io, Sipgate) wird erst eingebunden, wenn der
 * Auftraggeber sich für einen entschieden hat (Kosten, siehe CLAUDE.md). Bis dahin reicht
 * diese Schnittstelle: ein echter Anbieter muss nur SmsProvider implementieren und hier
 * eingesetzt werden, der Rest der App ändert sich nicht.
 */
function createConsoleSms(): SmsProvider {
  return {
    name: "konsole",
    async send(toE164, text) {
      console.log(`[Entwicklung] SMS an ${toE164}: ${text}`);
      return { id: `dev-${Date.now()}` };
    },
  };
}

export const smsProvider: SmsProvider = createConsoleSms();
export type { SmsProvider } from "./types";
