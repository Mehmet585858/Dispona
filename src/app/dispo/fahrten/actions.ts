"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db";
import { requireBueroSession } from "@/lib/session";
import type { FahrtEingabe, SerieEingabe } from "@/core/rides/validation";
import { fahrtStatusAendern } from "@/core/rides/status";
import { fahrtAendern } from "@/core/rides/aendern";
import { fahrtErfassen } from "@/core/rides/erfassen";
import { serieAnlegen as serieAnlegenKern } from "@/core/rides/serie";
import { fahrtStornieren as fahrtStornierenKern } from "@/core/rides/stornieren";
import { fahrzeugZuweisen, fahrzeugZuweisungAufheben, FahrzeugKonfliktError } from "@/core/disposition/zuweisen";
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
    if (fehler instanceof FahrzeugKonfliktError) return { ok: false, grund: fehler.message };
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

/** Eine Fahrt im Zeitstrahl per Ziehen verschieben: andere Uhrzeit (gleicher Tag), anderes
 * Fahrzeug, oder beides zusammen – z. B. auf eine andere Fahrzeug-Zeile zu einer anderen Zeit
 * gezogen. Zeit zuerst (das setzt eine schon disponierte Fahrt zurück auf "Erfasst" und löst
 * eine neue Vorschlagsberechnung aus, siehe fahrtAendern), danach greift die Fahrzeugwahl immer
 * den am Ende gewünschten Stand. */
export async function fahrtVerschieben(
  rideId: string,
  eingabe: { neueAbholzeit?: string; neuesFahrzeugId?: string },
): Promise<{ ok: true } | { ok: false; grund: string }> {
  const { tenantId, userId } = await requireBueroSession();
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({ where: { id: rideId }, select: { status: true } });
  if (!fahrt) return { ok: false, grund: "Fahrt nicht gefunden." };
  if (NICHT_VERSCHIEBBARE_STATUS.has(fahrt.status)) {
    return { ok: false, grund: "Diese Fahrt läuft schon oder ist abgeschlossen und kann nicht mehr verschoben werden." };
  }

  if (eingabe.neueAbholzeit) {
    const ergebnis = await fahrtAendern(tenantId, rideId, { abholzeit: eingabe.neueAbholzeit }, { userId });
    if (!ergebnis.ok) {
      revalidatePath("/dispo");
      return { ok: false, grund: "Diese Fahrt kann nicht mehr verschoben werden." };
    }
  } else if (eingabe.neuesFahrzeugId && fahrt.status === "DISPONIERT") {
    // Reine Fahrzeug-Umbesetzung einer schon disponierten Fahrt (keine Zeitänderung, die das schon
    // erledigen würde): fahrzeugZuweisen setzt den Status fest auf "Disponiert" – von "Disponiert"
    // aus ist das kein erlaubter Übergang, deshalb hier erst auf "Erfasst" zurücksetzen.
    await fahrtStatusAendern(tenantId, rideId, "ERFASST", { userId });
  }
  if (eingabe.neuesFahrzeugId) {
    try {
      await fahrzeugZuweisen(tenantId, rideId, eingabe.neuesFahrzeugId, { dispatchMode: "MANUELL", userId });
    } catch (fehler) {
      revalidatePath("/dispo");
      if (fehler instanceof FahrzeugKonfliktError) return { ok: false, grund: fehler.message };
      throw fehler;
    }
  }
  revalidatePath("/dispo");
  return { ok: true };
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
