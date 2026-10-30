"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db";
import { requireSession } from "@/lib/session";
import type { FahrtEingabe, SerieEingabe } from "@/core/rides/validation";
import { fahrtStatusAendern } from "@/core/rides/status";
import { fahrtAendern } from "@/core/rides/aendern";
import { fahrtErfassen } from "@/core/rides/erfassen";
import { serieAnlegen as serieAnlegenKern } from "@/core/rides/serie";
import { fahrtStornieren as fahrtStornierenKern } from "@/core/rides/stornieren";
import { fahrzeugZuweisen, FahrzeugKonfliktError } from "@/core/disposition/zuweisen";
import { fahrgaesteAehnlicheNamen, telefonNormalisieren } from "@/core/passengers/suche";
import { telefonMaskiert } from "@/core/notify/telefonMaskierung";
import { berlinerMitternacht, datumIso, wochenStart } from "@/core/shifts/week";
import { geplantesEnde } from "@/core/shifts/dauer";
import { fahrzeugLiveStatus, type FahrtFuerLiveStatus } from "@/core/shifts/liveStatus";
import { routingProvider, GEOCODE_SICHER_SCHWELLE } from "@/providers/routing";
import type { RideStatus } from "@/generated/prisma/enums";
import type { VorschlagOption } from "@/components/VorschlagAktion";

const LIVE_ANRUF_FENSTER_MIN = 30;

const ALARM_STATUS_GRUND: Partial<Record<RideStatus, string>> = {
  PROBLEM: "Problem gemeldet",
  NICHT_ANGETROFFEN: "Fahrgast nicht angetroffen",
};

function nachname(vollerName: string): string {
  const teile = vollerName.trim().split(/\s+/);
  return teile[teile.length - 1] ?? vollerName;
}

/** Höchste Fähigkeit zuerst (core/disposition/kandidaten.ts kennt dieselbe Reihenfolge). */
function fahrzeugTypLabel(fahrzeug: { stretcher: boolean; carryChair: boolean; wheelchairSpots: number }): string {
  if (fahrzeug.stretcher) return "Liegewagen";
  if (fahrzeug.carryChair) return "Tragestuhl";
  if (fahrzeug.wheelchairSpots > 0) return "Rollstuhl";
  return "Taxi";
}

/**
 * Lädt alles für die Fahrplan-Seite in einem Rutsch: Fahrten, Fahrer mit ihren Schichten im
 * selben Zeitraum und die Live-Fahrzeugpositionen für die Karte – ersetzt die frühere
 * Trennung zwischen "Fahrten" und "Fahrer & Schichten" (ein Menüpunkt statt zwei).
 */
export async function fahrplanLaden(datumFilter: string | undefined, ansicht: "tag" | "woche") {
  const { tenantId } = await requireSession();
  return fahrplanFuerMandantLaden(tenantId, datumFilter, ansicht);
}

/** Dieselbe Logik wie fahrplanLaden, aber mit einer schon bekannten tenantId statt über die
 * Sitzung - genutzt von der öffentlichen Live-Demo (src/app/live/actions.ts), die ohne Login
 * auskommt, aber nur den fest verdrahteten Demo-Mandanten sehen darf (DEMO_TENANT_ID). Welchen
 * Mandanten sie sehen darf, kennt diese Funktion nicht und ist deshalb genauso wenig/viel ein
 * Risiko wie fahrplanLaden mit einer manipulierten Sitzung - die Absicherung passiert beim
 * Aufrufer. oeffentlich=true lässt nur den Fahrgastnamen aus dem Live-Status weg (siehe
 * fahrzeugLiveStatus) - für alles andere bleibt die Funktion identisch. */
