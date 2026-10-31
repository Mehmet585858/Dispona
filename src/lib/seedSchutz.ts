/**
 * Schutz für Seed- und Reset-Skripte (Prüfbericht S1-006): Ein Entwicklerbefehl darf nie
 * unbemerkt gegen eine fremde (Produktions-)Datenbank laufen und nie Daten anderer Mandanten
 * anfassen. Zwei Bausteine:
 *  1. seedZielPruefen(): bricht ab, wenn DATABASE_URL nicht auf eine lokale Datenbank zeigt –
 *     es sei denn, der Hostname wird ausdrücklich über SEED_ZIEL_BESTAETIGEN wiederholt.
 *  2. mandantKomplettLoeschen(): löscht ausschließlich die Zeilen EINES Mandanten, in
 *     Fremdschlüssel-Reihenfolge. Kein deleteMany() ohne where.
 */
import { prisma } from "./prisma";

const LOKALE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);

export function datenbankHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    // prisma+postgres://… (npx prisma dev) lässt sich von URL nicht parsen – Präfix abschneiden.
    const bereinigt = url.replace(/^prisma\+/, "");
    return new URL(bereinigt).hostname || null;
  } catch {
    return null;
  }
}

export function istLokaleDatenbankUrl(url: string | undefined): boolean {
  const host = datenbankHost(url);
  return host !== null && LOKALE_HOSTS.has(host.toLowerCase());
}

/**
 * Gibt den Host zurück, gegen den geseedet werden darf, oder wirft mit einer verständlichen
 * Meldung. `env` wird übergeben statt direkt process.env zu lesen, damit es testbar bleibt.
 */
export function seedZielPruefen(env: Record<string, string | undefined>): string {
  const host = datenbankHost(env.DATABASE_URL);
  if (!host) {
    throw new Error("DATABASE_URL fehlt oder ist keine gültige Adresse – Seed abgebrochen.");
  }
  if (istLokaleDatenbankUrl(env.DATABASE_URL)) return host;
  if (env.SEED_ZIEL_BESTAETIGEN && env.SEED_ZIEL_BESTAETIGEN.toLowerCase() === host.toLowerCase()) {
    return host;
  }
  throw new Error(
    `Seed abgebrochen: DATABASE_URL zeigt auf "${host}", das ist keine lokale Datenbank. ` +
      `Wenn das wirklich gewollt ist: SEED_ZIEL_BESTAETIGEN=${host} npm run seed`,
  );
}

/** Löscht alle Daten genau eines Mandanten (inklusive Tenant-Zeile). Nur für Seed/Reset gedacht. */
export async function mandantKomplettLoeschen(tenantId: string): Promise<void> {
  const where = { tenantId };
  await prisma.rideStatusEvent.deleteMany({ where });
  await prisma.suggestion.deleteMany({ where });
  await prisma.auditLog.deleteMany({ where });
  await prisma.notification.deleteMany({ where });
  await prisma.ride.deleteMany({ where });
  await prisma.voiceToolCall.deleteMany({ where });
  await prisma.call.deleteMany({ where });
  await prisma.rideSeries.deleteMany({ where });
  await prisma.shift.deleteMany({ where });
  await prisma.pushSubscription.deleteMany({ where });
  await prisma.driver.deleteMany({ where });
  await prisma.vehicleLocation.deleteMany({ where });
  await prisma.vehicle.deleteMany({ where });
  await prisma.approval.deleteMany({ where });
  await prisma.passenger.deleteMany({ where });
  await prisma.place.deleteMany({ where });
  // Session/Account hängen per onDelete: Cascade am User.
  await prisma.user.deleteMany({ where });
  await prisma.phoneNumber.deleteMany({ where });
  await prisma.integration.deleteMany({ where });
  await prisma.tenantSettings.deleteMany({ where });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
}
