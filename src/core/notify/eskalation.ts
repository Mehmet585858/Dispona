import { withTenant } from "@/lib/db";
import { minutenSeitDisponiert } from "@/core/rides/status";
import { istNachtsInBerlin } from "@/core/shifts/zeitfenster";
import { smsProvider } from "@/providers/sms";
import { keineBestaetigungAlarmText, keinFahrzeugAlarmText, neueFahrtText } from "./texte";

/**
 * Fahrer bestätigt jede neue Fahrt mit "Gesehen". Ohne Bestätigung:
 * - nach 2 Minuten: SMS an den Fahrer (docs/02-architektur.md).
 * - nach driverAckMinutes (Standard 5): nachts, wenn die Fahrt in < 60 Minuten beginnt,
 *   zusätzlich SMS an den Inhaber (alertPhone). Tagsüber reicht der Hinweis auf /dispo
 *   (siehe alarme-Abfrage in src/app/dispo/actions.ts).
 */

const SMS_AN_FAHRER_NACH_MIN = 2;

/**
 * SMS senden und das Ergebnis als Notification festhalten. Schlägt der Versand fehl (kein
 * Anbieter eingerichtet, Anbieter nicht erreichbar), bleibt der Fehler an der Benachrichtigung
 * stehen und der Lauf geht mit der nächsten Fahrt weiter, statt den ganzen Cron abzubrechen
 * (Prüfbericht S1-002). Im Log nur IDs, nie Rufnummer oder Text.
 */
async function smsSendenUndMerken(
  db: ReturnType<typeof withTenant>,
  eintrag: { tenantId: string; an: string; text: string; toRef: string; rideId: string; kind: string },
): Promise<boolean> {
  let fehler: string | null = null;
  try {
    await smsProvider.send(eintrag.an, eintrag.text);
  } catch (ausnahme) {
    fehler = ausnahme instanceof Error ? ausnahme.message : "SMS-Versand fehlgeschlagen.";
    console.error(`SMS-Versand fehlgeschlagen (Fahrt ${eintrag.rideId}, Art ${eintrag.kind}): ${fehler}`);
  }
  await db.notification.create({
    data: {
      tenantId: eintrag.tenantId,
      channel: "SMS",
      toRef: eintrag.toRef,
      rideId: eintrag.rideId,
      kind: eintrag.kind,
      error: fehler,
    },
  });
  return fehler === null;
}

function uhrzeitBerlin(datum: Date): string {
  return datum.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
}

/** Prüft offene "Gesehen"-Bestätigungen eines Mandanten und eskaliert bei Bedarf per SMS. */
export async function bestaetigungenPruefen(tenantId: string) {
  const db = withTenant(tenantId);
  const settings = await db.tenantSettings.findUnique({ where: { tenantId } });
  const driverAckMinutes = settings?.driverAckMinutes ?? 5;

  const offeneFahrten = await db.ride.findMany({
    where: { status: "DISPONIERT", driverId: { not: null }, driverAckAt: null },
    select: {
      id: true,
      pickupAt: true,
      driverId: true,
      pickupPlace: { select: { label: true } },
      dropoffPlace: { select: { label: true } },
    },
  });

  const jetzt = new Date();
  let smsAnFahrer = 0;
  let smsAnInhaber = 0;
  let fehler = 0;

  for (const fahrt of offeneFahrten) {
    const driverId = fahrt.driverId;
    if (!driverId) continue;

    const minutenSeitDispo = await minutenSeitDisponiert(tenantId, fahrt.id);
    if (minutenSeitDispo === null) continue;

    if (minutenSeitDispo >= SMS_AN_FAHRER_NACH_MIN) {
      const schonGesendet = await db.notification.findFirst({
        where: { rideId: fahrt.id, kind: "KEINE_BESTAETIGUNG_FAHRER" },
      });
      if (!schonGesendet) {
        const fahrer = await db.driver.findUnique({
          where: { id: driverId },
          select: { user: { select: { phone: true } } },
        });
        if (fahrer?.user.phone) {
          const text = neueFahrtText(uhrzeitBerlin(fahrt.pickupAt), fahrt.pickupPlace.label, fahrt.dropoffPlace.label);
          const ok = await smsSendenUndMerken(db, {
            tenantId, an: fahrer.user.phone, text, toRef: driverId, rideId: fahrt.id, kind: "KEINE_BESTAETIGUNG_FAHRER",
          });
          if (ok) smsAnFahrer += 1;
          else fehler += 1;
        } else {
          await db.notification.create({
            data: { tenantId, channel: "SMS", toRef: driverId, rideId: fahrt.id, kind: "KEINE_BESTAETIGUNG_FAHRER", error: "Keine Handynummer hinterlegt." },
          });
          fehler += 1;
        }
      }
    }

    const beginntBald = fahrt.pickupAt.getTime() - jetzt.getTime() < 60 * 60_000;
    if (minutenSeitDispo >= driverAckMinutes && istNachtsInBerlin(jetzt) && beginntBald && settings?.alertPhone) {
      const schonGesendet = await db.notification.findFirst({
        where: { rideId: fahrt.id, kind: "KEINE_BESTAETIGUNG_INHABER" },
      });
      if (!schonGesendet) {
        const text = keineBestaetigungAlarmText(uhrzeitBerlin(fahrt.pickupAt));
        const ok = await smsSendenUndMerken(db, {
          tenantId, an: settings.alertPhone, text, toRef: "INHABER", rideId: fahrt.id, kind: "KEINE_BESTAETIGUNG_INHABER",
        });
        if (ok) smsAnInhaber += 1;
        else fehler += 1;
      }
    }
  }

  return { geprueft: offeneFahrten.length, smsAnFahrer, smsAnInhaber, fehler };
}

/**
 * Alarm: keine passende Fahrt möglich (Problem KEIN_FAHRZEUG) in den nächsten 2 Stunden
 * (docs/05-disposition.md, docs/09-bauplan.md Phase 7). Einmal pro Fahrt per SMS an den Inhaber.
 */
export async function keinFahrzeugAlarmPruefen(tenantId: string) {
  const db = withTenant(tenantId);
  const settings = await db.tenantSettings.findUnique({ where: { tenantId } });
  if (!settings?.alertPhone) return { geprueft: 0, smsAnInhaber: 0, fehler: 0 };

  const jetzt = new Date();
  const inZweiStunden = new Date(jetzt.getTime() + 2 * 60 * 60_000);

  const betroffeneFahrten = await db.ride.findMany({
    where: {
      status: { notIn: ["STORNIERT", "ERLEDIGT"] },
      problems: { has: "KEIN_FAHRZEUG" },
      pickupAt: { gte: jetzt, lt: inZweiStunden },
    },
    select: { id: true, pickupAt: true },
  });

  let smsAnInhaber = 0;
  let fehler = 0;
  for (const fahrt of betroffeneFahrten) {
    const schonGesendet = await db.notification.findFirst({
      where: { rideId: fahrt.id, kind: "KEIN_FAHRZEUG_ALARM" },
    });
    if (schonGesendet) continue;

    const text = keinFahrzeugAlarmText(uhrzeitBerlin(fahrt.pickupAt));
    const ok = await smsSendenUndMerken(db, {
      tenantId, an: settings.alertPhone, text, toRef: "INHABER", rideId: fahrt.id, kind: "KEIN_FAHRZEUG_ALARM",
    });
    if (ok) smsAnInhaber += 1;
    else fehler += 1;
  }

  return { geprueft: betroffeneFahrten.length, smsAnInhaber, fehler };
}
