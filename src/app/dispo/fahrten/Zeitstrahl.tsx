"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { chipStil, farbeFuerArt, type Fahrtzustand } from "@/core/rides/transportfarbe";
import { TRANSPORT_TYPE_LABEL, TRANSPORT_TYPES } from "@/core/rides/validation";
import type { FahrzeugLiveStatus } from "@/core/shifts/liveStatus";
import {
  berlinerMitternacht,
  datumIso,
  wochenStart,
  wochenTage,
  WOCHENTAG_KURZ,
} from "@/core/shifts/week";
import {
  ZEITSTRAHL_ENDE_STUNDE,
  ZEITSTRAHL_START_STUNDE,
  zeitstrahlBreite,
  zeitstrahlPosition,
} from "@/core/shifts/zeitstrahl";

const LIVE_PUNKT_FARBE: Record<FahrzeugLiveStatus["punkt"], string> = {
  go: "var(--live-go)",
  in: "var(--live-in)",
  at: "var(--live-at)",
  free: "var(--live-free)",
  late: "var(--live-late)",
};

const STUNDEN_TICKS = Array.from({ length: ZEITSTRAHL_ENDE_STUNDE - ZEITSTRAHL_START_STUNDE + 1 }, (_, i) => ZEITSTRAHL_START_STUNDE + i);
/** Breite einer Stunde im Tages-Zeitstrahl in Pixeln – fest statt prozentual, damit der Zeitstrahl
 * horizontal scrollbar ist (volle 24 Std. sichtbar, aber nie gequetschte Chips). */
const PX_PRO_STUNDE = 130;
const ZEITSTRAHL_BREITE_PX = (ZEITSTRAHL_ENDE_STUNDE - ZEITSTRAHL_START_STUNDE) * PX_PRO_STUNDE;
function px(prozent: number): number {
  return (prozent / 100) * ZEITSTRAHL_BREITE_PX;
}

