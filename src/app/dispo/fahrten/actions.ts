"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { fahrtPruefen, type Problem } from "@/core/rides/pruefungen";
import { fahrtSchema, type FahrtEingabe } from "@/core/rides/validation";
import { fahrtStatusAendern } from "@/core/rides/status";
import { fahrgaesteAehnlicheNamen, telefonNormalisieren } from "@/core/passengers/suche";
import { berlinerMitternacht, datumIso, mitUhrzeit } from "@/core/shifts/week";
import { vorschlaegeBerechnen, type GeplanteFahrt } from "@/core/disposition/vorschlagen";
import { routingProvider, GEOCODE_SICHER_SCHWELLE } from "@/providers/routing";
import type { RideStatus } from "@/generated/prisma/enums";

export async function fahrtenLaden(datumFilter?: string) {
  const { tenantId } = await requireSession();
  const tag = berlinerMitternacht(datumFilter ?? datumIso(new Date()));
  const tagDanach = new Date(tag);
  tagDanach.setDate(tagDanach.getDate() + 1);

  return withTenant(tenantId).ride.findMany({
    where: { pickupAt: { gte: tag, lt: tagDanach } },
    include: {
      passenger: { select: { firstName: true, lastName: true } },
      pickupPlace: { select: { label: true } },
      dropoffPlace: { select: { label: true } },
      vehicle: { select: { plate: true } },
      suggestions: { where: { decision: "OFFEN" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { pickupAt: "asc" },
  });
}

export async function fahrgaesteSuchen(text: string) {
  const { tenantId } = await requireSession();
  if (text.trim().length < 2) return [];
  const db = withTenant(tenantId);
  const telefon = telefonNormalisieren(text);

  const [perTelefon, alle] = await Promise.all([
    db.passenger.findMany({ where: { phones: { has: telefon } }, take: 5 }),
    db.passenger.findMany({ take: 200 }),
  ]);

  const perName = fahrgaesteAehnlicheNamen(alle, text).slice(0, 8);
  const gefunden = new Map([...perTelefon, ...perName].map((f) => [f.id, f]));
  return [...gefunden.values()];
}

export async function orteFuerAuswahl() {
  const { tenantId } = await requireSession();
  return withTenant(tenantId).place.findMany({
    orderBy: { label: "asc" },
    select: { id: true, label: true, street: true, city: true },
  });
}

export async function ortSuchen(text: string) {
  const ergebnisse = await routingProvider.geocode(text);
  return ergebnisse.map((r) => ({ ...r, sicher: r.confidence >= GEOCODE_SICHER_SCHWELLE }));
}

export async function ortAusAdresseAnlegen(eingabe: {
  label: string;
  street: string;
  zip: string;
  city: string;
  lat: number;
  lng: number;
}) {
  const { tenantId } = await requireSession();
  const ort = await withTenant(tenantId).place.create({
    data: { tenantId, type: "SONSTIGES", usageCount: 0, ...eingabe },
  });
  return ort;
}

/** Berechnet die Fahrzeugvorschläge für eine erfasste Fahrt und speichert sie (docs/05-disposition.md). */
async function vorschlagBerechnenUndSpeichern(tenantId: string, rideId: string, userId?: string) {
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({
    where: { id: rideId },
    include: { pickupPlace: true, dropoffPlace: true },
  });
  if (!fahrt) return;

  const settings = await db.tenantSettings.findUnique({ where: { tenantId } });
  const depot = settings?.depotAddress as { lat: number; lng: number } | null;
  if (!depot) return; // Einrichtung noch nicht abgeschlossen – kein Betriebshof hinterlegt

  const tagStart = berlinerMitternacht(datumIso(fahrt.pickupAt));
  const tagEnde = new Date(tagStart);
  tagEnde.setDate(tagEnde.getDate() + 1);

  const [fahrzeuge, schichten, tagesplanFahrten] = await Promise.all([
    db.vehicle.findMany({ where: { active: true } }),
    db.shift.findMany({ where: { start: { lt: tagEnde }, end: { gte: tagStart } } }),
    db.ride.findMany({
      where: {
        pickupAt: { gte: tagStart, lt: tagEnde },
        vehicleId: { not: null },
        id: { not: rideId },
        status: { notIn: ["STORNIERT"] },
      },
      include: { pickupPlace: true, dropoffPlace: true },
    }),
  ]);

  const tagesplan: GeplanteFahrt[] = tagesplanFahrten.map((r) => ({
    vehicleId: r.vehicleId!,
    pickupAt: r.pickupAt,
    appointmentAt: r.appointmentAt,
    pickupOrt: { lat: r.pickupPlace.lat, lng: r.pickupPlace.lng },
    dropoffOrt: { lat: r.dropoffPlace.lat, lng: r.dropoffPlace.lng },
    transportType: r.transportType,
  }));

  const { vorschlaege, keinKandidat } = await vorschlaegeBerechnen({
    fahrt: {
      transportType: fahrt.transportType,
      companion: fahrt.companion,
      pickupAt: fahrt.pickupAt,
      appointmentAt: fahrt.appointmentAt,
      pickupOrt: { lat: fahrt.pickupPlace.lat, lng: fahrt.pickupPlace.lng },
      dropoffOrt: { lat: fahrt.dropoffPlace.lat, lng: fahrt.dropoffPlace.lng },
    },
    fahrzeuge,
    schichten,
    tagesplan,
    depot,
    routing: routingProvider,
  });

  if (vorschlaege.length > 0) {
    await db.suggestion.create({
      data: {
        tenantId,
        rideId,
        options: vorschlaege.map((v) => ({
          vehicleId: v.vehicleId,
          plate: v.plate,
          etaMin: v.etaMin,
          onTime: !v.zuSpaet,
          score: Math.round(v.score * 10) / 10,
          reason: v.begruendung,
        })),
        decision: "OFFEN",
      },
    });
    await fahrtStatusAendern(tenantId, rideId, "VORGESCHLAGEN", { userId });
  } else if (keinKandidat) {
    await db.ride.update({ where: { id: rideId }, data: { problems: { push: "KEIN_FAHRZEUG" } } });
  }
}

export async function fahrtAnlegen(
  eingabe: FahrtEingabe,
): Promise<{ rideId: string; probleme: Problem[] }> {
  const { tenantId, userId } = await requireSession();
  const daten = fahrtSchema.parse(eingabe);
  const db = withTenant(tenantId);

  const tag = berlinerMitternacht(daten.datum);
  const pickupAt = mitUhrzeit(tag, daten.abholzeit);
  const appointmentAt = daten.terminzeit ? mitUhrzeit(tag, daten.terminzeit) : undefined;

  const [pickupOrt, settings, fahrgast, bestehendeFahrten] = await Promise.all([
    db.place.findUnique({ where: { id: daten.pickupPlaceId } }),
    db.tenantSettings.findUnique({ where: { tenantId } }),
    db.passenger.findUnique({ where: { id: daten.passengerId }, include: { approvals: true } }),
    db.ride.findMany({
      where: { passengerId: daten.passengerId, status: { notIn: ["STORNIERT"] } },
      select: { pickupAt: true },
    }),
  ]);

  const probleme = fahrtPruefen({
    pickupOrt: pickupOrt ? { lat: pickupOrt.lat, lng: pickupOrt.lng } : null,
    pickupAt,
    bestehendeAbholzeitenDesFahrgasts: bestehendeFahrten.map((f) => f.pickupAt),
    approval: daten.approval,
    genehmigungen: fahrgast?.approvals ?? [],
    serviceAreaCenter: settings?.serviceAreaCenter
      ? (settings.serviceAreaCenter as { lat: number; lng: number })
      : null,
    serviceAreaKm: settings?.serviceAreaKm ?? 30,
  });

  const entwurf = await db.ride.create({
    data: {
      tenantId,
      passengerId: daten.passengerId,
      pickupPlaceId: daten.pickupPlaceId,
      dropoffPlaceId: daten.dropoffPlaceId,
      pickupAt,
      appointmentAt,
      transportType: daten.transportType,
      companion: daten.companion,
      assistanceNotes: daten.assistanceNotes || null,
      prescription: daten.prescription,
      approval: daten.approval,
      source: "MANUELL",
      status: "ENTWURF",
      problems: probleme,
    },
  });
  await fahrtStatusAendern(tenantId, entwurf.id, "ERFASST", { userId });
  await vorschlagBerechnenUndSpeichern(tenantId, entwurf.id, userId);

  if (daten.rueckfahrt && daten.rueckfahrtzeit) {
    const rueckfahrtAt = mitUhrzeit(tag, daten.rueckfahrtzeit);
    const rueckEntwurf = await db.ride.create({
      data: {
        tenantId,
        passengerId: daten.passengerId,
        pickupPlaceId: daten.dropoffPlaceId,
        dropoffPlaceId: daten.pickupPlaceId,
        pickupAt: rueckfahrtAt,
        transportType: daten.transportType,
        companion: daten.companion,
        assistanceNotes: daten.assistanceNotes || null,
        prescription: daten.prescription,
        approval: daten.approval,
        source: "MANUELL",
        status: "ENTWURF",
        returnOfId: entwurf.id,
      },
    });
    await fahrtStatusAendern(tenantId, rueckEntwurf.id, "ERFASST", { userId });
    await vorschlagBerechnenUndSpeichern(tenantId, rueckEntwurf.id, userId);
  }

  revalidatePath("/dispo/fahrten");
  revalidatePath("/dispo");
  return { rideId: entwurf.id, probleme };
}

/** "Bestätigen" (vorgeschlagenes Fahrzeug) oder "Anderes Fahrzeug" – beides läuft hierüber. */
export async function fahrzeugWaehlen(rideId: string, vehicleId: string) {
  const { tenantId, userId } = await requireSession();
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({ where: { id: rideId }, select: { pickupAt: true } });
  if (!fahrt) throw new Error("Fahrt nicht gefunden.");

  const schicht = await db.shift.findFirst({
    where: { vehicleId, start: { lte: fahrt.pickupAt }, end: { gte: fahrt.pickupAt } },
    select: { driverId: true },
  });

  await db.ride.update({
    where: { id: rideId },
    data: { vehicleId, driverId: schicht?.driverId, dispatchMode: "MANUELL" },
  });
  await fahrtStatusAendern(tenantId, rideId, "DISPONIERT", { userId });

  const vorschlag = await db.suggestion.findFirst({
    where: { rideId, decision: "OFFEN" },
    orderBy: { createdAt: "desc" },
  });
  if (vorschlag) {
    const optionen = vorschlag.options as { vehicleId: string }[];
    const istBesterVorschlag = optionen[0]?.vehicleId === vehicleId;
    await db.suggestion.update({
      where: { id: vorschlag.id },
      data: {
        decision: istBesterVorschlag ? "ANGENOMMEN" : "GEAENDERT",
        chosenVehicleId: vehicleId,
        decidedByUserId: userId,
        decidedAt: new Date(),
      },
    });
  }

  revalidatePath("/dispo/fahrten");
  revalidatePath("/dispo");
}

export async function fahrtStatusSetzen(rideId: string, status: RideStatus) {
  const { tenantId, userId } = await requireSession();
  await fahrtStatusAendern(tenantId, rideId, status, { userId });
  revalidatePath("/dispo/fahrten");
  revalidatePath("/dispo");
}
