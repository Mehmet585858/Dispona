"use server";

import { withTenant } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { berlinerMitternacht, datumIso } from "@/core/shifts/week";

export async function dashboardLaden() {
  const { tenantId } = await requireSession();
  const db = withTenant(tenantId);
  const heute = berlinerMitternacht(datumIso(new Date()));
  const morgen = new Date(heute);
  morgen.setDate(morgen.getDate() + 1);

  const [fahrtenHeute, wartenAufSie, unterwegs, settings, fahrzeuge] = await Promise.all([
    db.ride.count({ where: { pickupAt: { gte: heute, lt: morgen } } }),
    db.ride.count({ where: { pickupAt: { gte: heute, lt: morgen }, status: "ERFASST" } }),
    db.ride.count({ where: { status: "UNTERWEGS" } }),
    db.tenantSettings.findUnique({ where: { tenantId } }),
    db.vehicle.findMany({ where: { active: true }, orderBy: { plate: "asc" } }),
  ]);

  const bitteBestaetigen = await db.ride.findMany({
    where: { pickupAt: { gte: heute, lt: morgen }, status: "ERFASST" },
    include: {
      passenger: { select: { firstName: true, lastName: true } },
      pickupPlace: { select: { label: true } },
      dropoffPlace: { select: { label: true } },
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

  return {
    kennzahlen: { fahrtenHeute, wartenAufSie, unterwegs, anrufeAngenommen: 0 },
    bitteBestaetigen,
    tagesplan,
    fahrzeuge,
    serviceArea: settings
      ? {
          center: settings.serviceAreaCenter as { lat: number; lng: number },
          radiusKm: settings.serviceAreaKm,
          depot: settings.depotAddress as { lat: number; lng: number; city?: string } | null,
        }
      : null,
  };
}
