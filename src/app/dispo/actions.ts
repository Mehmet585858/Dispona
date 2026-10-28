"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { berlinerMitternacht, datumIso, tagVerschieben } from "@/core/shifts/week";
import { minutenSeitDisponiert } from "@/core/rides/status";
import { automodusStatusText } from "@/core/disposition/automodus";
import { fahrzeugZuweisen } from "@/core/disposition/zuweisen";

export async function dashboardLaden() {
  const { tenantId } = await requireSession();
  const db = withTenant(tenantId);
  const heute = berlinerMitternacht(datumIso(new Date()));
  const morgen = new Date(heute);
  morgen.setDate(morgen.getDate() + 1);

  const [fahrtenHeute, wartenAufSie, unterwegs, settings] = await Promise.all([
    db.ride.count({ where: { pickupAt: { gte: heute, lt: morgen } } }),
    db.ride.count({
      where: { pickupAt: { gte: heute, lt: morgen }, status: { in: ["ERFASST", "VORGESCHLAGEN"] } },
    }),
    db.ride.count({ where: { status: "UNTERWEGS" } }),
    db.tenantSettings.findUnique({ where: { tenantId } }),
  ]);

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

  const morgenIso = tagVerschieben(datumIso(heute), 1);
  const morgenStart = berlinerMitternacht(morgenIso);
  const morgenEnde = new Date(morgenStart);
  morgenEnde.setDate(morgenEnde.getDate() + 1);
  const planFuerMorgenFahrten = await db.ride.findMany({
    where: { pickupAt: { gte: morgenStart, lt: morgenEnde }, status: "VORGESCHLAGEN" },
    include: {
      passenger: { select: { firstName: true, lastName: true } },
      pickupPlace: { select: { label: true } },
      dropoffPlace: { select: { label: true } },
      suggestions: { where: { decision: "OFFEN" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { pickupAt: "asc" },
  });
  const morgenAutoDisponiert = await db.ride.count({
    where: { pickupAt: { gte: morgenStart, lt: morgenEnde }, dispatchMode: "AUTO" },
  });

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
    alarme,
    automodusText: automodusStatusText(settings?.autoMode ?? "AUS", new Date()),
    heuteNacht: { automatischDisponiert: heuteAutoDisponiert, liegenGeblieben: heuteLiegenGeblieben },
    planFuerMorgen: { fahrten: planFuerMorgenFahrten, automatischDisponiert: morgenAutoDisponiert },
  };
}

/** "Alle übernehmen" beim Sammel-Vorschlag "Plan für morgen": jede offene Fahrt bekommt ihren besten Vorschlag. */
export async function planFuerMorgenAlleUebernehmen() {
  const { tenantId, userId } = await requireSession();
  const db = withTenant(tenantId);
  const heute = berlinerMitternacht(datumIso(new Date()));
  const morgenIso = tagVerschieben(datumIso(heute), 1);
  const morgenStart = berlinerMitternacht(morgenIso);
  const morgenEnde = new Date(morgenStart);
  morgenEnde.setDate(morgenEnde.getDate() + 1);

  const fahrten = await db.ride.findMany({
    where: { pickupAt: { gte: morgenStart, lt: morgenEnde }, status: "VORGESCHLAGEN" },
    include: { suggestions: { where: { decision: "OFFEN" }, orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { pickupAt: "asc" },
  });

  let uebernommen = 0;
  for (const fahrt of fahrten) {
    const beste = (fahrt.suggestions[0]?.options as { vehicleId: string }[] | undefined)?.[0];
    if (!beste) continue;
    await fahrzeugZuweisen(tenantId, fahrt.id, beste.vehicleId, { dispatchMode: "MANUELL", userId });
    uebernommen += 1;
  }

  revalidatePath("/dispo");
  return { uebernommen };
}
