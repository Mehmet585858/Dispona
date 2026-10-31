/**
 * Ratenbegrenzung der öffentlichen Registrierung (Maßnahme M-23 Punkt 2, Prüfbericht S2-011): vorher
 * konnte jeder ohne Begrenzung beliebig viele Fahrdienste anlegen. Höchstens REGISTRIERUNGEN_JE_STUNDE
 * je Anschluss und REGISTRIERUNGEN_JE_STUNDE_GESAMT plattformweit.
 *
 * Plattformweit statt mandantenbezogen, weil vor der Registrierung noch kein Mandant existiert – wie
 * Job, deshalb direkt prisma statt withTenant (siehe src/lib/db.ts). Der Anschluss wird nur gehasht
 * gespeichert (mit AUTH_SECRET), Einträge älter als 24 Stunden werden beim nächsten Versuch gelöscht.
 * E-Mail-Bestätigung und Besitzprüfung der Rufnummer: Entscheidung des Auftraggebers (Protokoll).
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const REGISTRIERUNGEN_JE_STUNDE = 5;
export const REGISTRIERUNGEN_JE_STUNDE_GESAMT = 100;

function schluesselFuer(anschluss: string): string {
  return createHash("sha256").update(`${process.env.AUTH_SECRET ?? ""}:${anschluss}`).digest("hex");
}

/** Zählt den Versuch und sagt, ob er noch erlaubt ist. */
export async function registrierungErlaubt(anschluss: string, jetzt: Date = new Date()): Promise<boolean> {
  const schluessel = schluesselFuer(anschluss);
  const vorEinerStunde = new Date(jetzt.getTime() - 60 * 60_000);
  await prisma.registrierungsversuch.deleteMany({ where: { at: { lt: new Date(jetzt.getTime() - 24 * 60 * 60_000) } } });
  const [eigene, gesamt] = await Promise.all([
    prisma.registrierungsversuch.count({ where: { schluessel, at: { gte: vorEinerStunde } } }),
    prisma.registrierungsversuch.count({ where: { at: { gte: vorEinerStunde } } }),
  ]);
  if (eigene >= REGISTRIERUNGEN_JE_STUNDE || gesamt >= REGISTRIERUNGEN_JE_STUNDE_GESAMT) return false;
  await prisma.registrierungsversuch.create({ data: { schluessel, at: jetzt } });
  return true;
}
