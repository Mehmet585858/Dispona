/**
 * Eine Änderung = genau eine Push je Fahrer (Maßnahme M-20, docs/13 R2-9, Prüfbericht S3-004).
 *
 * Vorher schickten fahrtAendern und fahrzeugZuweisen ihre Meldungen jeweils selbst – bei einer
 * kombinierten Zeit- und Fahrzeugänderung bekam derselbe Fahrer erst "geändert", dann "entzogen".
 * Jetzt vergleichen die Aufrufer den Stand vorher und nachher und melden einmal:
 *  - wer die Fahrt verloren hat: "entzogen" (schlägt "geändert"),
 *  - wer sie neu bekommt (und sie ist disponiert): "neue Fahrt",
 *  - wer sie behält und sich etwas geändert hat: "geändert".
 * Texte ohne Namen, nur Uhrzeit und Ort (CLAUDE.md, docs/08).
 */
import { withTenant } from "@/lib/db";
import { pushAnFahrer } from "@/core/notify/push";
import { fahrtEntzogenText, geaenderteFahrtText, neueFahrtText } from "@/core/notify/texte";

export type FahrtStandFuerPush = {
  driverId: string | null;
  pickupAt: Date;
  status: string;
};

function uhrzeitBerlin(datum: Date): string {
  return datum.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
}

export async function fahrerNachAenderungBenachrichtigen(
  tenantId: string,
  rideId: string,
  vorher: FahrtStandFuerPush,
  nachher: FahrtStandFuerPush,
  optionen: { geaendert: boolean },
): Promise<void> {
  const db = withTenant(tenantId);

  if (vorher.driverId && vorher.driverId !== nachher.driverId) {
    await pushAnFahrer(tenantId, vorher.driverId, {
      title: "Fahrt entzogen",
      body: fahrtEntzogenText(uhrzeitBerlin(vorher.pickupAt)),
      url: "/fahrer",
    });
    await db.notification.create({
      data: { tenantId, channel: "PUSH", toRef: vorher.driverId, rideId, kind: "FAHRT_ENTZOGEN" },
    });
  }

  if (nachher.driverId && nachher.driverId !== vorher.driverId && nachher.status === "DISPONIERT") {
    const orte = await db.ride.findUnique({
      where: { id: rideId },
      select: { pickupPlace: { select: { label: true } }, dropoffPlace: { select: { label: true } } },
    });
    const text = neueFahrtText(uhrzeitBerlin(nachher.pickupAt), orte?.pickupPlace.label ?? "", orte?.dropoffPlace.label ?? "");
    await pushAnFahrer(tenantId, nachher.driverId, { title: "Neue Fahrt", body: text, url: "/fahrer" });
    await db.notification.create({
      data: { tenantId, channel: "PUSH", toRef: nachher.driverId, rideId, kind: "NEUE_FAHRT" },
    });
  }

  if (nachher.driverId && nachher.driverId === vorher.driverId && optionen.geaendert) {
    await pushAnFahrer(tenantId, nachher.driverId, {
      title: "Fahrt geändert",
      body: geaenderteFahrtText(uhrzeitBerlin(nachher.pickupAt)),
      url: "/fahrer",
    });
    await db.notification.create({
      data: { tenantId, channel: "PUSH", toRef: nachher.driverId, rideId, kind: "FAHRT_GEAENDERT" },
    });
  }
}
