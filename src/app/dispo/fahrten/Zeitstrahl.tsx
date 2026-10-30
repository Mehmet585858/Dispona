"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { fahrtVerschieben } from "./actions";
import { chipStil, farbeFuerArt, type Fahrtzustand } from "@/core/rides/transportfarbe";
import { TRANSPORT_TYPE_LABEL, TRANSPORT_TYPES } from "@/core/rides/validation";
import type { FahrzeugLiveStatus } from "@/core/shifts/liveStatus";
import {
  berlinerMitternacht,
  datumIso,
  minutenSeitMitternacht,
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

// Die Wochenansicht hat kein Scrollen und bleibt deshalb bei einer schmaleren, festen Achse
// (06–22 Uhr) statt der vollen 24 Std. des scrollbaren Tages-Zeitstrahls weiter unten – sonst
// würde die reale Betriebszeit nur einen Bruchteil jeder Tagesspalte füllen.
const WOCHE_START_STUNDE = 6;
const WOCHE_ENDE_STUNDE = 22;
function wochePosition(datum: Date): number {
  const minuten = minutenSeitMitternacht(datum) - WOCHE_START_STUNDE * 60;
  return Math.min(100, Math.max(0, (minuten / ((WOCHE_ENDE_STUNDE - WOCHE_START_STUNDE) * 60)) * 100));
}

export const LIVE_PUNKT_FARBE: Record<FahrzeugLiveStatus["punkt"], string> = {
  go: "var(--live-go)",
  in: "var(--live-in)",
  at: "var(--live-at)",
  free: "var(--live-free)",
  late: "var(--live-late)",
};

export const STUNDEN_TICKS = Array.from({ length: ZEITSTRAHL_ENDE_STUNDE - ZEITSTRAHL_START_STUNDE + 1 }, (_, i) => ZEITSTRAHL_START_STUNDE + i);
/** Breite einer Stunde im Tages-Zeitstrahl in Pixeln – fest statt prozentual, damit der Zeitstrahl
 * horizontal scrollbar ist (volle 24 Std. sichtbar, aber nie gequetschte Chips). */
export const PX_PRO_STUNDE = 130;
export const ZEITSTRAHL_BREITE_PX = (ZEITSTRAHL_ENDE_STUNDE - ZEITSTRAHL_START_STUNDE) * PX_PRO_STUNDE;
export function px(prozent: number): number {
  return (prozent / 100) * ZEITSTRAHL_BREITE_PX;
}
/** Pixel-Position im Zeitstrahl zurück in eine Abholzeit (HH:MM, auf 5 Minuten gerundet, an den
 * Rand des sichtbaren Tages geklemmt) – fürs Verschieben einer Fahrt per Ziehen. */
function pxZuAbholzeit(xPx: number): string {
  const geklemmt = Math.max(0, Math.min(ZEITSTRAHL_BREITE_PX, xPx));
  const gesamtMinuten = ZEITSTRAHL_START_STUNDE * 60 + (geklemmt / PX_PRO_STUNDE) * 60;
  const gerundet = Math.round(gesamtMinuten / 5) * 5;
  const stunde = Math.floor(gerundet / 60) % 24;
  const minute = gerundet % 60;
  return `${String(stunde).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
const NICHT_VERSCHIEBBAR = new Set(["UNTERWEGS", "AN_BORD", "ERLEDIGT", "STORNIERT", "NICHT_ANGETROFFEN"]);

export function uhrzeit(datum: Date): string {
  return new Date(datum).toLocaleTimeString("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function istAlarmFahrt(fahrt: { status: string; problems: string[] }): boolean {
  return fahrt.problems.length > 0 || fahrt.status === "PROBLEM" || fahrt.status === "NICHT_ANGETROFFEN";
}

/** Farbe = Transportart, Füllung = Zustand (docs/DISPO-SPEZ.md Abschnitt 4.1/4.2). */
export function zustandFuerFahrt(fahrt: { status: string; driverDelayMin: number | null }): Fahrtzustand {
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
  /** Fahrzeug des besten (noch unbestätigten) Vorschlags - nur gesetzt, wenn status VORGESCHLAGEN
   * und noch kein vehicleId vergeben ist. Lässt die Fahrt trotzdem schon auf der richtigen
   * Fahrzeugzeile erscheinen (gestrichelt, siehe chipStil "vorschlag"), statt bis zur Bestätigung
   * komplett unsichtbar zu bleiben. */
  vorschlagVehicleId: string | null;
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
            left: `${wochePosition(schicht.start)}%`,
            width: `${Math.max(0, wochePosition(schicht.end) - wochePosition(schicht.start))}%`,
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
            style={{ left: `${wochePosition(fahrt.pickupAt)}%`, ...stil }}
          />
        );
      })}
    </div>
  );
}

/** Zeile im Tages-Zeitstrahl: Chips sind so breit wie die geschätzte Fahrtdauer, mit Zeit und
 * Kurzname (DISPO-SPEZ.md Abschnitt 3.3) – kein Text zur Transportart, die steckt in der Farbe. */
/** Eine Fahrt-Kachel: Klick öffnet die Details, Ziehen verschiebt die Fahrt (andere Uhrzeit
 * und/oder – auf eine andere Fahrzeug-Zeile gezogen – ein anderes Fahrzeug). Ein kurzer Klick
 * ohne nennenswerte Bewegung zählt als Klick, nicht als Ziehen. */
function FahrtChip({
  fahrt,
  passt,
  fahrzeugId,
  onKlick,
  onVerschieben,
}: {
  fahrt: FahrtMini;
  passt: boolean;
  fahrzeugId: string;
  onKlick?: (id: string) => void;
  onVerschieben: (
    fahrtId: string,
    neueAbholzeit: string | undefined,
    neuesFahrzeugId: string | undefined,
  ) => Promise<boolean>;
}) {
  const [verschiebungPx, setVerschiebungPx] = useState<{ dx: number; dy: number } | null>(null);
  const [zielZeit, setZielZeit] = useState<string | null>(null);
  const stil = chipStil(fahrt.transportType, zustandFuerFahrt(fahrt));
  const verspaetet = zustandFuerFahrt(fahrt) === "verspaetet";
  const verschiebbar = !NICHT_VERSCHIEBBAR.has(fahrt.status);
  const originalLeft = px(zeitstrahlPosition(fahrt.pickupAt));

  // Solange eine gerade bestätigte Verschiebung auf die frischen Server-Daten wartet (siehe
  // unten), bleibt die Kachel optisch an ihrer Zielposition stehen – sonst würde sie beim
  // Loslassen erst kurz auf die alte Position zurückspringen (fahrt.pickupAt ist ja noch alt)
  // und dann, sobald router.refresh() ankommt, auf die neue springen. Ein unschönes Doppel-Springen.
  const letzterStandRef = useRef({ pickupAt: fahrt.pickupAt.getTime(), fahrzeugId });
  useEffect(() => {
    const neu = { pickupAt: fahrt.pickupAt.getTime(), fahrzeugId };
    if (neu.pickupAt !== letzterStandRef.current.pickupAt || neu.fahrzeugId !== letzterStandRef.current.fahrzeugId) {
      // Frische Daten sind da (die Uhrzeit auf dieser Zeile hat sich wirklich geändert) –
      // jetzt erst die optimistische Verschiebung beenden, die reale Position stimmt nun.
      setVerschiebungPx(null);
    }
    letzterStandRef.current = neu;
  }, [fahrt.pickupAt, fahrzeugId]);

  function aufPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!verschiebbar || event.button !== 0) return;
    const el = event.currentTarget;
    // Die gezogene Kachel wird per CSS-transform sichtbar unter den Mauszeiger verschoben, liegt
    // aber im DOM weiter in ihrer alten Zeile. elementFromPoint würde sie dort selbst treffen statt
    // der Zielzeile darunter – deshalb während der Zielermittlung kurz "durchklickbar" machen.
    const wrapper = el.parentElement as HTMLElement | null;
    const startX = event.clientX;
    const startY = event.clientY;
    let gezogen = false;
    let zielZeile: HTMLElement | null = null;
    el.setPointerCapture(event.pointerId);

    function zielZeileUnterZeiger(x: number, y: number): HTMLElement | null {
      if (wrapper) wrapper.style.pointerEvents = "none";
      const element = document.elementFromPoint(x, y);
      if (wrapper) wrapper.style.pointerEvents = "";
      return element?.closest<HTMLElement>("[data-fahrzeug-id]") ?? null;
    }
    function zielZeileSetzen(neu: HTMLElement | null) {
      if (zielZeile === neu) return;
      zielZeile?.classList.remove("ring-2", "ring-accent", "bg-accent-soft/40");
      neu?.classList.add("ring-2", "ring-accent", "bg-accent-soft/40");
      zielZeile = neu;
    }

    function aufMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!gezogen && Math.hypot(dx, dy) > 6) gezogen = true;
      if (!gezogen) return;
      setVerschiebungPx({ dx, dy });
      setZielZeit(pxZuAbholzeit(originalLeft + dx));
      zielZeileSetzen(zielZeileUnterZeiger(ev.clientX, ev.clientY));
    }
    function aufUp(ev: PointerEvent) {
      el.removeEventListener("pointermove", aufMove);
      el.removeEventListener("pointerup", aufUp);
      const zielZeileAmEnde = zielZeile;
      zielZeileSetzen(null);
      setZielZeit(null);
      if (!gezogen) {
        setVerschiebungPx(null);
        onKlick?.(fahrt.id);
        return;
      }
      const neueAbholzeitRoh = pxZuAbholzeit(originalLeft + (ev.clientX - startX));
      const neueAbholzeit = neueAbholzeitRoh !== uhrzeit(fahrt.pickupAt) ? neueAbholzeitRoh : undefined;
      const zielFahrzeugId = zielZeileAmEnde?.dataset.fahrzeugId;
      const fahrzeugGewechselt = !!zielFahrzeugId && zielFahrzeugId !== fahrzeugId;
      // Eine Zeitänderung setzt eine schon disponierte Fahrt immer zurück auf "Erfasst" (siehe
      // fahrtAendern) – deshalb muss hier auch beim Verschieben *innerhalb* derselben Zeile das
      // Fahrzeug erneut zugewiesen werden, sonst würde die Fahrt sonst "ohne Fahrzeug" enden.
      const neuesFahrzeugId = neueAbholzeit ? (zielFahrzeugId ?? fahrzeugId) : fahrzeugGewechselt ? zielFahrzeugId : undefined;
      if (neueAbholzeit || neuesFahrzeugId) {
        // verschiebungPx bleibt absichtlich gesetzt (siehe useEffect oben) – kein sofortiges
        // Zurücksetzen hier, sonst springt die Kachel kurz auf die alte Position zurück.
        onVerschieben(fahrt.id, neueAbholzeit, neuesFahrzeugId).then((erfolgreich) => {
          if (!erfolgreich) setVerschiebungPx(null); // fehlgeschlagen: sofort zur alten Position zurück
        });
      } else {
        setVerschiebungPx(null);
      }
    }
    el.addEventListener("pointermove", aufMove);
    el.addEventListener("pointerup", aufUp);
  }

  return (
    <div
      className={`absolute top-1.5 bottom-1.5 ${verschiebungPx ? "z-20" : ""}`}
      style={{
        left: originalLeft,
        width: Math.max(px(zeitstrahlBreite(fahrt.pickupAt, fahrt.geplantesEnde)), 92),
        transform: verschiebungPx ? `translate(${verschiebungPx.dx}px, ${verschiebungPx.dy}px)` : undefined,
      }}
    >
      {zielZeit ? (
        <span className="absolute -top-6 left-0 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 font-mono text-[11px] text-white shadow">
          {zielZeit}
        </span>
      ) : null}
      <button
        type="button"
        onPointerDown={aufPointerDown}
        // Für nicht verschiebbare Fahrten (unterwegs, an Bord, erledigt, storniert, nicht
        // angetroffen) bricht aufPointerDown sofort ab, bevor die pointermove/pointerup-Listener
        // hängen, die sonst einen Klick erkennen - ohne dieses onClick würde ein Klick auf eine
        // dieser Fahrten (die Mehrheit im Tagesbetrieb) einfach nichts tun.
        onClick={!verschiebbar ? () => onKlick?.(fahrt.id) : undefined}
        title={`${uhrzeit(fahrt.pickupAt)}–${uhrzeit(fahrt.geplantesEnde)} ${fahrt.passenger.firstName} ${
          fahrt.passenger.lastName
        } · ${TRANSPORT_TYPE_LABEL[fahrt.transportType]}${verschiebbar ? " · ziehen zum Verschieben" : ""}`}
        className={`flex h-full w-full flex-col justify-center overflow-hidden rounded-lg px-2 text-left text-xs leading-tight touch-none ${
          istAlarmFahrt(fahrt) ? "ring-2 ring-danger-ink" : ""
        } ${verschiebbar ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${verschiebungPx ? "shadow-lg" : ""}`}
        style={{
          opacity: verschiebungPx ? 0.9 : passt ? 1 : 0.25,
          ...stil,
        }}
      >
        <span className="flex items-center gap-1 font-mono text-[11px]">
          {uhrzeit(fahrt.pickupAt)}
          {verspaetet && fahrt.driverDelayMin ? (
            <span className="rounded bg-warn-bg px-1 text-warn-ink">+{fahrt.driverDelayMin}</span>
          ) : null}
        </span>
        <span className="truncate font-semibold">
          {fahrt.passenger.firstName} {fahrt.passenger.lastName}
        </span>
      </button>
    </div>
  );
}

function SpurTag({
  schicht,
  fahrten,
  jetztProzent,
  fahrzeugId,
  passtZurSuche,
  onKlick,
  onVerschieben,
}: {
  schicht: { start: Date; end: Date } | null;
  fahrten: FahrtMini[];
  jetztProzent: number | null;
  fahrzeugId: string;
  passtZurSuche?: (fahrt: FahrtMini) => boolean;
  onKlick?: (id: string) => void;
  onVerschieben: (
    fahrtId: string,
    neueAbholzeit: string | undefined,
    neuesFahrzeugId: string | undefined,
  ) => Promise<boolean>;
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
      {fahrten.map((fahrt) => (
        <FahrtChip
          key={fahrt.id}
          fahrt={fahrt}
          passt={passtZurSuche ? passtZurSuche(fahrt) : true}
          fahrzeugId={fahrzeugId}
          onKlick={onKlick}
          onVerschieben={onVerschieben}
        />
      ))}
    </div>
  );
}

export function Legende() {
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
  const letztesAutoScrollDatum = useRef<string | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      // Wochenansicht: der Tages-Zeitstrahl ist nicht im DOM. Beim nächsten Wechsel zurück zu
      // "Tag" soll wieder frisch zu "jetzt" gesprungen werden (sonst bleibt die neue, frisch
      // gemountete Scroll-Leiste bei 00:00 stehen, weil dieser Tag schon als "erledigt" galt).
      letztesAutoScrollDatum.current = null;
      return;
    }
    if (letztesAutoScrollDatum.current === datum) return; // für diesen Tag schon eingesprungen
    // Bei "heute" erst scrollen, sobald die aktuelle Uhrzeit bekannt ist (sonst springt die
    // Ansicht kurz auf den 06-Uhr-Standardwert, bevor sie auf "jetzt" nachkorrigiert).
    if (datum === heuteIso && jetzt === null) return;
    const zielPx = jetztProzentHeute !== null ? Math.max(0, px(jetztProzentHeute) - el.clientWidth / 3) : 6 * PX_PRO_STUNDE;
    el.scrollLeft = zielPx;
    letztesAutoScrollDatum.current = datum;
  }, [datum, jetzt, jetztProzentHeute, heuteIso, ansicht]);

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

  async function aufFahrtVerschieben(
    fahrtId: string,
    neueAbholzeit: string | undefined,
    neuesFahrzeugId: string | undefined,
  ): Promise<boolean> {
    const ergebnis = await fahrtVerschieben(fahrtId, { neueAbholzeit, neuesFahrzeugId });
    router.refresh();
    if (!ergebnis.ok) {
      window.alert(ergebnis.grund);
      return false;
    }
    return true;
  }

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
        {/* Jede Zeile ein eigener Flex-Container über die volle Inhaltsbreite (nicht CSS-Grid):
         * nur so bleibt die Fahrzeug-Spalte beim horizontalen Scrollen "sticky" stehen – in einem
         * Grid wäre ihre eigene Spalte zu schmal, um außerhalb davon noch kleben zu können. */}
        <div className="flex flex-col gap-y-2 p-4" style={{ width: 230 + ZEITSTRAHL_BREITE_PX }}>
          <div className="flex items-center gap-x-2">
            <div className="sticky left-0 z-10 w-[230px] flex-none bg-surface shadow-[2px_0_6px_-2px_rgba(16,24,32,0.12)]" />
            <div className="relative h-5 flex-none text-xs text-muted" style={{ width: ZEITSTRAHL_BREITE_PX }}>
              {STUNDEN_TICKS.map((stunde) => (
                <span
                  key={stunde}
                  className="absolute -translate-x-1/2"
                  style={{ left: (stunde - ZEITSTRAHL_START_STUNDE) * PX_PRO_STUNDE }}
                >
                  {String(stunde).padStart(2, "0")}:00
                </span>
              ))}
            </div>
          </div>

          {fahrzeugZeilen.map((zeile) => (
            <div key={zeile.id} data-fahrzeug-id={zeile.id} className="flex items-center gap-x-2">
              <div
                className="sticky left-0 z-10 w-[230px] flex-none bg-surface shadow-[2px_0_6px_-2px_rgba(16,24,32,0.12)]"
                title={`${zeile.plate} · ${zeile.typ} · ${zeile.fahrerNamen || "ohne Fahrer"}`}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-semibold text-ink">{zeile.plate}</p>
                  <span className="rounded bg-ground px-1.5 py-0.5 text-xs font-medium text-muted">{zeile.typ}</span>
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
                fahrten={fahrten.filter(
                  (f) => f.vehicleId === zeile.id || (!f.vehicleId && f.vorschlagVehicleId === zeile.id),
                )}
                jetztProzent={jetztProzentHeute}
                fahrzeugId={zeile.id}
                passtZurSuche={passtZurSuche}
                onKlick={onFahrtKlick}
                onVerschieben={aufFahrtVerschieben}
              />
            </div>
          ))}
        </div>
      </div>

      <Legende />
    </div>
  );
}
