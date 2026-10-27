"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { fahrtPruefen, type Problem } from "@/core/rides/pruefungen";
import { fahrtSchema, type FahrtEingabe } from "@/core/rides/validation";
import { fahrtStatusAendern } from "@/core/rides/status";
import { fahrgaesteAehnlicheNamen, telefonNormalisieren } from "@/core/passengers/suche";
import { berlinerMitternacht, datumIso, mitUhrzeit, wochenStart } from "@/core/shifts/week";
import { vorschlaegeBerechnen, type GeplanteFahrt } from "@/core/disposition/vorschlagen";
import { pushAnFahrer } from "@/core/notify/push";
import { neueFahrtText, stornierteFahrtText } from "@/core/notify/texte";
import { routingProvider, GEOCODE_SICHER_SCHWELLE } from "@/providers/routing";
import type { RideStatus } from "@/generated/prisma/enums";

function uhrzeitBerlin(datum: Date): string {
  return datum.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
}

async function fahrtenImZeitraumLaden(tenantId: string, von: Date, bis: Date) {
  const db = withTenant(tenantId);
  // Nacheinander statt mit Promise.all, siehe fahrplanLaden weiter unten.
  const fahrtenRoh = await db.ride.findMany({
    where: { pickupAt: { gte: von, lt: bis } },
    include: {
      passenger: { select: { firstName: true, lastName: true } },
      pickupPlace: { select: { label: true } },
      dropoffPlace: { select: { label: true } },
      vehicle: { select: { plate: true } },
      suggestions: { where: { decision: "OFFEN" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { pickupAt: "asc" },
  });
  const fahrer = await db.driver.findMany({ select: { id: true, user: { select: { name: true } } } });

  const fahrerNachId = new Map(fahrer.map((f) => [f.id, f.user.name]));
  return fahrtenRoh.map((fahrt) => ({
    ...fahrt,
    fahrerName: fahrt.driverId ? (fahrerNachId.get(fahrt.driverId) ?? null) : null,
  }));
}


/**
 * Lädt alles für die Fahrplan-Seite in einem Rutsch: Fahrten, Fahrer mit ihren Schichten im
 * selben Zeitraum und die Live-Fahrzeugpositionen für die Karte – ersetzt die frühere
 * Trennung zwischen "Fahrten" und "Fahrer & Schichten" (ein Menüpunkt statt zwei).
 */
export async function fahrplanLaden(datumFilter: string | undefined, ansicht: "tag" | "woche") {
  const { tenantId } = await requireSession();
  const db = withTenant(tenantId);
  const tagIso = datumFilter ?? datumIso(new Date());
  const montag = wochenStart(berlinerMitternacht(tagIso));

  const von = ansicht === "woche" ? montag : berlinerMitternacht(tagIso);
  const bis = new Date(von);
  bis.setDate(bis.getDate() + (ansicht === "woche" ? 7 : 1));

  // Nacheinander statt mit Promise.all: die lokale Entwicklungsdatenbank (npx prisma dev)
  // verträgt viele gleichzeitige Abfragen auf einer Seite schlecht (siehe src/lib/prisma.ts).
  // Diese Seite lädt ohnehin selten genug, dass die paar zusätzlichen Millisekunden nicht auffallen.
  const fahrten = await fahrtenImZeitraumLaden(tenantId, von, bis);
  const fahrerRoh = await db.driver.findMany({
    select: { id: true, user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  const schichtenRoh = await db.shift.findMany({
    where: { start: { lt: bis }, end: { gt: von } },
    select: { driverId: true, start: true, end: true, vehicle: { select: { plate: true } } },
    orderBy: { start: "asc" },
  });
  const settings = await db.tenantSettings.findUnique({ where: { tenantId } });
  const fahrzeugeAktiv = await db.vehicle.findMany({ where: { active: true }, orderBy: { plate: "asc" } });

  const letztePositionen = await db.vehicleLocation.findMany({
    where: { vehicleId: { in: fahrzeugeAktiv.map((f) => f.id) } },
    orderBy: { at: "desc" },
    distinct: ["vehicleId"],
    select: { vehicleId: true, lat: true, lng: true },
  });
  const positionNachFahrzeug = new Map(letztePositionen.map((p) => [p.vehicleId, p]));

  const fahrer = fahrerRoh.map((f) => ({
    id: f.id,
    name: f.user.name,
    schichten: schichtenRoh
      .filter((s) => s.driverId === f.id)
      .map((s) => ({ start: s.start, end: s.end, plate: s.vehicle.plate })),
  }));

  return {
    fahrten,
    fahrer,
    montagIso: datumIso(montag),
    karte: settings
      ? {
          fahrzeuge: fahrzeugeAktiv.map((f) => ({
            id: f.id,
            plate: f.plate,
            position: positionNachFahrzeug.get(f.id) ?? null,
          })),
          serviceArea: {
            center: settings.serviceAreaCenter as { lat: number; lng: number },
            radiusKm: settings.serviceAreaKm,
            depot: settings.depotAddress as { lat: number; lng: number } | null,
          },
        }
      : null,
  };
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
  const fahrt = await db.ride.findUnique({
    where: { id: rideId },
    select: { pickupAt: true, pickupPlace: { select: { label: true } }, dropoffPlace: { select: { label: true } } },
  });
  if (!fahrt) throw new Error("Fahrt nicht gefunden.");

  const schicht = await db.shift.findFirst({
    where: { vehicleId, start: { lte: fahrt.pickupAt }, end: { gte: fahrt.pickupAt } },
    select: { driverId: true },
  });

  await db.ride.update({
    where: { id: rideId },
    data: { vehicleId, driverId: schicht?.driverId, dispatchMode: "MANUELL", driverAckAt: null },
  });
  await fahrtStatusAendern(tenantId, rideId, "DISPONIERT", { userId });

  if (schicht?.driverId) {
    const text = neueFahrtText(uhrzeitBerlin(fahrt.pickupAt), fahrt.pickupPlace.label, fahrt.dropoffPlace.label);
    await pushAnFahrer(tenantId, schicht.driverId, { title: "Neue Fahrt", body: text, url: "/fahrer" });
    await db.notification.create({
      data: { tenantId, channel: "PUSH", toRef: schicht.driverId, rideId, kind: "NEUE_FAHRT" },
    });
  }

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

export async function fahrtStornieren(rideId: string) {
  const { tenantId, userId } = await requireSession();
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({ where: { id: rideId }, select: { pickupAt: true, driverId: true } });
  if (!fahrt) throw new Error("Fahrt nicht gefunden.");

  await fahrtStatusAendern(tenantId, rideId, "STORNIERT", { userId });

  if (fahrt.driverId) {
    const text = stornierteFahrtText(uhrzeitBerlin(fahrt.pickupAt));
    await pushAnFahrer(tenantId, fahrt.driverId, { title: "Fahrt entfällt", body: text, url: "/fahrer" });
    await db.notification.create({
      data: { tenantId, channel: "PUSH", toRef: fahrt.driverId, rideId, kind: "STORNO" },
    });
  }

  revalidatePath("/dispo/fahrten");
  revalidatePath("/dispo");
}