export async function fahrplanFuerMandantLaden(
  tenantId: string,
  datumFilter: string | undefined,
  ansicht: "tag" | "woche",
  oeffentlich = false,
) {
  const db = withTenant(tenantId);
  const tagIso = datumFilter ?? datumIso(new Date());
  const montag = wochenStart(berlinerMitternacht(tagIso));

  const von = ansicht === "woche" ? montag : berlinerMitternacht(tagIso);
  const bis = new Date(von);
  bis.setDate(bis.getDate() + (ansicht === "woche" ? 7 : 1));

  // Diese sieben Abfragen sind voneinander unabhängig und laufen deshalb gleichzeitig statt
  // nacheinander - spart auf einer entfernten Datenbank (Produktion) mehrere Netzwerk-Umläufe
  // pro Seitenaufruf. Nur was wirklich von einem Ergebnis hier abhängt (z. B. Fahrzeug-Positionen
  // brauchen erst die Fahrzeug-IDs) folgt danach noch als eigener, nacheinander laufender Schritt.
  const [fahrerRoh, fahrtenRoh, schichtenRoh, settings, tenant, fahrzeugeAktiv, unterwegs] = await Promise.all([
    db.driver.findMany({ select: { id: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
    db.ride.findMany({
      where: { pickupAt: { gte: von, lt: bis } },
      include: {
        passenger: { select: { firstName: true, lastName: true, phones: true, insurer: true } },
        pickupPlace: { select: { label: true, lat: true, lng: true } },
        dropoffPlace: { select: { label: true, lat: true, lng: true } },
        vehicle: { select: { plate: true } },
        suggestions: { where: { decision: "OFFEN" }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { pickupAt: "asc" },
    }),
    db.shift.findMany({
      where: { start: { lt: bis }, end: { gt: von } },
      select: { driverId: true, vehicleId: true, start: true, end: true, vehicle: { select: { plate: true } } },
      orderBy: { start: "asc" },
    }),
    db.tenantSettings.findUnique({ where: { tenantId } }),
    db.tenant.findUnique({ where: { id: tenantId }, select: { paket: true } }),
    db.vehicle.findMany({ where: { active: true }, orderBy: { plate: "asc" } }),
    db.ride.count({ where: { status: "UNTERWEGS", pickupAt: { gte: von, lt: bis } } }),
  ]);

  const fahrerNameNachId = new Map(fahrerRoh.map((f) => [f.id, f.user.name]));
  const fahrten = fahrtenRoh.map((fahrt) => {
    // Noch niemandem zugewiesene, aber schon berechnete Vorschläge sollen im Zeitstrahl beim
    // vorgeschlagenen Fahrzeug auftauchen (gestrichelt, Zustand "vorschlag" - siehe chipStil()) -
    // sonst sind diese Fahrten nirgends sichtbar, bis ein Disponent sie zufällig in der Liste
    // findet oder der Automatikmodus sie übernimmt.
    const besterVorschlag =
      fahrt.status === "VORGESCHLAGEN" && !fahrt.vehicleId
        ? ((fahrt.suggestions[0]?.options as { vehicleId: string }[] | undefined)?.[0] ?? null)
        : null;
    return {
      ...fahrt,
      fahrerName: fahrt.driverId ? (fahrerNameNachId.get(fahrt.driverId) ?? null) : null,
      geplantesEnde: geplantesEnde(fahrt.pickupAt, fahrt.transportType, fahrt.pickupPlace, fahrt.dropoffPlace),
      vorschlagVehicleId: besterVorschlag?.vehicleId ?? null,
    };
  });

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

  // Zeilen je Fahrzeug für den Tages-Zeitstrahl (DISPO-SPEZ.md Abschnitt 3.3) – nur für die
  // Tagesansicht gebraucht, die Wochenansicht bleibt bei Zeilen je Fahrer (noch nicht V1, siehe
  // DISPO-SPEZ.md Abschnitt 10 "Bewusst später").
  const jetzt = new Date();
  const fahrzeugZeilen =
    ansicht === "tag"
      ? fahrzeugeAktiv.map((v) => {
          const fahrerNamenHeute = [
            ...new Set(
              schichtenRoh
                .filter((s) => s.vehicleId === v.id)
                .map((s) => fahrerNameNachId.get(s.driverId))
                .filter((name): name is string => !!name),
            ),
          ];
          const fahrtenDesFahrzeugs = fahrten.filter((f) => f.vehicleId === v.id);
          return {
            id: v.id,
            plate: v.plate,
            typ: fahrzeugTypLabel(v),
            fahrerNamen: fahrerNamenHeute.map(nachname).join(" · "),
            live: fahrzeugLiveStatus(
              fahrtenDesFahrzeugs.map(
                (f): FahrtFuerLiveStatus => ({
                  status: f.status,
                  pickupAt: f.pickupAt,
                  geplantesEnde: f.geplantesEnde,
                  completedAt: f.completedAt,
                  driverDelayMin: f.driverDelayMin,
                  passagierName: `${f.passenger.firstName.charAt(0)}. ${f.passenger.lastName}`,
                }),
              ),
              jetzt,
              oeffentlich,
            ),
          };
        })
      : [];

  // "Braucht Sie" (docs/uebergabe-v2/docs/DISPO-SPEZ.md Abschnitt 3.6): echte Dispo-Ausnahmen plus
  // operative Probleme, bei denen die Automatik nicht weiterkommt – nur für die Tagesansicht relevant.
  let brauchtSie: { rideId: string; grund: string; beste: VorschlagOption | null }[] = [];
  let liveAnrufe: {
    id: string;
    startedAt: Date;
    fromNumber: string | null;
    fahrt: {
      id: string;
      pickupAt: Date;
      transportType: (typeof fahrten)[number]["transportType"];
      passenger: { firstName: string; lastName: string };
      pickupPlace: { label: string };
      dropoffPlace: { label: string };
      vehicle: { plate: string } | null;
    } | null;
    bekannterFahrgast: { name: string; anzahlFahrten: number } | null;
  }[] = [];
  let anrufeHeute = 0;

  if (ansicht === "tag") {
    const ausnahmen = fahrten
      .filter((f) => f.autoSkipReason && f.status === "VORGESCHLAGEN")
      .map((f) => ({
        rideId: f.id,
        grund: f.autoSkipReason as string,
        beste: (f.suggestions[0]?.options as VorschlagOption[] | undefined)?.[0] ?? null,
      }));

    const alarmFahrten = fahrten.filter(
      (f) => f.problems.length > 0 || f.status === "PROBLEM" || f.status === "NICHT_ANGETROFFEN",
    );
    const alarme = alarmFahrten.map((f) => ({
      rideId: f.id,
      grund: f.problems.length > 0 ? f.problems.join(", ") : (ALARM_STATUS_GRUND[f.status] ?? f.status),
      beste: null,
    }));

    const driverAckMinutes = settings?.driverAckMinutes ?? 5;
    const unbestaetigtKandidaten = fahrten.filter((f) => f.status === "DISPONIERT" && f.driverId && !f.driverAckAt);

    // Diese drei sind voneinander unabhängig (keine braucht das Ergebnis der anderen) und laufen
    // deshalb gleichzeitig statt nacheinander.
    const [letzteDisponiertEvents, anrufeHeuteAnzahl, liveAnrufeRoh] = await Promise.all([
      unbestaetigtKandidaten.length > 0
        ? db.rideStatusEvent.findMany({
            where: { rideId: { in: unbestaetigtKandidaten.map((f) => f.id) }, status: "DISPONIERT" },
            orderBy: { at: "desc" },
            select: { rideId: true, at: true },
          })
        : Promise.resolve([]),
      db.call.count({ where: { startedAt: { gte: von, lt: bis } } }),
      db.call.findMany({
        where: { durationSec: null, startedAt: { gte: new Date(jetzt.getTime() - LIVE_ANRUF_FENSTER_MIN * 60_000) } },
        orderBy: { startedAt: "desc" },
        include: {
          rides: {
            take: 1,
            orderBy: { createdAt: "desc" },
            include: {
              passenger: { select: { firstName: true, lastName: true } },
              pickupPlace: { select: { label: true } },
              dropoffPlace: { select: { label: true } },
              vehicle: { select: { plate: true } },
            },
          },
        },
      }),
    ]);
    anrufeHeute = anrufeHeuteAnzahl;

    const unbestaetigt: typeof alarme = [];
    const letztesEventJeFahrt = new Map<string, Date>();
    for (const event of letzteDisponiertEvents) {
      if (!letztesEventJeFahrt.has(event.rideId)) letztesEventJeFahrt.set(event.rideId, event.at);
    }
    for (const f of unbestaetigtKandidaten) {
      const seitWann = letztesEventJeFahrt.get(f.id);
      const minuten = seitWann ? (jetzt.getTime() - seitWann.getTime()) / 60_000 : null;
      if (minuten !== null && minuten >= driverAckMinutes) {
        unbestaetigt.push({ rideId: f.id, grund: "Fahrer hat nicht bestätigt", beste: null });
      }
    }

    // Eine Fahrt kann mehrere Gründe gleichzeitig erfüllen (z. B. Problem gemeldet UND vom
    // Automatikmodus übersprungen) – nie doppelt in der Liste, der erste (aussagekräftigste) Grund gewinnt.
    const brauchtSieNachId = new Map<string, { rideId: string; grund: string; beste: VorschlagOption | null }>();
    for (const eintrag of [...ausnahmen, ...alarme, ...unbestaetigt]) {
      if (!brauchtSieNachId.has(eintrag.rideId)) brauchtSieNachId.set(eintrag.rideId, eintrag);
    }
    brauchtSie = [...brauchtSieNachId.values()];

    // Solange die KI noch keine Fahrt erfasst hat, dem Disponenten trotzdem zeigen, ob die
    // Nummer zu einem bekannten Fahrgast passt (erspart das manuelle Nachschlagen während des
    // Gesprächs). Erst jetzt möglich (braucht liveAnrufeRoh von oben).
    const nummernOhneFahrt = [
      ...new Set(
        liveAnrufeRoh
          .filter((a) => a.rides.length === 0 && a.fromNumber)
          .map((a) => telefonNormalisieren(a.fromNumber as string)),
      ),
    ];
    const bekannteFahrgaeste =
      nummernOhneFahrt.length > 0
        ? await db.passenger.findMany({
            where: { phones: { hasSome: nummernOhneFahrt } },
            select: { id: true, firstName: true, lastName: true, phones: true },
          })
        : [];
    const fahrgastNachNummer = new Map<string, (typeof bekannteFahrgaeste)[number]>();
    for (const fg of bekannteFahrgaeste) {
      for (const nummer of fg.phones) {
        if (nummernOhneFahrt.includes(nummer)) fahrgastNachNummer.set(nummer, fg);
      }
    }
    const fahrtenAnzahlProFahrgast = await Promise.all(
      bekannteFahrgaeste.map((fg) => db.ride.count({ where: { passengerId: fg.id } })),
    );
    const anzahlFahrtenNachFahrgastId = new Map(
      bekannteFahrgaeste.map((fg, index) => [fg.id, fahrtenAnzahlProFahrgast[index]]),
    );

    liveAnrufe = liveAnrufeRoh.map((anruf) => {
      const fahrt = anruf.rides[0];
      const bekannterFahrgast =
        !fahrt && anruf.fromNumber ? fahrgastNachNummer.get(telefonNormalisieren(anruf.fromNumber)) : undefined;
      return {
        id: anruf.id,
        startedAt: anruf.startedAt,
        fromNumber: anruf.fromNumber ? telefonMaskiert(anruf.fromNumber) : null,
        fahrt: fahrt
          ? {
              id: fahrt.id,
              pickupAt: fahrt.pickupAt,
              transportType: fahrt.transportType,
              passenger: fahrt.passenger,
              pickupPlace: fahrt.pickupPlace,
              dropoffPlace: fahrt.dropoffPlace,
              vehicle: fahrt.vehicle,
            }
          : null,
        bekannterFahrgast: bekannterFahrgast
          ? {
              name: `${bekannterFahrgast.firstName} ${bekannterFahrgast.lastName}`,
              anzahlFahrten: anzahlFahrtenNachFahrgastId.get(bekannterFahrgast.id) ?? 0,
            }
          : null,
      };
    });
  }

  const vonDisponaEingeplant = fahrten.filter((f) => f.dispatchMode === "AUTO").length;

  return {
    fahrten,
    fahrer,
    fahrzeugZeilen,
    montagIso: datumIso(montag),
    paket: tenant?.paket ?? "PRO",
    kennzahlen: {
      fahrtenHeute: fahrten.length,
      unterwegs,
      vonDisponaEingeplant,
      brauchtSie: brauchtSie.length,
      anrufeHeute,
    },
    brauchtSie,
    liveAnrufe,
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

export async function fahrtAnlegen(eingabe: FahrtEingabe) {
  const { tenantId, userId } = await requireSession();
  const ergebnis = await fahrtErfassen(tenantId, eingabe, { userId, source: "MANUELL" });
  revalidatePath("/dispo");
  return ergebnis;
}

export async function serieAnlegen(eingabe: SerieEingabe) {
  const { tenantId, userId } = await requireSession();
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
  const { tenantId, userId } = await requireSession();
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
  const { tenantId, userId } = await requireSession();
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
  const { tenantId, userId } = await requireSession();
  await fahrtStatusAendern(tenantId, rideId, status, { userId });
  revalidatePath("/dispo");
}

export async function fahrtStornieren(rideId: string) {
  const { tenantId, userId } = await requireSession();
  await fahrtStornierenKern(tenantId, rideId, { userId });
  revalidatePath("/dispo");
}
