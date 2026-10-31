"use server";

import { revalidatePath } from "next/cache";
import { withTenant, type TenantDb } from "@/lib/db";
import { requireFahrerSession } from "@/lib/session";
import { fahrerStatusSchema, fahrtStatusAendern } from "@/core/rides/status";
import { fahrerFaelltAusKern } from "@/core/rides/fahrerAusfall";
import { berlinerMitternacht, datumIso, tagVerschieben } from "@/core/shifts/week";
import { gpsPositionSchema } from "@/core/drivers/validation";
import { pushAboSpeichern } from "@/core/notify/push";
import type { RideStatus } from "@/generated/prisma/enums";

async function eigenerFahrer(tenantId: string, userId: string) {
  const db = withTenant(tenantId);
  const fahrer = await db.driver.findUnique({ where: { userId } });
  if (!fahrer) {
    throw new Error("Zu diesem Konto gehört kein Fahrer-Profil.");
  }
  return fahrer;
}

/** Fahrten und Schichten von heute und morgen für den angemeldeten Fahrer (docs/06-oberflaeche.md). */
export async function fahrerUebersichtLaden() {
  const { tenantId, userId, name } = await requireFahrerSession();
  const db = withTenant(tenantId);
  const fahrer = await eigenerFahrer(tenantId, userId);

  const heuteIso = datumIso(new Date());
  const heute = berlinerMitternacht(heuteIso);
  const uebermorgen = berlinerMitternacht(tagVerschieben(heuteIso, 2));

  const [schichten, fahrten] = await Promise.all([
    db.shift.findMany({
      where: { driverId: fahrer.id, start: { lt: uebermorgen }, end: { gte: heute } },
      include: { vehicle: { select: { plate: true } } },
      orderBy: { start: "asc" },
    }),
    db.ride.findMany({
      where: {
        driverId: fahrer.id,
        pickupAt: { gte: heute, lt: uebermorgen },
        status: { notIn: ["STORNIERT"] },
      },
      include: {
        passenger: { select: { firstName: true, lastName: true, phones: true } },
        pickupPlace: true,
        dropoffPlace: true,
      },
      orderBy: { pickupAt: "asc" },
    }),
  ]);

  const jetzt = new Date();
  const laufendeSchicht = schichten.find((s) => s.start <= jetzt && jetzt <= s.end) ?? schichten[0] ?? null;

  // Fahrgastdaten nach Erledigung nicht mehr in der App (docs/08-datenschutz-sicherheit.md).
  const fahrtenOhneAltdaten = fahrten.map((fahrt) =>
    fahrt.status === "ERLEDIGT"
      ? { ...fahrt, passenger: { firstName: "Erledigt", lastName: "", phones: [] as string[] } }
      : fahrt,
  );

  return {
    name,
    schichten,
    fahrten: fahrtenOhneAltdaten,
    laufendeSchichtId: laufendeSchicht?.id ?? null,
    gpsConsentAt: fahrer.gpsConsentAt,
  };
}

/** Statuswechsel durch den Fahrer selbst – nur für seine eigenen Fahrten. */
export async function fahrtStatusSetzenFahrer(
  rideId: string,
  status: RideStatus,
  position?: { lat: number; lng: number },
) {
  const { tenantId, userId } = await requireFahrerSession();
  // Maßnahme M-05 (R3-1, S4-014): nur die vier Fahrer-Status zur Laufzeit zulassen – vorher nahm
  // die Action jeden Wert an, ein Fahrer konnte seine Fahrt stornieren oder zurück in die
  // Warteschlange werfen, ohne dass das Büro es merkt. Position ebenfalls geprüft.
  const zielStatus = fahrerStatusSchema.safeParse(status);
  if (!zielStatus.success) {
    throw new Error("Diesen Status kann nur das Büro setzen.");
  }
  const geprueftePosition = position ? gpsPositionSchema.safeParse(position) : undefined;
  if (geprueftePosition && !geprueftePosition.success) {
    throw new Error("Ungültige GPS-Position.");
  }
  const fahrer = await eigenerFahrer(tenantId, userId);

  // Maßnahme M-04 (R3-2): keine getrennte Eigentumsprüfung mehr – der Statuswechsel schreibt nur,
  // wenn die Fahrt in diesem Moment noch diesem Fahrer gehört (Bedingung im UPDATE).
  await fahrtStatusAendern(tenantId, rideId, zielStatus.data, {
    userId,
    lat: geprueftePosition?.data.lat,
    lng: geprueftePosition?.data.lng,
    erwarteterDriverId: fahrer.id,
  });

  revalidatePath("/fahrer");
  revalidatePath("/dispo");
}

