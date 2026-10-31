"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { istEindeutigkeitsFehler, withTenant } from "@/lib/db";
import { rufnummerE164 } from "@/core/einrichtung/rufnummer";
import { requireBueroSession } from "@/lib/session";
import { LETZTER_SCHRITT } from "@/core/einrichtung/schritte";
import { routingProvider, GEOCODE_SICHER_SCHWELLE } from "@/providers/routing";
import { parseDeutscheAdresse } from "@/core/places/adresse";

async function adminSession() {
  const session = await requireBueroSession();
  if (session.role !== "ADMIN") {
    throw new Error("Nur der Inhaber (Admin) kann die Einrichtung ändern.");
  }
  return session;
}

/** Lädt alles, was die Einrichtungs-Schritte zum Anzeigen brauchen, in einem Rutsch. */
export async function einrichtungLaden() {
  const { tenantId } = await requireBueroSession();
  const db = withTenant(tenantId);
  const [tenant, settings, telefonnummer] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
    db.tenantSettings.findUniqueOrThrow({ where: { tenantId } }),
    db.phoneNumber.findFirst({ where: { tenantId } }),
  ]);
  return { tenant, settings, telefonnummer };
}

/** Markiert einen Schritt als erledigt (übersprungen oder ausgefüllt) und merkt sich den Stand. */
export async function schrittAbschliessen(schritt: number) {
  const { tenantId } = await adminSession();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const neuerStand = Math.max(tenant.setupStep, Math.min(schritt + 1, LETZTER_SCHRITT));
  const fertig = schritt >= LETZTER_SCHRITT;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { setupStep: neuerStand, setupDoneAt: fertig ? new Date() : tenant.setupDoneAt },
  });
  revalidatePath("/einrichtung");
}

/** Adresssuche fürs Firmen-/Betriebshof-Formular (gleicher Geocoder wie OrtAuswahl, aber ohne Place anzulegen). */
export async function adresseSuchen(text: string) {
  const ergebnisse = await routingProvider.geocode(text);
  return ergebnisse.map((r) => ({
    ...parseDeutscheAdresse(r.label),
    label: r.label,
    lat: r.position.lat,
    lng: r.position.lng,
    sicher: r.confidence >= GEOCODE_SICHER_SCHWELLE,
  }));
}

// ---- Schritt 1: Firma ----

const firmaSchema = z.object({
  name: z.string().min(1, "Name fehlt"),
  street: z.string().optional(),
  zip: z.string().optional(),
  city: z.string().optional(),
  depotAddress: z.object({ street: z.string(), zip: z.string(), city: z.string(), lat: z.number(), lng: z.number() }).nullable(),
  serviceAreaCenter: z.object({ lat: z.number(), lng: z.number() }),
  serviceAreaKm: z.number().int().min(1).max(200),
  oeffnungszeitVon: z.string().min(1),
  oeffnungszeitBis: z.string().min(1),
});
export type FirmaEingabe = z.infer<typeof firmaSchema>;

export async function firmaSpeichern(eingabe: FirmaEingabe) {
  const { tenantId } = await adminSession();
  const daten = firmaSchema.parse(eingabe);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { name: daten.name, street: daten.street || null, zip: daten.zip || null, city: daten.city || null },
  });
  await withTenant(tenantId).tenantSettings.update({
    where: { tenantId },
    data: {
      depotAddress: daten.depotAddress ?? undefined,
      serviceAreaCenter: daten.serviceAreaCenter,
      serviceAreaKm: daten.serviceAreaKm,
      openingHours: { "mo-fr": `${daten.oeffnungszeitVon}-${daten.oeffnungszeitBis}` },
    },
  });
  revalidatePath("/einrichtung");
}

// ---- Schritt 2: Telefon ----

export async function kiNummerSpeichern(e164: string) {
  const { tenantId } = await adminSession();
  // Prüfbericht S2-011: nur echte E.164-Nummern; eine Nummer, die schon einem anderen Fahrdienst
  // gehört, wird mit klarer Meldung abgelehnt statt mit einem Datenbankfehler. (Dass die Nummer
  // dem Mandanten wirklich gehört, kann nur der Betreiber bestätigen – siehe Behebungsprotokoll.)
  const nummer = rufnummerE164(e164);
  if (!nummer) throw new Error("Rufnummer bitte im internationalen Format angeben, z. B. +49 2401 123456.");
  const db = withTenant(tenantId);
  const vorhanden = await db.phoneNumber.findFirst({ where: { tenantId } });
  try {
    if (vorhanden) {
      await db.phoneNumber.update({ where: { id: vorhanden.id }, data: { e164: nummer, provider: "VAPI" } });
    } else {
      await db.phoneNumber.create({ data: { tenantId, e164: nummer, provider: "VAPI" } });
    }
  } catch (fehler) {
    if (istEindeutigkeitsFehler(fehler)) {
      throw new Error("Diese Rufnummer ist schon einem anderen Fahrdienst zugeordnet.");
    }
    throw fehler;
  }
  revalidatePath("/einrichtung");
}

/** Prüft, ob seit `seit` ein Anruf bei diesem Mandanten angekommen ist (für den Rufumleitungs-Test). */
export async function testanrufPruefen(seit: string) {
  const { tenantId } = await requireBueroSession();
  const anruf = await withTenant(tenantId).call.findFirst({
    where: { startedAt: { gte: new Date(seit) } },
    orderBy: { startedAt: "desc" },
  });
  if (!anruf) return { gefunden: false as const };
  return { gefunden: true as const, anrufernummer: anruf.fromNumber ?? "unbekannt" };
}

// ---- Schritt 5: Disposition – nutzt die bestehende EinstellungenClient-Seite aus Phase 7 direkt. ----

// ---- Schritt 6: KI anpassen ----

const kiSchema = z.object({
  voiceId: z.string().min(1),
  greeting: z.string().min(1),
  escalationNumber: z.string().min(1),
});
export type KiEingabe = z.infer<typeof kiSchema>;

export async function kiEinstellungenSpeichern(eingabe: KiEingabe) {
  const { tenantId } = await adminSession();
  const daten = kiSchema.parse(eingabe);
  await withTenant(tenantId).tenantSettings.update({ where: { tenantId }, data: daten });
  revalidatePath("/einrichtung");
}

// ---- Schritt 7: Testanruf ----

export async function fahrerFuerTestanrufLaden() {
  const { tenantId } = await requireBueroSession();
  return withTenant(tenantId).driver.findMany({
    include: { user: { select: { name: true } }, pushSubscriptions: { select: { id: true } } },
    orderBy: { user: { name: "asc" } },
  });
}

export async function letzteFahrtenLaden(seit: string) {
  const { tenantId } = await requireBueroSession();
  return withTenant(tenantId).ride.findMany({
    where: { createdAt: { gte: new Date(seit) } },
    include: { passenger: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}

// ---- Schritt 8: Live schalten ----

export type AiZeitplanModus = "AUS" | "NACHTS_WOCHENENDE" | "IMMER";

export async function liveSchalten(modus: AiZeitplanModus) {
  const { tenantId } = await adminSession();
  await withTenant(tenantId).tenantSettings.update({
    where: { tenantId },
    data: {
      aiActive: modus !== "AUS",
      aiSchedule: modus === "AUS" ? undefined : { modus },
    },
  });
  await schrittAbschliessen(LETZTER_SCHRITT);
  revalidatePath("/");
}
