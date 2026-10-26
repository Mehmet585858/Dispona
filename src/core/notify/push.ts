import webpush from "web-push";
import { withTenant } from "@/lib/db";

export type PushNachricht = { title: string; body: string; tag?: string; url?: string };

let konfiguriert = false;
function sicherstellenVapid(): boolean {
  if (konfiguriert) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails("mailto:support@fahrdienst-ki.invalid", publicKey, privateKey);
  konfiguriert = true;
  return true;
}

/** Push-Abo speichern/aktualisieren (ein Eintrag je Gerät, erkannt an der endpoint-URL). */
export async function pushAboSpeichern(
  tenantId: string,
  driverId: string,
  abo: { endpoint: string; keys: { p256dh: string; auth: string } },
) {
  const db = withTenant(tenantId);
  await db.pushSubscription.upsert({
    where: { endpoint: abo.endpoint },
    create: { tenantId, driverId, endpoint: abo.endpoint, keys: abo.keys },
    update: { driverId, keys: abo.keys, lastOkAt: new Date() },
  });
}

/** Schickt eine Push-Nachricht an alle Geräte eines Fahrers; entfernt abgelaufene Abos. */
export async function pushAnFahrer(
  tenantId: string,
  driverId: string,
  nachricht: PushNachricht,
): Promise<{ versucht: number; zugestellt: number }> {
  if (!sicherstellenVapid()) {
    console.log(`[Entwicklung] Kein VAPID-Schlüssel gesetzt – Push an Fahrer ${driverId}: ${nachricht.body}`);
    return { versucht: 0, zugestellt: 0 };
  }

  const db = withTenant(tenantId);
  const abos = await db.pushSubscription.findMany({ where: { driverId } });

  let zugestellt = 0;
  await Promise.all(
    abos.map(async (abo) => {
      try {
        await webpush.sendNotification(
          { endpoint: abo.endpoint, keys: abo.keys as unknown as { p256dh: string; auth: string } },
          JSON.stringify(nachricht),
        );
        zugestellt += 1;
        await db.pushSubscription.update({ where: { id: abo.id }, data: { lastOkAt: new Date() } });
      } catch (fehler) {
        const statusCode = (fehler as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.pushSubscription.delete({ where: { id: abo.id } }).catch(() => {});
        }
      }
    }),
  );

  return { versucht: abos.length, zugestellt };
}