/** Schicht starten, pausieren, fortsetzen oder beenden. */
export async function schichtAktion(shiftId: string, aktion: "start" | "pause" | "weiter" | "beenden") {
  const { tenantId, userId } = await requireFahrerSession();
  const db = withTenant(tenantId);
  const fahrer = await eigenerFahrer(tenantId, userId);

  const schicht = await db.shift.findUnique({ where: { id: shiftId }, select: { driverId: true } });
  if (!schicht || schicht.driverId !== fahrer.id) {
    throw new Error("Diese Schicht gehört nicht zu Ihnen.");
  }

  const daten =
    aktion === "start"
      ? { startedAt: new Date(), onBreak: false }
      : aktion === "pause"
        ? { onBreak: true }
        : aktion === "weiter"
          ? { onBreak: false }
          : { endedAt: new Date() };

  await db.shift.update({ where: { id: shiftId }, data: daten });
  revalidatePath("/fahrer");
}

export type ProblemArt = "VERSPAETUNG_10" | "VERSPAETUNG_20" | "VERSPAETUNG_30" | "FAHRGAST_NICHT_DA" | "FAHRZEUG_DEFEKT";

const PROBLEM_HINWEIS: Record<ProblemArt, string> = {
  VERSPAETUNG_10: "Verspätung +10 Min",
  VERSPAETUNG_20: "Verspätung +20 Min",
  VERSPAETUNG_30: "Verspätung +30 Min",
  FAHRGAST_NICHT_DA: "Fahrgast nicht da",
  FAHRZEUG_DEFEKT: "Fahrzeug defekt",
};

async function problemAnEigenerFahrtVermerken(db: TenantDb, rideId: string, driverId: string, hinweis: string) {
  const { count } = await db.ride.updateMany({ where: { id: rideId, driverId }, data: { problems: { push: hinweis } } });
  if (count !== 1) throw new Error("Diese Fahrt gehört nicht zu Ihnen.");
}

/** Problem bei einer einzelnen Fahrt melden (docs/06-oberflaeche.md: Verspätung, Fahrgast nicht da, Fahrzeug defekt). */
export async function problemMelden(rideId: string, art: ProblemArt) {
  const { tenantId, userId } = await requireFahrerSession();
  const db = withTenant(tenantId);
  const fahrer = await eigenerFahrer(tenantId, userId);

  // Maßnahme M-04 (R3-2): Eigentümerschaft ist Bedingung jedes Schreibzugriffs (driverId im WHERE).
  if (art === "FAHRGAST_NICHT_DA") {
    await fahrtStatusAendern(tenantId, rideId, "NICHT_ANGETROFFEN", { userId, erwarteterDriverId: fahrer.id });
  } else if (art === "FAHRZEUG_DEFEKT") {
    await fahrtStatusAendern(tenantId, rideId, "PROBLEM", { userId, erwarteterDriverId: fahrer.id });
    await problemAnEigenerFahrtVermerken(db, rideId, fahrer.id, PROBLEM_HINWEIS[art]);
  } else {
    await problemAnEigenerFahrtVermerken(db, rideId, fahrer.id, PROBLEM_HINWEIS[art]);
  }

  revalidatePath("/fahrer");
  revalidatePath("/dispo");
}

