/**
 * Fahrplan eines Mandanten laden – bewusst KEINE "use server"-Datei (Maßnahme M-02, Verdacht
 * V-001): als exportierte Funktion in actions.ts war fahrplanFuerMandantLaden eine registrierte
 * Server Action ohne Sitzungsprüfung, die mit einer beliebigen tenantId aufrufbar gewesen wäre.
 * Hier ist sie ein normales Server-Modul; aufgerufen von fahrplanLaden() (mit Büro-Sitzung) und
 * der öffentlichen Live-Demo (fest auf DEMO_TENANT_ID). Welchen Mandanten der Aufrufer sehen
 * darf, prüft der Aufrufer.
 */
import { withTenant } from "@/lib/db";
import { fahrzeugTypLabel } from "@/core/rides/fahrzeugTyp";
import { telefonNormalisieren } from "@/core/passengers/suche";
import { telefonMaskiert } from "@/core/notify/telefonMaskierung";
import { berlinerMitternacht, datumIso, wochenStart } from "@/core/shifts/week";
import { geplantesEnde } from "@/core/shifts/dauer";
import { fahrzeugLiveStatus, type FahrtFuerLiveStatus } from "@/core/shifts/liveStatus";
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


/** oeffentlich=true lässt nur den Fahrgastnamen aus dem Live-Status weg (siehe fahrzeugLiveStatus). */
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
        ? ((fahrt.suggestions[0]?.options as VorschlagOption[] | undefined)?.[0] ?? null)
        : null;
    return {
      ...fahrt,
      fahrerName: fahrt.driverId ? (fahrerNameNachId.get(fahrt.driverId) ?? null) : null,
      geplantesEnde: geplantesEnde(fahrt.pickupAt, fahrt.transportType, fahrt.pickupPlace, fahrt.dropoffPlace),
      vorschlagVehicleId: besterVorschlag?.vehicleId ?? null,
      // Zeigt im Detail-Fenster (TripModal/LiveFahrtDetails) die tatsächliche Berechnung hinter
      // einem noch unbestätigten Vorschlag, statt ihn als Blackbox zu präsentieren.
      vorschlagBegruendung: besterVorschlag?.reason ?? null,
      // fahrt.autoSkipReason (aus dem "...fahrt"-Spread oben) bleibt auf der Fahrt stehen, auch
      // nachdem sie längst disponiert wurde (automatischDisponieren() setzt es nur beim
      // Scheitern, löscht es aber nie wieder) - ohne diese Überschreibung würde das Detail-
      // Fenster bei einer schon erfolgreich zugewiesenen Fahrt fälschlich den Grund eines
      // früheren, längst überholten Versuchs anzeigen. Nur noch relevant, solange die Fahrt
      // wirklich noch unbestätigt ist (derselbe Zustand wie vorschlagVehicleId oben).
      autoSkipReason: fahrt.status === "VORGESCHLAGEN" && !fahrt.vehicleId ? fahrt.autoSkipReason : null,
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
      beste: VorschlagOption | null;
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
              // Für "Auto zuweisen" direkt an der Anruf-Karte (docs/DISPO-SPEZ.md 3.4) - derselbe
              // Vorschlag, den auch der Zeitstrahl gestrichelt einzeichnet (siehe besterVorschlag
              // oben).
              suggestions: { where: { decision: "OFFEN" }, orderBy: { createdAt: "desc" }, take: 1 },
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
              beste: fahrt.vehicle
                ? null
                : ((fahrt.suggestions[0]?.options as VorschlagOption[] | undefined)?.[0] ?? null),
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