function uhrzeit(datum: Date): string {
  return new Date(datum).toLocaleTimeString("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function istAlarmFahrt(fahrt: { status: string; problems: string[] }): boolean {
  return fahrt.problems.length > 0 || fahrt.status === "PROBLEM" || fahrt.status === "NICHT_ANGETROFFEN";
}

/** Farbe = Transportart, Füllung = Zustand (docs/DESIGN-GUIDE.md Abschnitt 4.1/4.2). */
function zustandFuerFahrt(fahrt: { status: string; driverDelayMin: number | null }): Fahrtzustand {
  if (fahrt.status === "UNTERWEGS" || fahrt.status === "AN_BORD") {
    return fahrt.driverDelayMin && fahrt.driverDelayMin > 0 ? "verspaetet" : "laeuft";
  }
  if (fahrt.status === "ERLEDIGT") return "erledigt";
  if (fahrt.status === "VORGESCHLAGEN" || fahrt.status === "ERFASST") return "vorschlag";
  return "geplant";
}

export type FahrtMini = {
  id: string;
  pickupAt: Date;
  geplantesEnde: Date;
  status: string;
  problems: string[];
  transportType: (typeof TRANSPORT_TYPES)[number];
  driverDelayMin: number | null;
  vehicleId: string | null;
  passenger: { firstName: string; lastName: string; phones?: string[]; insurer?: string | null };
  pickupPlace: { label: string };
  dropoffPlace: { label: string };
  vehicle: { plate: string } | null;
  driverId: string | null;
  prescription?: string;
  approval?: string;
  assistanceNotes?: string | null;
  autoSkipReason?: string | null;
  suggestions?: { options: unknown }[];
};

export type FahrerZeile = {
  id: string;
  name: string;
  schichten: { start: Date; end: Date; plate: string }[];
};

export type FahrzeugZeile = {
  id: string;
  plate: string;
  typ: string;
  fahrerNamen: string;
  live: FahrzeugLiveStatus;
};

/** Kurzname für den Chip-Text, z. B. "J. Kramer" (DISPO-SPEZ.md Abschnitt 3.3). */
function kurzname(vorname: string, nachname: string): string {
  return `${vorname.charAt(0)}. ${nachname}`;
}

function SpurKompakt({
  schicht,
  fahrten,
  onKlick,
}: {
  schicht: { start: Date; end: Date } | null;
  fahrten: FahrtMini[];
  onKlick?: (id: string) => void;
}) {
  return (
    <div className="relative h-5 rounded-md bg-ground">
      {schicht ? (
        <div
          className="absolute inset-y-0.5 rounded-sm bg-accent-soft"
          style={{
            left: `${zeitstrahlPosition(schicht.start)}%`,
            width: `${zeitstrahlBreite(schicht.start, schicht.end)}%`,
          }}
        />
      ) : null}
      {fahrten.map((fahrt) => {
        const stil = chipStil(fahrt.transportType, zustandFuerFahrt(fahrt));
        return (
          <button
            key={fahrt.id}
            type="button"
            onClick={() => onKlick?.(fahrt.id)}
            title={`${uhrzeit(fahrt.pickupAt)} ${fahrt.passenger.firstName} ${fahrt.passenger.lastName}`}
            className={`absolute top-0.5 bottom-0.5 w-1.5 rounded-sm ${istAlarmFahrt(fahrt) ? "ring-2 ring-danger-ink" : ""}`}
            style={{ left: `${zeitstrahlPosition(fahrt.pickupAt)}%`, ...stil }}
          />
        );
      })}
    </div>
  );
}

/** Zeile im Tages-Zeitstrahl: Chips sind so breit wie die geschätzte Fahrtdauer, mit Zeit und
 * Kurzname (DISPO-SPEZ.md Abschnitt 3.3) – kein Text zur Transportart, die steckt in der Farbe. */
function SpurTag({
  schicht,
  fahrten,
  jetztProzent,
  passtZurSuche,
  onKlick,
}: {
  schicht: { start: Date; end: Date } | null;
  fahrten: FahrtMini[];
  jetztProzent: number | null;
  passtZurSuche?: (fahrt: FahrtMini) => boolean;
  onKlick?: (id: string) => void;
}) {
  return (
    <div className="relative h-14 rounded-md bg-ground" style={{ width: ZEITSTRAHL_BREITE_PX }}>
      {schicht ? (
        <div
          className="absolute inset-y-0.5 rounded-sm bg-accent-soft"
          style={{
            left: px(zeitstrahlPosition(schicht.start)),
            width: px(zeitstrahlBreite(schicht.start, schicht.end)),
          }}
        />
      ) : null}
      {jetztProzent !== null ? (
        <div className="absolute inset-y-0 w-px bg-now" style={{ left: px(jetztProzent) }} />
      ) : null}
      {fahrten.map((fahrt) => {
        const stil = chipStil(fahrt.transportType, zustandFuerFahrt(fahrt));
        const verspaetet = zustandFuerFahrt(fahrt) === "verspaetet";
        const passt = passtZurSuche ? passtZurSuche(fahrt) : true;
        return (
          <button
            key={fahrt.id}
            type="button"
            onClick={() => onKlick?.(fahrt.id)}
            title={`${uhrzeit(fahrt.pickupAt)}–${uhrzeit(fahrt.geplantesEnde)} ${fahrt.passenger.firstName} ${
              fahrt.passenger.lastName
            } · ${TRANSPORT_TYPE_LABEL[fahrt.transportType]}`}
            className={`absolute top-1.5 bottom-1.5 flex flex-col justify-center overflow-hidden rounded-md px-2 text-left text-xs leading-tight ${istAlarmFahrt(fahrt) ? "ring-2 ring-danger-ink" : ""}`}
            style={{
              left: px(zeitstrahlPosition(fahrt.pickupAt)),
              width: Math.max(px(zeitstrahlBreite(fahrt.pickupAt, fahrt.geplantesEnde)), 92),
              opacity: passt ? 1 : 0.25,
              ...stil,
            }}
          >
            <span className="flex items-center gap-1 font-mono text-[11px]">
              {uhrzeit(fahrt.pickupAt)}
              {verspaetet && fahrt.driverDelayMin ? (
                <span className="rounded bg-warn-bg px-1 text-warn-ink">+{fahrt.driverDelayMin}</span>
              ) : null}
            </span>
            <span className="truncate font-semibold">{kurzname(fahrt.passenger.firstName, fahrt.passenger.lastName)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Legende() {
  const artZeile = TRANSPORT_TYPES.map((art) => (
    <span key={art} className="inline-flex items-center gap-1.5">
      <span className="inline-block h-3 w-4 rounded-sm" style={{ background: farbeFuerArt(art, "solid") }} />
      {TRANSPORT_TYPE_LABEL[art]}
    </span>
  ));
  const zustandZeile: { label: string; stil: ReturnType<typeof chipStil> }[] = [
    { label: "erledigt", stil: chipStil("SITZEND", "erledigt") },
    { label: "geplant", stil: chipStil("SITZEND", "geplant") },
    { label: "unterwegs", stil: chipStil("SITZEND", "laeuft") },
    { label: "verspätet", stil: chipStil("SITZEND", "verspaetet") },
    { label: "Vorschlag, unbestätigt", stil: chipStil("SITZEND", "vorschlag") },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-line bg-surface2 px-4 py-3 text-xs text-ink-soft">
      <span className="flex flex-wrap items-center gap-3">
        <strong className="text-ink">Transportart</strong>
        {artZeile}
      </span>
      <span className="flex flex-wrap items-center gap-3">
        <strong className="text-ink">Zustand</strong>
        {zustandZeile.map((z) => (
          <span key={z.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded-sm" style={z.stil} />
            {z.label}
          </span>
        ))}
      </span>
      <span className="ml-auto text-muted">Klick auf eine Fahrt zeigt alle Details.</span>
    </div>
  );
}

export function Zeitstrahl({
  fahrten,
  fahrer,
  fahrzeugZeilen,
  suchbegriff,
  datum,
  ansicht,
  onFahrtKlick,
}: {
  fahrten: FahrtMini[];
  fahrer: FahrerZeile[];
  fahrzeugZeilen: FahrzeugZeile[];
  suchbegriff?: string;
  datum: string;
  ansicht: "tag" | "woche";
  onFahrtKlick: (id: string) => void;
}) {
  const router = useRouter();
  const [jetzt, setJetzt] = useState<Date | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.resolve().then(() => setJetzt(new Date()));
    const intervallId = setInterval(() => setJetzt(new Date()), 30_000);
    return () => clearInterval(intervallId);
  }, []);

  const heuteIso = datumIso(new Date());
  const jetztProzentHeute = jetzt && datum === heuteIso ? zeitstrahlPosition(jetzt) : null;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const zielPx = jetztProzentHeute !== null ? Math.max(0, px(jetztProzentHeute) - el.clientWidth / 3) : 6 * PX_PRO_STUNDE;
    el.scrollLeft = zielPx;
    // Nur beim Wechsel des Tages neu einspringen, nicht bei jedem "jetzt"-Tick (sonst reißt es
    // den Nutzer beim Scrollen alle 30 Sekunden zurück).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datum]);

  const nichtZugewiesen = useMemo(() => fahrten.filter((f) => !f.vehicleId), [fahrten]);
  const suche = (suchbegriff ?? "").trim().toLowerCase();
  const passtZurSuche = useMemo(
    () =>
      suche
        ? (fahrt: FahrtMini) =>
            `${fahrt.passenger.firstName} ${fahrt.passenger.lastName}`.toLowerCase().includes(suche) ||
            (fahrt.vehicle?.plate.toLowerCase().includes(suche) ?? false) ||
            (fahrt.passenger.phones ?? []).some((nummer) => nummer.includes(suche))
        : undefined,
    [suche],
  );

  if (ansicht === "woche") {
    const montag = wochenStart(berlinerMitternacht(datum));
    const tage = wochenTage(montag);

    function fahrtenAmTag(driverId: string | null, tag: Date) {
      const tagIso = datumIso(tag);
      return fahrten.filter((f) => f.driverId === driverId && datumIso(f.pickupAt) === tagIso);
    }
    function schichtAmTag(zeile: FahrerZeile, tag: Date) {
      const tagIso = datumIso(tag);
      const schicht = zeile.schichten.find((s) => datumIso(s.start) === tagIso);
      return schicht ? { start: schicht.start, end: schicht.end } : null;
    }
    function zuTagWechseln(tag: Date) {
      router.push(`/dispo?datum=${datumIso(tag)}&ansicht=tag`);
    }

    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[140px_repeat(7,minmax(0,1fr))] items-center gap-x-2 gap-y-2 rounded-2xl border border-line bg-surface p-4">
          <div />
          {tage.map((tag, index) => (
            <div
              key={index}
              className={`text-center text-xs font-medium ${datumIso(tag) === heuteIso ? "text-now" : "text-muted"}`}
            >
              {WOCHENTAG_KURZ[index]}
            </div>
          ))}

          {nichtZugewiesen.length > 0 ? (
            <>
              <div className="text-sm font-medium text-warn-ink">Braucht Sie</div>
              {tage.map((tag, index) => {
                const tagesFahrten = fahrtenAmTag(null, tag);
                return (
                  <div
                    key={index}
                    className={tagesFahrten.length > 0 ? "cursor-pointer" : ""}
                    onClick={() => tagesFahrten.length > 0 && zuTagWechseln(tag)}
                  >
                    <SpurKompakt schicht={null} fahrten={tagesFahrten} />
                  </div>
                );
              })}
            </>
          ) : null}

          {fahrer.map((zeile) => (
            <Fragment key={zeile.id}>
              <div className="text-sm text-ink">{zeile.name}</div>
              {tage.map((tag, index) => (
                <div key={index} className="cursor-pointer" onClick={() => zuTagWechseln(tag)}>
                  <SpurKompakt schicht={schichtAmTag(zeile, tag)} fahrten={fahrtenAmTag(zeile.id, tag)} />
                </div>
              ))}
            </Fragment>
          ))}
        </div>
        <p className="text-xs text-muted">Tag anklicken, um die Stunden-Ansicht für diesen Tag zu öffnen.</p>
      </div>
    );
  }

  const unterwegsCount = fahrten.filter((f) => f.status === "UNTERWEGS" || f.status === "AN_BORD").length;
  const verspaetetCount = fahrten.filter((f) => !!f.driverDelayMin && f.driverDelayMin > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-2 text-sm">
        <b className="text-ink">
          {fahrzeugZeilen.length} Fahrzeuge · {String(ZEITSTRAHL_START_STUNDE).padStart(2, "0")}–
          {String(ZEITSTRAHL_ENDE_STUNDE).padStart(2, "0")} Uhr
        </b>
        <span className="ml-auto text-ink-soft">
          {fahrten.length} Fahrten · {unterwegsCount} unterwegs · {verspaetetCount} verspätet
        </span>
      </div>
      <div ref={scrollRef} className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <div
          className="grid items-center gap-x-2 gap-y-2 p-4"
          style={{ gridTemplateColumns: `230px ${ZEITSTRAHL_BREITE_PX}px` }}
        >
          <div className="sticky left-0 z-10 bg-surface" />
          <div className="relative h-5 text-xs text-muted" style={{ width: ZEITSTRAHL_BREITE_PX }}>
            {STUNDEN_TICKS.map((stunde) => (
              <span
                key={stunde}
                className="absolute -translate-x-1/2"
                style={{ left: (stunde - ZEITSTRAHL_START_STUNDE) * PX_PRO_STUNDE }}
              >
                {String(stunde).padStart(2, "0")}
              </span>
            ))}
          </div>

          {nichtZugewiesen.length > 0 ? (
            <>
              <div className="sticky left-0 z-10 bg-surface text-sm font-medium text-warn-ink">Braucht Sie</div>
              <SpurTag
                schicht={null}
                fahrten={nichtZugewiesen}
                jetztProzent={jetztProzentHeute}
                passtZurSuche={passtZurSuche}
                onKlick={onFahrtKlick}
              />
            </>
          ) : null}

          {fahrzeugZeilen.map((zeile) => (
            <Fragment key={zeile.id}>
              <div
                className="sticky left-0 z-10 bg-surface"
                title={`${zeile.plate} · ${zeile.typ} · ${zeile.fahrerNamen || "ohne Fahrer"}`}
              >
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink">{zeile.plate}</p>
                  {zeile.fahrerNamen ? (
                    <span className="truncate rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-ink-soft">
                      {zeile.fahrerNamen}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: LIVE_PUNKT_FARBE[zeile.live.punkt] }}
                  />
                  <span
                    className="font-medium"
                    style={{ color: zeile.live.punkt === "late" ? "var(--live-late-text)" : "var(--color-ink)" }}
                  >
                    {zeile.live.label}
                  </span>
                  <span className="truncate text-muted">· {zeile.live.zusatz}</span>
                </p>
              </div>
              <SpurTag
                schicht={null}
                fahrten={fahrten.filter((f) => f.vehicleId === zeile.id)}
                jetztProzent={jetztProzentHeute}
                passtZurSuche={passtZurSuche}
                onKlick={onFahrtKlick}
              />
            </Fragment>
          ))}
        </div>
      </div>

      <Legende />
    </div>
  );
}