/**
 * "Ich falle aus": Schicht als ausgefallen markieren. Noch nicht begonnene Fahrten (DISPONIERT)
 * werden neu vorgeschlagen (docs/05-disposition.md "Neuplanung"); schon laufende Fahrten
 * (UNTERWEGS/AN_BORD) lassen sich nicht automatisch umplanen und bekommen nur das Problem.
 */
export async function fahrerFaelltAus() {
  const { tenantId, userId } = await requireFahrerSession();
  const fahrer = await eigenerFahrer(tenantId, userId);

  const heuteIso = datumIso(new Date());
  const heute = berlinerMitternacht(heuteIso);
  const uebermorgen = berlinerMitternacht(tagVerschieben(heuteIso, 2));

  await fahrerFaelltAusKern(tenantId, fahrer.id, heute, uebermorgen, userId);

  revalidatePath("/fahrer");
  revalidatePath("/dispo");
}

/** "Gesehen" für eine neue oder geänderte Fahrt bestätigen (docs/06-oberflaeche.md). */
export async function gesehenBestaetigen(rideId: string) {
  const { tenantId, userId } = await requireFahrerSession();
  const db = withTenant(tenantId);
  const fahrer = await eigenerFahrer(tenantId, userId);

  // Maßnahme M-04 (R3-2): Eigentümerschaft als Bedingung des Updates, kein getrennter Lesezugriff.
  const { count } = await db.ride.updateMany({ where: { id: rideId, driverId: fahrer.id }, data: { driverAckAt: new Date() } });
  if (count !== 1) throw new Error("Diese Fahrt gehört nicht zu Ihnen.");
  revalidatePath("/fahrer");
}

/** Einwilligung zur GPS-Ortung während der Schicht (docs/08-datenschutz-sicherheit.md). */
export async function gpsEinwilligen() {
  const { tenantId, userId } = await requireFahrerSession();
  const db = withTenant(tenantId);
  const fahrer = await eigenerFahrer(tenantId, userId);
  await db.driver.update({ where: { id: fahrer.id }, data: { gpsConsentAt: new Date() } });
  revalidatePath("/fahrer");
}

/** Speichert eine GPS-Position für das Fahrzeug der laufenden Schicht – nur mit Einwilligung, nur während der Schicht. */
export async function gpsPositionMelden(lat: number, lng: number) {
  const { tenantId, userId } = await requireFahrerSession();
  // Maßnahme M-05: Wertebereich prüfen (−90…90 / −180…180, keine NaN) – vorher landete jeder Wert
  // ungeprüft in VehicleLocation.
  const position = gpsPositionSchema.safeParse({ lat, lng });
  if (!position.success) {
    throw new Error("Ungültige GPS-Position.");
  }
  const db = withTenant(tenantId);
  const fahrer = await eigenerFahrer(tenantId, userId);
  if (!fahrer.gpsConsentAt) return;

  // "Laufende Schicht" nur, wenn sie heute (Berliner Zeit) noch andauert: eine nie beendete
  // Schicht von letzter Woche sendet sonst tagelang Positionen (Maßnahme M-05, Punkt 3).
  const heuteIso = datumIso(new Date());
  const heute = berlinerMitternacht(heuteIso);
  const uebermorgen = berlinerMitternacht(tagVerschieben(heuteIso, 2));
  const laufendeSchicht = await db.shift.findFirst({
    where: { driverId: fahrer.id, startedAt: { not: null }, endedAt: null, start: { lt: uebermorgen }, end: { gte: heute } },
    orderBy: { start: "desc" },
    select: { vehicleId: true },
  });
  if (!laufendeSchicht) return;

  await db.vehicleLocation.create({
    data: { tenantId, vehicleId: laufendeSchicht.vehicleId, lat: position.data.lat, lng: position.data.lng },
  });
}

/** Speichert das Push-Abo des Geräts für den angemeldeten Fahrer. */
export async function pushAboSpeichernFuerMich(abo: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const { tenantId, userId } = await requireFahrerSession();
  const fahrer = await eigenerFahrer(tenantId, userId);
  await pushAboSpeichern(tenantId, fahrer.id, abo);
}
