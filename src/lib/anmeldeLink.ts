/**
 * Fahrer melden sich per Einmal-Link an (CLAUDE.md). better-auth erzeugt den Link, wir
 * stellen ihn zu – an die Handynummer des Fahrerkontos, per SmsProvider (Prüfbericht S1-002:
 * vorher wurde der Link in Produktion nirgends versendet, die Anfrage meldete trotzdem Erfolg).
 * Die technische E-Mail des Fahrers (fahrer-<nummer>@fahrer.intern) ist nur der Schlüssel.
 */
import { anmeldeLinkText } from "@/core/notify/texte";
import { smsProvider } from "@/providers/sms";
import { prisma } from "./prisma";

export async function anmeldeLinkZustellen(
  { email, url }: { email: string; url: string },
  abhaengigkeiten: {
    handynummerSuchen?: (email: string) => Promise<string | null>;
    senden?: (toE164: string, text: string) => Promise<unknown>;
  } = {},
): Promise<void> {
  const handynummerSuchen =
    abhaengigkeiten.handynummerSuchen ??
    (async (mail: string) => {
      const user = await prisma.user.findUnique({ where: { email: mail }, select: { phone: true, role: true } });
      return user?.role === "FAHRER" ? (user.phone ?? null) : null;
    });
  const senden = abhaengigkeiten.senden ?? ((an, text) => smsProvider.send(an, text));

  const handynummer = await handynummerSuchen(email);
  if (!handynummer) {
    throw new Error("Für dieses Fahrerkonto ist keine Handynummer hinterlegt. Der Anmelde-Link kann nicht zugestellt werden.");
  }
  await senden(handynummer, anmeldeLinkText(url));
}
