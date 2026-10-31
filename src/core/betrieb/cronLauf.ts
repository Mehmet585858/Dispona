/**
 * Betriebssicherheit der Cron-Läufe (Maßnahme M-16, Prüfbericht S2-010, S3-011, docs/13 R2-3).
 *
 * - Laufsperre je Cron und Mandant: ein zweiter, überlappender Lauf beendet sich sofort.
 * - Fehlerisolierung: eine einzelne Fahrt (bzw. ein einzelner Mandant), die unerwartet wirft, hält
 *   den Rest nicht auf.
 * - Laufprotokoll: letzter Start, letzter Erfolg, letzte Fehlerart je Cron und Mandant.
 * - Überwachung: fehlt der Erfolg zu lange, bekommt der Inhaber einen Alarm.
 *
 * Fehler werden nur als Fehlerart (z. B. "TypeError") festgehalten und protokolliert – Meldungstexte
 * können Daten enthalten (Prisma-Fehler zitieren z. B. Abfragewerte).
 */
import { withTenant } from "@/lib/db";
import { smsProvider } from "@/providers/sms";
import { cronAusfallAlarmText } from "@/core/notify/texte";
import { berlinerMitternacht } from "@/core/shifts/week";

/** Nach dieser Zeit gilt eine nicht gelöste Sperre als verwaist (Absturz, Zeitlimit der Plattform). */
export const CRON_SPERRE_MIN = 10;
/** Ohne erfolgreichen Lauf seit dieser Zeit wird der Inhaber alarmiert. */
export const CRON_ALARM_NACH_MIN = 15;

/** Minütlich erwartete Crons, die überwacht werden. */
export const UEBERWACHTE_CRONS = ["automodus", "eskalation"] as const;

export function fehlerArt(fehler: unknown): string {
  if (fehler instanceof Error) {
    const code = (fehler as { code?: unknown }).code;
    return typeof code === "string" ? `${fehler.name} ${code}` : fehler.name;
  }
  return "Unbekannt";
}

export type CronLaufErgebnis<T> =
  | { status: "gelaufen"; ergebnis: T }
  | { status: "gesperrt" }
  | { status: "fehler"; fehler: string };

/**
 * Führt `arbeit` aus, wenn kein anderer Lauf desselben Crons für diesen Mandanten läuft. Die Sperre
 * ist eine Zeile mit Ablaufzeit (CronLauf.laeuftSeit) statt eines Advisory-Locks: sitzungsgebundene
 * Locks halten hinter einem Transaktions-Pooler (Neon "-pooler") nicht zuverlässig.
 */
export async function cronLaufMitSperre<T>(tenantId: string, cron: string, arbeit: () => Promise<T>): Promise<CronLaufErgebnis<T>> {
  const db = withTenant(tenantId);
  const jetzt = new Date();
  const verwaist = new Date(jetzt.getTime() - CRON_SPERRE_MIN * 60_000);

  try {
    await db.cronLauf.createMany({ data: [{ tenantId, cron }], skipDuplicates: true });
  } catch {
    // Zeile existiert schon (oder wurde gerade parallel angelegt) – die Sperre unten entscheidet.
  }
  const sperre = await db.cronLauf.updateMany({
    where: { cron, OR: [{ laeuftSeit: null }, { laeuftSeit: { lt: verwaist } }] },
    data: { laeuftSeit: jetzt, letzterStart: jetzt },
  });
  if (sperre.count !== 1) return { status: "gesperrt" };

  try {
    const ergebnis = await arbeit();
    await db.cronLauf.updateMany({ where: { cron }, data: { laeuftSeit: null, letzterErfolg: new Date() } });
    return { status: "gelaufen", ergebnis };
  } catch (fehler) {
    const art = fehlerArt(fehler);
    console.error("Cron-Lauf fehlgeschlagen", { tenantId, cron, fehler: art });
    await db.cronLauf.updateMany({
      where: { cron },
      data: { laeuftSeit: null, letzterFehler: art, letzterFehlerAm: new Date() },
    });
    return { status: "fehler", fehler: art };
  }
}

/**
 * Bearbeitet jeden Eintrag für sich: wirft einer, wird `beiFehler` aufgerufen (z. B. Vermerk an der
 * Fahrt) und die Schleife läuft weiter. Vorher brach eine einzige Fahrt die ganze Liste ab – jede
 * Minute erneut, bis zum Morgen.
 */
export async function jeEintragIsoliert<T>(
  eintraege: T[],
  bearbeiten: (eintrag: T) => Promise<void>,
  beiFehler: (eintrag: T, fehler: unknown) => Promise<void>,
): Promise<{ fehler: number }> {
  let fehler = 0;
  for (const eintrag of eintraege) {
    try {
      await bearbeiten(eintrag);
    } catch (ausnahme) {
      fehler += 1;
      try {
        await beiFehler(eintrag, ausnahme);
      } catch {
        // Auch der Vermerk scheiterte (z. B. Datenbank weg) – der Lauf geht trotzdem weiter.
      }
    }
  }
  return { fehler };
}

