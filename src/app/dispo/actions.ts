"use server";

import { withTenant } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { berlinerMitternacht, datumIso } from "@/core/shifts/week";
import { minutenSeitDisponiert } from "@/core/rides/status";
import { automodusStatusText } from "@/core/disposition/automodus";

export async function dashboardLaden() {
  const { tenantId } = await requireSession();
  const db = withTenant(tenantId);
  const heute = berlinerMitternacht(datumIso(new Date()));
  const morgen = new Date(heute);
  morgen.setDate(morgen.getDate() + 1);

  const [fahrtenHeute, wartenAufSie, unterwegs, settings, fahrzeugeRoh] = await Promise.all([
    db.ride.count({ where: { pickupAt: { gte: heute, lt: morgen } } }),
    db.ride.count({
      where: { pickupAt: { gte: heute, lt: morgen }, status: { in: ["ERFASST", "VORGESCHLAGEN"] } },
    }),
    db.ride.count({ where: { status: "UNTERWEGS" } }),
    db.tenantSettings.findUnique({ where: { tenantId } }),
    db.vehicle.findMany({ where: { active: true }, orderBy: { plate: "asc" } }),
  ]);

  const letztePositionen = await db.vehicleLocation.findMany({
    where: { vehicleId: { in: fahrzeugeRoh.map((f) => f.id) } },
    orderBy: { at: "desc" },
    distinct: ["vehicleId"],
    select: { vehicleId: true, lat: true, lng: true, at: true },
  });
  const positionNachFahrzeug = new Map(letztePositionen.map((p) => [p.vehicleId, p]));
  const fahrzeuge = fahrzeugeRoh.map((f) => {
    const position = positionNachFahrzeug.get(f.id);
    return { ...f, position: position ? { lat: position.lat, lng: position.lng, at: position.at } : null };
  });

  const bitteBestaetigen = await db.ride.findMany({
    where: { pickupAt: { gte: heute, lt: morgen }, status: { in: ["ERFASST", "VORGESCHLAGEN"] } },
    include: {
      passenger: { select: { firstName: true, lastName: true } },
      pickupPlace: { select: { label: true } },
      dropoffPlace: { select: { label: true } },
      suggestions: { where: { decision: "OFFEN" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { pickupAt: "asc" },
    take: 10,
  });

  const tagesplan = await db.ride.findMany({
    where: { pickupAt: { gte: heute, lt: morgen }, vehicleId: { not: null } },
    include: {
      passenger: { select: { firstName: true, lastName: true } },
      pickupPlace: { select: { label: true } },
      dropoffPlace: { select: { label: true } },
      vehicle: { select: { id: true, plate: true } },
    },
    orderBy: { pickupAt: "asc" },
  });

  const alarmeRoh = await db.ride.findMany({
    where: {
      pickupAt: { gte: heute, lt: morgen },
      OR: [{ status: { in: ["PROBLEM", "NICHT_ANGETROFFEN"] } }, { problems: { isEmpty: false } }],
    },
    include: {
      passenger: { select: { firstName: true, lastName: true } },
    },
    orderBy: { pickupAt: "asc" },
  });

  const unbestaetigtRoh = await db.ride.findMany({
    where: {
      pickupAt: { gte: heute, lt: morgen },
      status: "DISPONIERT",
      driverId: { not: null },
      driverAckAt: null,
    },
    include: {
      passenger: { select: { firstName: true, lastName: true } },
    },
    orderBy: { pickupAt: "asc" },
  });
  const driverAckMinutes = settings?.driverAckMinutes ?? 5;
  const unbestaetigt = [];
  for (const fahrt of unbestaetigtRoh) {
    const minuten = await minutenSeitDisponiert(tenantId, fahrt.id);
    if (minuten !== null && minuten >= driverAckMinutes) {
      unbestaetigt.push({ ...fahrt, problems: [...fahrt.problems, "Fahrer hat nicht bestätigt"] });
    }
  }

  const alarme = [...alarmeRoh, ...unbestaetigt].sort((a, b) => a.pickupAt.getTime() - b.pickupAt.getTime());

  const heuteAutoDisponiert = await db.ride.count({
    where: { pickupAt: { gte: heute, lt: morgen }, dispatchMode: "AUTO" },
  });
  const heuteLiegenGeblieben = await db.ride.findMany({
    where: { pickupAt: { gte: heute, lt: morgen }, status: "VORGESCHLAGEN", autoSkipReason: { not: null } },
    select: {
      id: true,
      pickupAt: true,
      autoSkipReason: true,
      passenger: { select: { firstName: true, lastName: true } },
    },
    orderBy: { pickupAt: "asc" },
  });

  return {
    kennzahlen: { fahrtenHeute, wartenAufSie, unterwegs, anrufeAngenommen: 0 },
    bitteBestaetigen,
    tagesplan,
    alarme,
    fahrzeuge,
    automodusText: automodusStatusText(settings?.autoMode ?? "AUS", new Date()),
    heuteNacht: { automatischDisponiert: heuteAutoDisponiert, liegenGeblieben: heuteLiegenGeblieben },
    serviceArea: settings
      ? {
          center: settings.serviceAreaCenter as { lat: number; lng: number },
          radiusKm: settings.serviceAreaKm,
          depot: settings.depotAddress as { lat: number; lng: number; city?: string } | null,
        }
      : null,
  };
}
