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
          await smsProvider.send(fahrer.user.phone, text);
        }
        await db.notification.create({
          data: { tenantId, channel: "SMS", toRef: driverId, rideId: fahrt.id, kind: "KEINE_BESTAETIGUNG_FAHRER" },
        });
        smsAnFahrer += 1;
      }
    }

    const beginntBald = fahrt.pickupAt.getTime() - jetzt.getTime() < 60 * 60_000;
    if (minutenSeitDispo >= driverAckMinutes && istNachtsInBerlin(jetzt) && beginntBald && settings?.alertPhone) {
      const schonGesendet = await db.notification.findFirst({
        where: { rideId: fahrt.id, kind: "KEINE_BESTAETIGUNG_INHABER" },
      });
      if (!schonGesendet) {
        const text = keineBestaetigungAlarmText(uhrzeitBerlin(fahrt.pickupAt));
        await smsProvider.send(settings.alertPhone, text);
        await db.notification.create({
          data: { tenantId, channel: "SMS", toRef: "INHABER", rideId: fahrt.id, kind: "KEINE_BESTAETIGUNG_INHABER" },
        });
        smsAnInhaber += 1;
      }
    }
  }

  return { geprueft: offeneFahrten.length, smsAnFahrer, smsAnInhaber };
}

/**
 * Alarm: keine passende Fahrt möglich (Problem KEIN_FAHRZEUG) in den nächsten 2 Stunden
 * (docs/05-disposition.md, docs/09-bauplan.md Phase 7). Einmal pro Fahrt per SMS an den Inhaber.
 */
export async function keinFahrzeugAlarmPruefen(tenantId: string) {
  const db = withTenant(tenantId);
  const settings = await db.tenantSettings.findUnique({ where: { tenantId } });
  if (!settings?.alertPhone) return { geprueft: 0, smsAnInhaber: 0 };

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
  for (const fahrt of betroffeneFahrten) {
    const schonGesendet = await db.notification.findFirst({
      where: { rideId: fahrt.id, kind: "KEIN_FAHRZEUG_ALARM" },
    });
    if (schonGesendet) continue;

    const text = keinFahrzeugAlarmText(uhrzeitBerlin(fahrt.pickupAt));
    await smsProvider.send(settings.alertPhone, text);
    await db.notification.create({
      data: { tenantId, channel: "SMS", toRef: "INHABER", rideId: fahrt.id, kind: "KEIN_FAHRZEUG_ALARM" },
    });
    smsAnInhaber += 1;
  }

  return { geprueft: betroffeneFahrten.length, smsAnInhaber };
}