export type MandantErgebnis<T> = { tenantId: string; status: "ok"; ergebnis: T } | { tenantId: string; status: "fehler"; fehler: string };

/** Wie Promise.allSettled über alle Mandanten, nacheinander: ein Mandant blockiert die anderen nicht. */
export async function fuerAlleMandanten<T>(tenantIds: string[], arbeit: (tenantId: string) => Promise<T>): Promise<MandantErgebnis<T>[]> {
  const ergebnisse: MandantErgebnis<T>[] = [];
  for (const tenantId of tenantIds) {
    try {
      ergebnisse.push({ tenantId, status: "ok", ergebnis: await arbeit(tenantId) });
    } catch (fehler) {
      const art = fehlerArt(fehler);
      console.error("Cron für Mandant fehlgeschlagen", { tenantId, fehler: art });
      ergebnisse.push({ tenantId, status: "fehler", fehler: art });
    }
  }
  return ergebnisse;
}

/**
 * "Plan für morgen" für heute beanspruchen – atomar und VOR dem Lauf (S3-011, R2-3). Vorher wurde das
 * Kennzeichen erst nach dem Lauf gesetzt: dauerte der Lauf länger als eine Minute oder warf er,
 * rechnete der nächste Takt alles noch einmal (doppelte Vorschläge, konkurrierende Zuweisungen).
 * `heuteIso` ist das Berliner Datum (src/core/shifts/week.ts datumIso).
 */
export async function planFuerMorgenBeanspruchen(tenantId: string, heuteIso: string): Promise<boolean> {
  const tagesbeginn = berlinerMitternacht(heuteIso);
  const ergebnis = await withTenant(tenantId).tenantSettings.updateMany({
    where: { tenantId, OR: [{ planFuerMorgenLauf: null }, { planFuerMorgenLauf: { lt: tagesbeginn } }] },
    data: { planFuerMorgenLauf: new Date() },
  });
  return ergebnis.count === 1;
}

/**
 * Überwachung (Punkt 4): Fehlt bei einem minütlichen Cron der erfolgreiche Lauf seit mehr als
 * CRON_ALARM_NACH_MIN Minuten, bekommt der Inhaber einmal je Ausfall eine SMS (alertPhone). Der
 * Automodus wird nur überwacht, wenn er eingeschaltet ist. Läuft aus einem anderen Cron heraus
 * (eskalation überwacht automodus und umgekehrt); fällt der ganze Zeitplaner aus, hilft nur eine
 * Überwachung von außen (siehe Behebungsprotokoll, Vorschläge).
 */
export async function cronUeberwachen(tenantId: string, jetzt: Date = new Date()): Promise<{ alarme: number; fehler: number }> {
  const db = withTenant(tenantId);
  const settings = await db.tenantSettings.findUnique({ where: { tenantId }, select: { alertPhone: true, autoMode: true } });
  if (!settings?.alertPhone) return { alarme: 0, fehler: 0 };

  const grenze = new Date(jetzt.getTime() - CRON_ALARM_NACH_MIN * 60_000);
  const laeufe = await db.cronLauf.findMany({ where: { cron: { in: [...UEBERWACHTE_CRONS, "planFuerMorgen"] } } });
  let alarme = 0;
  let fehler = 0;
  for (const lauf of laeufe) {
    if (lauf.cron === "automodus" && settings.autoMode === "AUS") continue;
    let bezugszeit: Date;
    if (lauf.cron === "planFuerMorgen") {
      // Läuft einmal am Abend: Alarm, wenn der letzte Lauf fehlgeschlagen ist.
      if (!lauf.letzterFehlerAm || (lauf.letzterErfolg && lauf.letzterErfolg > lauf.letzterFehlerAm)) continue;
      bezugszeit = lauf.letzterFehlerAm;
    } else {
      // Minütlich: Alarm, wenn der letzte Erfolg zu lange her ist (nie erfolgreich: ab erstem Start).
      const letzterGuterStand = lauf.letzterErfolg ?? lauf.letzterStart;
      if (!letzterGuterStand || letzterGuterStand >= grenze) continue;
      bezugszeit = letzterGuterStand;
    }
    if (lauf.alarmGesendetAm && lauf.alarmGesendetAm >= bezugszeit) continue;

    const seit = bezugszeit.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
    let versandFehler: string | null = null;
    try {
      await smsProvider.send(settings.alertPhone, cronAusfallAlarmText(lauf.cron, seit));
      alarme += 1;
    } catch (ausnahme) {
      versandFehler = fehlerArt(ausnahme);
      fehler += 1;
      console.error("Cron-Ausfall-Alarm nicht versendet", { tenantId, cron: lauf.cron, fehler: versandFehler });
    }
    await db.cronLauf.updateMany({ where: { cron: lauf.cron }, data: { alarmGesendetAm: jetzt } });
    await db.notification.create({
      data: { tenantId, channel: "SMS", toRef: "INHABER", kind: "CRON_AUSFALL", error: versandFehler },
    });
  }
  return { alarme, fehler };
}
