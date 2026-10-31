"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db";
import { requireBueroSession } from "@/lib/session";
import type { FahrtEingabe, SerieEingabe } from "@/core/rides/validation";
import { fahrtStatusAendern } from "@/core/rides/status";
import { fahrtAendern } from "@/core/rides/aendern";
import { fahrtErfassen } from "@/core/rides/erfassen";
import { serieAnlegen as serieAnlegenKern } from "@/core/rides/serie";
import { fahrerNachAenderungBenachrichtigen } from "@/core/rides/fahrerBenachrichtigen";
import { fahrtAbbrechen as fahrtAbbrechenKern, fahrtStornieren as fahrtStornierenKern } from "@/core/rides/stornieren";
import {
  einsatzfaehigenFahrerFinden,
  fahrzeugZuweisen,
  fahrzeugZuweisungAufheben,
  FahrzeugKonfliktError,
  KeinFahrerError,
} from "@/core/disposition/zuweisen";
import { fahrgaesteAehnlicheNamen, NACHNAME_KANDIDATEN_MAX, nachnameKandidatenWhere, telefonNormalisieren } from "@/core/passengers/suche";
import { einsatzgebietMitteLaden } from "@/core/einrichtung/einsatzgebiet";
import { routingProvider, GEOCODE_SICHER_SCHWELLE } from "@/providers/routing";
import type { RideStatus } from "@/generated/prisma/enums";
import { fahrplanFuerMandantLaden } from "./fahrplan";

/**
 * Lädt alles für die Fahrplan-Seite in einem Rutsch: Fahrten, Fahrer mit ihren Schichten im
 * selben Zeitraum und die Live-Fahrzeugpositionen für die Karte – ersetzt die frühere
 * Trennung zwischen "Fahrten" und "Fahrer & Schichten" (ein Menüpunkt statt zwei).
 */
export async function fahrplanLaden(datumFilter: string | undefined, ansicht: "tag" | "woche") {
  const { tenantId } = await requireBueroSession();
  return fahrplanFuerMandantLaden(tenantId, datumFilter, ansicht);
}

export async function fahrgaesteSuchen(text: string) {
  const { tenantId } = await requireBueroSession();
  if (text.trim().length < 2) return [];
  const db = withTenant(tenantId);
  const telefon = telefonNormalisieren(text);

  // Maßnahme M-06 (S2-006): Kandidaten per Datenbankabfrage statt der ersten 200 Zeilen.
  const [perTelefon, kandidaten] = await Promise.all([
    db.passenger.findMany({ where: { phones: { has: telefon } }, take: 5 }),
    db.passenger.findMany({ where: nachnameKandidatenWhere(text), take: NACHNAME_KANDIDATEN_MAX }),
  ]);

  const perName = fahrgaesteAehnlicheNamen(kandidaten, text).slice(0, 8);
  const gefunden = new Map([...perTelefon, ...perName].map((f) => [f.id, f]));
  return [...gefunden.values()];
}

export async function orteFuerAuswahl() {
  const { tenantId } = await requireBueroSession();
  return withTenant(tenantId).place.findMany({
    orderBy: { label: "asc" },
    select: { id: true, label: true, street: true, city: true },
  });
}

export async function ortSuchen(text: string) {
  // Maßnahme M-02 / Prüfbericht S3-003: vorher ohne Anmeldung aufrufbar (offener Geocoding-Proxy).
  const { tenantId } = await requireBueroSession();
  // Maßnahme M-06 (S2-007): Geocoding mit Bezug zum Einsatzgebiet.
  const ergebnisse = await routingProvider.geocode(text, await einsatzgebietMitteLaden(tenantId));
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
  const { tenantId } = await requireBueroSession();
  const ort = await withTenant(tenantId).place.create({
    data: { tenantId, type: "SONSTIGES", usageCount: 0, ...eingabe },
  });
  return ort;
}

export async function fahrtAnlegen(eingabe: FahrtEingabe) {
  const { tenantId, userId } = await requireBueroSession();
  const ergebnis = await fahrtErfassen(tenantId, eingabe, { userId, source: "MANUELL" });
  revalidatePath("/dispo");
  return ergebnis;
}

