import { telefonMaskiert } from "@/core/notify/telefonMaskierung";
import { entwicklungsLog } from "@/lib/logging";
import type { SmsProvider } from "./types";

/**
 * SMS-Versand (Fahrer-Anmelde-Link, Eskalationen, Inhaber-Alarm).
 *
 * Ein echter EU-SMS-Anbieter (z. B. seven.io, Sipgate) wird erst eingebunden, wenn der
 * Auftraggeber sich für einen entschieden hat (Kosten, siehe CLAUDE.md). Ein echter Anbieter
 * muss nur SmsProvider implementieren und unten eingesetzt werden, der Rest der App ändert sich nicht.
 *
 * Bis dahin gilt (Prüfbericht S1-002, S2-009):
 * - Entwicklung/Test: kein Versand. Nur mit NODE_ENV=development wird die Nachricht ins Terminal
 *   geschrieben (für den lokalen Fahrer-Login nötig), mit maskierter Rufnummer.
 * - Produktion: send() wirft SmsNichtEingerichtetError. Besser ein lauter Fehler (Anmeldung
 *   meldet "Link konnte nicht gesendet werden", Eskalation vermerkt den Fehler an der
 *   Benachrichtigung) als ein stilles Nichts im Nachtbetrieb.
 */
export class SmsNichtEingerichtetError extends Error {
  constructor() {
    super("Kein SMS-Anbieter eingerichtet. Versand nicht möglich.");
  }
}

function createConsoleSms(): SmsProvider {
  return {
    name: "konsole",
    async send(toE164, text) {
      entwicklungsLog(`SMS an ${telefonMaskiert(toE164)}: ${text}`);
      return { id: `dev-${Date.now()}` };
    },
  };
}

function createNichtEingerichtetSms(): SmsProvider {
  return {
    name: "nicht-eingerichtet",
    async send() {
      throw new SmsNichtEingerichtetError();
    },
  };
}

export const smsProvider: SmsProvider =
  process.env.NODE_ENV === "production" ? createNichtEingerichtetSms() : createConsoleSms();
export type { SmsProvider } from "./types";