export async function serieAnlegen(eingabe: SerieEingabe) {
  const { tenantId, userId } = await requireBueroSession();
  const ergebnis = await serieAnlegenKern(tenantId, eingabe, { userId, source: "MANUELL" });
  revalidatePath("/dispo");
  return ergebnis;
}

/** "Bestätigen" (vorgeschlagenes Fahrzeug) oder "Anderes Fahrzeug" – beides läuft hierüber.
 * Gibt {ok:false, grund} statt zu werfen zurück, wenn das Fahrzeug schon belegt ist - ein
 * geworfener Fehler würde serverseitig u. U. mit einer generischen Meldung ersetzt, bevor er den
 * Client erreicht (Next.js-Verhalten bei Server Actions), die konkrete Konflikt-Uhrzeit also nie
 * ankommen. */
export async function fahrzeugWaehlen(rideId: string, vehicleId: string): Promise<{ ok: true } | { ok: false; grund: string }> {
  const { tenantId, userId } = await requireBueroSession();
  try {
    await fahrzeugZuweisen(tenantId, rideId, vehicleId, { dispatchMode: "MANUELL", userId });
  } catch (fehler) {
    revalidatePath("/dispo");
    // Maßnahme M-72 (S1-008): auch "kein einsatzfähiger Fahrer" als Meldung, nicht als Absturz.
    if (fehler instanceof FahrzeugKonfliktError || fehler instanceof KeinFahrerError) return { ok: false, grund: fehler.message };
    throw fehler;
  }
  revalidatePath("/dispo");
  return { ok: true };
}

/** "Rückgängig" nach "Auto zuweisen" im Anruf-Panel (docs/DISPO-SPEZ.md 3.4). */
export async function zuweisungRueckgaengig(rideId: string): Promise<{ ok: true } | { ok: false; grund: string }> {
  const { tenantId, userId } = await requireBueroSession();
  try {
    await fahrzeugZuweisungAufheben(tenantId, rideId, { userId });
  } catch (fehler) {
    revalidatePath("/dispo");
    return { ok: false, grund: fehler instanceof Error ? fehler.message : "Konnte nicht rückgängig gemacht werden." };
  }
  revalidatePath("/dispo");
  return { ok: true };
}

const NICHT_VERSCHIEBBARE_STATUS = new Set<string>(["UNTERWEGS", "AN_BORD", "ERLEDIGT", "STORNIERT", "NICHT_ANGETROFFEN"]);

/**
 * Eine Fahrt im Zeitstrahl per Ziehen verschieben: andere Uhrzeit (gleicher Tag), anderes Fahrzeug
 * (andere Zeile), oder beides. Maßnahme M-20 (docs/13 R2-4, R2-9):
 * - Ein noch unbestätigter Vorschlag bleibt Vorschlag, wenn er nur in der Zeit verschoben wird
 *   (gleiche Zeile): Zeit ändern, Vorschlag neu rechnen – keine Zuweisung, keine Push. Vorher
 *   wurde er ungefragt zur festen Zuweisung, und der Fahrer bekam "Neue Fahrt".
 * - Zugewiesen wird nur bei Zeilenwechsel (ausdrückliche Wahl eines Fahrzeugs) oder wenn die
 *   Fahrt schon disponiert war (dann bleibt sie beim gewählten Fahrzeug).
 * - Alle Schritte melden nichts selbst; am Ende gibt es genau eine passende Push je Fahrer.
 */
export async function fahrtVerschieben(
  rideId: string,
  eingabe: { neueAbholzeit?: string; neuesFahrzeugId?: string },
): Promise<{ ok: true } | { ok: false; grund: string }> {
  const { tenantId, userId } = await requireBueroSession();
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({
    where: { id: rideId },
    select: {
      status: true,
      vehicleId: true,
      driverId: true,
      pickupAt: true,
      suggestions: { where: { decision: "OFFEN" }, orderBy: { createdAt: "desc" }, take: 1, select: { options: true } },
    },
  });
  if (!fahrt) return { ok: false, grund: "Fahrt nicht gefunden." };
  if (NICHT_VERSCHIEBBARE_STATUS.has(fahrt.status)) {
    return { ok: false, grund: "Diese Fahrt läuft schon oder ist abgeschlossen und kann nicht mehr verschoben werden." };
  }

  // In welcher Zeile stand der Chip? Disponiert: beim Fahrzeug; Vorschlag: beim besten Vorschlag.
  const besterVorschlag = (fahrt.suggestions[0]?.options as { vehicleId: string }[] | undefined)?.[0]?.vehicleId ?? null;
  const zeileVorher = fahrt.status === "DISPONIERT" ? fahrt.vehicleId : besterVorschlag;
  const zeilenwechsel = !!eingabe.neuesFahrzeugId && eingabe.neuesFahrzeugId !== zeileVorher;
  const warDisponiert = fahrt.status === "DISPONIERT";
  const zielFahrzeug = zeilenwechsel ? eingabe.neuesFahrzeugId : warDisponiert ? fahrt.vehicleId : null;

  let fehler: string | null = null;
  try {
    if (eingabe.neueAbholzeit) {
      const ergebnis = await fahrtAendern(tenantId, rideId, { abholzeit: eingabe.neueAbholzeit }, { userId, benachrichtigen: false });
      if (!ergebnis.ok) fehler = "Diese Fahrt kann nicht mehr verschoben werden.";
    } else if (zeilenwechsel && warDisponiert && zielFahrzeug) {
      // Maßnahme M-72 (S1-008): bevor die bestehende Zuweisung gelöst wird, muss das Zielfahrzeug
      // einen einsatzfähigen Fahrer haben – sonst stünde die Fahrt danach auf "Erfasst" mit dem
      // alten Fahrzeug, statt unverändert disponiert zu bleiben.
      try {
        await einsatzfaehigenFahrerFinden(db, zielFahrzeug, fahrt.pickupAt);
      } catch (ausnahme) {
        if (!(ausnahme instanceof KeinFahrerError)) throw ausnahme;
        fehler = ausnahme.message;
      }
      // Reine Umbesetzung einer disponierten Fahrt: DISPONIERT -> DISPONIERT ist kein erlaubter
      // Übergang, deshalb erst zurück auf "Erfasst".
      if (!fehler) await fahrtStatusAendern(tenantId, rideId, "ERFASST", { userId });
    }
    if (!fehler && zielFahrzeug && (zeilenwechsel || eingabe.neueAbholzeit)) {
      try {
        await fahrzeugZuweisen(tenantId, rideId, zielFahrzeug, { dispatchMode: "MANUELL", userId, benachrichtigen: false });
      } catch (ausnahme) {
        if (!(ausnahme instanceof FahrzeugKonfliktError) && !(ausnahme instanceof KeinFahrerError)) throw ausnahme;
        fehler = ausnahme.message;
      }
    }
  } finally {
    // Auch nach einem Konflikt: wer die Fahrt verloren hat, muss es erfahren.
    const nachher = await db.ride.findUnique({ where: { id: rideId }, select: { driverId: true, pickupAt: true, status: true } });
    if (nachher) {
      await fahrerNachAenderungBenachrichtigen(
        tenantId,
        rideId,
        { driverId: fahrt.driverId, pickupAt: fahrt.pickupAt, status: fahrt.status },
        nachher,
        { geaendert: nachher.pickupAt.getTime() !== fahrt.pickupAt.getTime() },
      );
    }
    revalidatePath("/dispo");
  }
  return fehler ? { ok: false, grund: fehler } : { ok: true };
}

export async function fahrtStatusSetzen(rideId: string, status: RideStatus) {
  const { tenantId, userId } = await requireBueroSession();
  await fahrtStatusAendern(tenantId, rideId, status, { userId });
  revalidatePath("/dispo");
}

export async function fahrtStornieren(rideId: string) {
  const { tenantId, userId } = await requireBueroSession();
  await fahrtStornierenKern(tenantId, rideId, { userId });
  revalidatePath("/dispo");
}

/** Maßnahme M-19: laufende Fahrt abbrechen (statt stornieren) – nur Büro. */
export async function fahrtAbbrechen(rideId: string) {
  const { tenantId, userId } = await requireBueroSession();
  await fahrtAbbrechenKern(tenantId, rideId, { userId });
  revalidatePath("/dispo");
}
