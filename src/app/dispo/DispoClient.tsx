"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { KpiTile } from "@/components/ui/KpiTile";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { Tile } from "@/components/ui/Tile";
import { TransportBadge } from "@/components/ui/TransportBadge";
import { VorschlagAktion, type VorschlagOption } from "@/components/VorschlagAktion";
import {
  DOC_STATUS,
  DOC_STATUS_LABEL,
  TRANSPORT_TYPE_LABEL,
  TRANSPORT_TYPES,
  type FahrtEingabe,
} from "@/core/rides/validation";
import { WOCHENTAGE, WOCHENTAG_LABEL, type Wochentag } from "@/core/shifts/rrule";
import { berlinerMitternacht, datumIso, montagVerschieben, tagVerschieben, wochenStart } from "@/core/shifts/week";
import { anrufTranskriptLaden } from "./anrufe/actions";
import { FahrgastAuswahl } from "./fahrten/FahrgastAuswahl";
import { OrtAuswahl } from "./fahrten/OrtAuswahl";
import { TripModal } from "./fahrten/TripModal";
import { fahrtAnlegen, fahrzeugWaehlen, serieAnlegen, zuweisungRueckgaengig } from "./fahrten/actions";
import { Zeitstrahl, type FahrerZeile, type FahrtMini, type FahrzeugZeile } from "./fahrten/Zeitstrahl";

const AKTUALISIERUNG_MS = 10_000;

const Karte = dynamic(() => import("@/components/Karte").then((m) => m.Karte), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 w-full items-center justify-center rounded-2xl bg-ground text-sm text-muted">
      Karte lädt …
    </div>
  ),
});

type Fahrt = FahrtMini & { fahrerName: string | null };
type Ort = { id: string; label: string; street: string; city: string };
type Fahrzeug = { id: string; plate: string };
type KartenDaten = {
  fahrzeuge: { id: string; plate: string; position: { lat: number; lng: number } | null }[];
  serviceArea: { center: { lat: number; lng: number }; radiusKm: number; depot: { lat: number; lng: number } | null };
};
type BrauchtSieEintrag = { rideId: string; grund: string; beste: VorschlagOption | null };
export type LiveAnruf = {
  id: string;
  startedAt: Date;
  fromNumber: string | null;
  fahrt: {
    id: string;
    pickupAt: Date;
    transportType: (typeof TRANSPORT_TYPES)[number];
    passenger: { firstName: string; lastName: string };
    pickupPlace: { label: string };
    dropoffPlace: { label: string };
    vehicle: { plate: string } | null;
    /** Bester Fahrzeug-Vorschlag für diese Fahrt, falls schon berechnet (sonst null, z. B. direkt
     * nach Gesprächsbeginn, bevor alle Felder erkannt sind). Grundlage für "Auto zuweisen". */
    beste: VorschlagOption | null;
  } | null;
  bekannterFahrgast: { name: string; anzahlFahrten: number } | null;
};

const LEER: FahrtEingabe = {
  passengerId: "",
  pickupPlaceId: "",
  dropoffPlaceId: "",
  datum: datumIso(new Date()),
  abholzeit: "09:00",
  terminzeit: "",
  rueckfahrt: false,
  rueckfahrtzeit: "",
  transportType: "SITZEND",
  companion: false,
  assistanceNotes: "",
  prescription: "UNKLAR",
  approval: "NICHT_NOETIG",
};

function uhrzeit(datum: Date): string {
  return new Date(datum).toLocaleTimeString("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** MM:SS statt gerundeter Minuten - tickt sekündlich selbst (siehe AnrufKarte), unabhängig vom
 * 5-10s-Nachladeintervall der Seite, damit die Dauer wirklich live wirkt. */
function dauerText(seit: Date, jetzt: Date): string {
  const sekunden = Math.max(0, Math.floor((jetzt.getTime() - new Date(seit).getTime()) / 1000));
  const minuten = Math.floor(sekunden / 60);
  return `${String(minuten).padStart(2, "0")}:${String(sekunden % 60).padStart(2, "0")}`;
}

function BrauchtSieKarte({
  eintraege,
  fahrten,
  fahrzeuge,
  onOeffnen,
}: {
  eintraege: BrauchtSieEintrag[];
  fahrten: Fahrt[];
  fahrzeuge: Fahrzeug[];
  onOeffnen: (id: string) => void;
}) {
  const router = useRouter();
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">Hinweis</h2>
        {eintraege.length > 0 ? <Chip ton="warn">{eintraege.length}</Chip> : null}
      </div>
      <p className="text-sm text-muted">Dispona plant alles automatisch. Hier landet nur, was es nicht allein lösen kann.</p>
      {eintraege.length === 0 ? (
        <p className="text-sm text-muted">Gerade nichts offen.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {eintraege.map((eintrag) => {
            const fahrt = fahrten.find((f) => f.id === eintrag.rideId);
            if (!fahrt) return null;
            return (
              <div key={eintrag.rideId} className="flex flex-wrap items-center gap-2 rounded-xl border border-warn-bd bg-surface p-2.5">
                <span className="font-mono text-xs text-muted">{uhrzeit(fahrt.pickupAt)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <TransportBadge art={fahrt.transportType} />
                    <span className="font-medium text-ink">
                      {fahrt.passenger.firstName} {fahrt.passenger.lastName}
                    </span>
                  </div>
                  <p className="truncate text-xs text-warn-ink">{eintrag.grund}</p>
                </div>
                {!fahrt.vehicle ? (
                  <VorschlagAktion
                    rideId={eintrag.rideId}
                    beste={eintrag.beste}
                    fahrzeuge={fahrzeuge}
                    onErledigt={() => router.refresh()}
                  />
                ) : (
                  <Button type="button" variant="secondary" onClick={() => onOeffnen(eintrag.rideId)}>
                    Ansehen
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/** Zerlegt ein "Sprecher: Text"-je-Zeile-Transkript in einzelne Redebeiträge (docs/DISPO-SPEZ.md
 * 3.4: "Gesprächsverlauf als Sprechblasen: Anrufer links, KI rechts"). Zeilen, die dem Muster
 * nicht entsprechen, werden als eigener Redebeitrag ohne Sprecher durchgereicht statt verworfen -
 * so bleibt ein unerwartetes Transkript-Format trotzdem vollständig lesbar, nur ohne Blasen-Optik. */
function transkriptRedebeitraege(text: string): { sprecher: string | null; text: string; istKi: boolean }[] {
  return text
    .split("\n")
    .map((zeile) => zeile.trim())
    .filter((zeile) => zeile.length > 0)
    .map((zeile) => {
      const treffer = zeile.match(/^([\p{L}][\p{L}\s.-]{0,39}):\s*(.*)$/u);
      if (!treffer) return { sprecher: null, text: zeile, istKi: false };
      const [, sprecher, rest] = treffer;
      return { sprecher, text: rest, istKi: sprecher.trim().toLowerCase() === "lisa" };
    });
}

const AUTO_ZUWEISEN_SEKUNDEN = 15;
/** Wie lange die Erfolgszeile mit "Rückgängig" stehen bleibt, bevor die Karte auf den echten,
 * neu geladenen Datenstand wechselt (docs/DISPO-SPEZ.md 3.4: "30 Sek. oder bis zur nächsten
 * Aktion" - hier kürzer, weil die Karte ohnehin alle paar Sekunden neu lädt). */
const ERFOLG_SICHTBAR_MS = 8_000;

/** "Auto zuweisen" (Primär, mit Countdown-Leiste - läuft die Zeit ab, wird automatisch zugewiesen,
 * genau wie ein Automodus-Vorschlag) und "Selbst übernehmen" (Sekundär: Disponent plant manuell,
 * docs/DISPO-SPEZ.md 3.4/7.2) direkt an der laufenden Anruf-Karte, statt dass der Disponent dafür
 * erst über "Braucht Sie" umwegen muss. */
function AnrufZuweisungsAktion({
  rideId,
  beste,
  onAktualisiert,
}: {
  rideId: string;
  beste: VorschlagOption;
  onAktualisiert: () => void;
}) {
  const [phase, setPhase] = useState<"laeuft" | "zuweisend" | "erfolgreich" | "manuell" | "fehler">("laeuft");
  const [balkenVoll, setBalkenVoll] = useState(true);
  const [fehlerText, setFehlerText] = useState<string | null>(null);

  const jetztZuweisen = useCallback(async () => {
    setPhase("zuweisend");
    const ergebnis = await fahrzeugWaehlen(rideId, beste.vehicleId);
    if (!ergebnis.ok) {
      setFehlerText(ergebnis.grund);
      setPhase("fehler");
      return;
    }
    setPhase("erfolgreich");
  }, [rideId, beste.vehicleId]);

  // Countdown: eine Frame nach dem Einhängen auf 0 Breite animieren (CSS-Transition greift nur bei
  // einer echten Zustandsänderung nach dem ersten Render), parallel dazu nach Ablauf automatisch
  // zuweisen, sofern nicht vorher geklickt wurde.
  useEffect(() => {
    if (phase !== "laeuft") return;
    const rafId = requestAnimationFrame(() => setBalkenVoll(false));
    const timeoutId = setTimeout(jetztZuweisen, AUTO_ZUWEISEN_SEKUNDEN * 1000);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [phase, jetztZuweisen]);

  useEffect(() => {
    if (phase !== "erfolgreich") return;
    const timeoutId = setTimeout(onAktualisiert, ERFOLG_SICHTBAR_MS);
    return () => clearTimeout(timeoutId);
  }, [phase, onAktualisiert]);

  async function rueckgaengig() {
    await zuweisungRueckgaengig(rideId);
    onAktualisiert();
  }

  if (phase === "manuell") {
    return <p className="text-xs text-muted">Wird manuell geplant.</p>;
  }
  if (phase === "erfolgreich") {
    return (
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-accent">✓ An {beste.plate} zugewiesen · Fahrer benachrichtigt</span>
        <button type="button" onClick={rueckgaengig} className="flex-none font-medium text-ink-soft underline hover:text-accent">
          Rückgängig
        </button>
      </div>
    );
  }
  if (phase === "fehler") {
    return <p className="text-xs text-warn-ink">{fehlerText}</p>;
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={jetztZuweisen}
        disabled={phase === "zuweisend"}
        className="relative flex-1 overflow-hidden rounded-[10px] bg-accent px-3 py-2 text-left text-xs font-semibold text-surface disabled:opacity-70"
      >
        {/* Rechts voll (am rechten Rand verankert), links wird über 15s leer - "noch so viel Zeit
         * bis zur automatischen Zuweisung". */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 right-0 bg-white/20 transition-[width] duration-[15000ms] ease-linear"
          style={{ width: balkenVoll ? "100%" : "0%" }}
        />
        <span className="relative">{phase === "zuweisend" ? "…" : `Auto zuweisen · ${beste.plate}`}</span>
      </button>
      <Button type="button" variant="secondary" onClick={() => setPhase("manuell")} disabled={phase === "zuweisend"}>
        Selbst übernehmen
      </Button>
    </div>
  );
}

export function AnrufKarte({
  anruf,
  index,
  gesamt,
  onFahrtKlick,
  onVorheriger,
  onNaechster,
  transkriptLaden = anrufTranskriptLaden,
  aktionenErlaubt = true,
}: {
  anruf: LiveAnruf;
  index: number;
  gesamt: number;
  onFahrtKlick: (id: string) => void;
  /** Nur gesetzt (und nur dann als Pfeile sichtbar), wenn mehrere Anrufe gleichzeitig laufen - der
   * Aufrufer (AnrufKarussell) regelt die Umschaltung, diese Karte zeigt nur die Pfeile an. */
  onVorheriger?: () => void;
  onNaechster?: () => void;
  /** Standardmäßig die Dispo-interne, angemeldete Variante (Audit-Log, braucht Sitzung) - die
   * öffentliche Live-Demo (/live) übergibt stattdessen eine eigene, offene Variante ohne Login
   * (src/app/live/actions.ts), die zusätzlich fest auf den Demo-Mandanten beschränkt ist. */
  transkriptLaden?: (callId: string) => Promise<string | null>;
  /** false auf der öffentlichen Live-Demo (/live): "Auto zuweisen"/"Selbst übernehmen" brauchen
   * eine echte Sitzung und würden dort nur fehlschlagen. */
  aktionenErlaubt?: boolean;
}) {
  const router = useRouter();
  const [transkript, setTranskript] = useState<string | null | undefined>(undefined);
  const [jetzt, setJetzt] = useState(() => new Date());
  const aktualisieren = useCallback(() => router.refresh(), [router]);

  // Tickt sekündlich für sich selbst, unabhängig vom 5-10s-Nachladeintervall der Seite - die
  // Gesprächsdauer soll wirklich live wirken, nicht nur alle paar Sekunden springen.
  useEffect(() => {
    const intervallId = setInterval(() => setJetzt(new Date()), 1000);
    return () => clearInterval(intervallId);
  }, []);

  useEffect(() => {
    let abgebrochen = false;
    transkriptLaden(anruf.id)
      .then((text) => {
        if (!abgebrochen) setTranskript(text);
      })
      .catch(() => {
        if (!abgebrochen) setTranskript(null);
      });
    return () => {
      abgebrochen = true;
    };
  }, [anruf.id, transkriptLaden]);

  return (
    // Feste Höhe (nicht nur min-h) plus feste Innenaufteilung (Kopf/Transkript/Details je ein
    // eigener Bereich mit eigener Höhe) - die Karte springt dadurch nie, egal wie lang Transkript
    // oder Details gerade sind, auch beim Wechsel zwischen mehreren Anrufen (AnrufKarussell).
    <Card className="flex h-[28rem] flex-col gap-2 border-line-strong">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        <b className="text-ink">Anruf läuft</b>
        <span className="ml-auto font-mono text-sm text-muted">{dauerText(anruf.startedAt, jetzt)}</span>
      </div>
      {gesamt > 1 ? (
        <div className="flex items-center justify-between rounded-lg bg-ground px-1 py-1">
          <button
            type="button"
            onClick={onVorheriger}
            aria-label="Vorheriger Anruf"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-line text-ink-soft hover:bg-accent-soft hover:text-accent"
          >
            ‹
          </button>
          <span className="text-xs font-medium text-muted">
            Anruf {index + 1} von {gesamt}
          </span>
          <button
            type="button"
            onClick={onNaechster}
            aria-label="Nächster Anruf"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-line text-ink-soft hover:bg-accent-soft hover:text-accent"
          >
            ›
          </button>
        </div>
      ) : null}
      {anruf.fromNumber ? <p className="text-sm text-muted">{anruf.fromNumber}</p> : null}

      <div className="min-h-0 flex-1">
        <p className="mb-1 text-xs font-medium text-muted">Transkript</p>
        <div className="h-[calc(100%-1.25rem)] overflow-y-auto rounded-xl bg-surface2 p-3">
          {transkript === undefined ? (
            <p className="text-sm text-muted">Lädt …</p>
          ) : transkript ? (
            <div className="flex flex-col gap-1.5">
              {transkriptRedebeitraege(transkript).map((beitrag, i) =>
                beitrag.sprecher ? (
                  <div key={i} className={`flex flex-col ${beitrag.istKi ? "items-end" : "items-start"}`}>
                    <span className="mb-0.5 px-1 text-[11px] font-medium text-muted">{beitrag.sprecher}</span>
                    <p
                      className={`max-w-[85%] rounded-xl px-3 py-1.5 text-sm ${
                        beitrag.istKi ? "bg-accent-soft text-ink" : "bg-surface border border-line text-ink-soft"
                      }`}
                    >
                      {beitrag.text}
                    </p>
                  </div>
                ) : (
                  <p key={i} className="whitespace-pre-wrap text-sm text-ink-soft">
                    {beitrag.text}
                  </p>
                ),
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">
              Noch kein Transkript verfügbar – erscheint hier, sobald Dispona Gesprächsabschnitte erkannt hat.
            </p>
          )}
        </div>
      </div>

      <div className="min-h-[8.5rem] flex-none border-t border-line pt-2.5">
        {anruf.fahrt ? (
          <div className="flex h-full flex-col gap-2">
            <button
              type="button"
              onClick={() => onFahrtKlick(anruf.fahrt!.id)}
              className="grid flex-1 grid-cols-2 gap-2 text-left text-sm hover:bg-accent-soft"
            >
              <div>
                <p className="text-xs text-muted">Fahrgast</p>
                <p className="truncate text-ink">
                  {anruf.fahrt.passenger.firstName} {anruf.fahrt.passenger.lastName}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Transport</p>
                <p className="text-ink">{TRANSPORT_TYPE_LABEL[anruf.fahrt.transportType]}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Abholung</p>
                <p className="truncate text-ink">{anruf.fahrt.pickupPlace.label}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Ziel</p>
                <p className="truncate text-ink">{anruf.fahrt.dropoffPlace.label}</p>
              </div>
            </button>
            {aktionenErlaubt && !anruf.fahrt.vehicle && anruf.fahrt.beste ? (
              <AnrufZuweisungsAktion
                key={anruf.fahrt.id}
                rideId={anruf.fahrt.id}
                beste={anruf.fahrt.beste}
                onAktualisiert={aktualisieren}
              />
            ) : anruf.fahrt.vehicle ? (
              <p className="truncate text-xs text-muted">
                Eingeplant bei <span className="font-medium text-ink">{anruf.fahrt.vehicle.plate}</span>
              </p>
            ) : (
              <button type="button" onClick={() => onFahrtKlick(anruf.fahrt!.id)} className="text-left text-xs text-accent">
                Details öffnen →
              </button>
            )}
          </div>
        ) : anruf.bekannterFahrgast ? (
          <div className="text-sm">
            <p className="text-xs text-muted">Nummer bekannt von</p>
            <p className="text-ink">
              {anruf.bekannterFahrgast.name}
              <span className="text-muted">
                {" "}
                · {anruf.bekannterFahrgast.anzahlFahrten}{" "}
                {anruf.bekannterFahrgast.anzahlFahrten === 1 ? "Fahrt bisher" : "Fahrten bisher"}
              </span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">Details erscheinen hier, sobald Dispona sie aus dem Gespräch erkannt hat.</p>
        )}
      </div>
    </Card>
  );
}

/** Platzhalter, solange kein Anruf läuft – an derselben Stelle wie AnrufKarte, damit das
 * Anruf-Feld nie ganz verschwindet, sondern nur seinen Zustand wechselt. */
export function AnrufWarteKarte({ anrufeHeute }: { anrufeHeute: number }) {
  return (
    <Card className="flex flex-col gap-2 border-line">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <b className="text-ink">Anrufe</b>
      </div>
      <p className="text-sm text-muted">
        Gerade kein Anruf aktiv. Sobald jemand anruft, erscheinen hier Transkript und erkannte Details live.
      </p>
      {anrufeHeute > 0 ? (
        <p className="text-xs text-muted">
          {anrufeHeute} {anrufeHeute === 1 ? "Anruf" : "Anrufe"} heute
        </p>
      ) : null}
    </Card>
  );
}

/** Zeigt mehrere gleichzeitig laufende Anrufe als ein Karussell (Pfeile, "x von y" schon in
 * AnrufKarte eingebaut) statt mehrerer untereinander gestapelter Karten - bei vielen Anrufen
 * gleichzeitig wäre ein langer Stapel unübersichtlich, und nur ein Anruf braucht gerade die volle
 * Aufmerksamkeit. Reine Anzeige-Umschaltung, der Zustand selbst kommt unverändert von oben. */
export function AnrufKarussell({
  liveAnrufe,
  onFahrtKlick,
  transkriptLaden,
  aktionenErlaubt = true,
}: {
  liveAnrufe: LiveAnruf[];
  onFahrtKlick: (id: string) => void;
  transkriptLaden?: (callId: string) => Promise<string | null>;
  /** false auf der öffentlichen Live-Demo (/live): "Auto zuweisen"/"Selbst übernehmen" brauchen
   * eine echte Sitzung und würden dort nur fehlschlagen. */
  aktionenErlaubt?: boolean;
}) {
  const [index, setIndex] = useState(0);
  // Rein aus dem aktuellen Render abgeleitet statt per Effekt zurückgesetzt: schrumpft die Liste
  // (ein Anruf endet), zeigt der nächste Klick wieder einen gültigen Index, ganz ohne
  // State-Update im Effekt.
  const sichererIndex = liveAnrufe.length === 0 ? 0 : Math.min(index, liveAnrufe.length - 1);

  if (liveAnrufe.length === 0) return null;
  const anruf = liveAnrufe[sichererIndex];

  return (
    <AnrufKarte
      key={anruf.id}
      anruf={anruf}
      index={sichererIndex}
      gesamt={liveAnrufe.length}
      onFahrtKlick={onFahrtKlick}
      transkriptLaden={transkriptLaden}
      aktionenErlaubt={aktionenErlaubt}
      onVorheriger={
        liveAnrufe.length > 1 ? () => setIndex((sichererIndex - 1 + liveAnrufe.length) % liveAnrufe.length) : undefined
      }
      onNaechster={liveAnrufe.length > 1 ? () => setIndex((sichererIndex + 1) % liveAnrufe.length) : undefined}
    />
  );
}

export function DispoClient({
  paket,
  kennzahlen,
  brauchtSie,
  liveAnrufe,
  fahrten,
  fahrer,
  fahrzeugZeilen,
  karte,
  orte,
  fahrzeuge,
  datum,
  ansicht,
}: {
  paket: "LITE" | "PRO";
  kennzahlen: { fahrtenHeute: number; unterwegs: number; vonDisponaEingeplant: number; brauchtSie: number; anrufeHeute: number };
  brauchtSie: BrauchtSieEintrag[];
  liveAnrufe: LiveAnruf[];
  fahrten: Fahrt[];
  fahrer: FahrerZeile[];
  fahrzeugZeilen: FahrzeugZeile[];
  karte: KartenDaten | null;
  orte: Ort[];
  fahrzeuge: Fahrzeug[];
  datum: string;
  ansicht: "tag" | "woche";
}) {
  const router = useRouter();
  const [suche, setSuche] = useState("");
  const [neueFahrtOffen, setNeueFahrtOffen] = useState(false);
  const [offeneFahrtId, setOffeneFahrtId] = useState<string | null>(null);
  const [fahrgast, setFahrgast] = useState<{ id: string; name: string } | null>(null);
  const [eingabe, setEingabe] = useState<FahrtEingabe>(LEER);
  const [serieModus, setSerieModus] = useState(false);
  const [serieWochentage, setSerieWochentage] = useState<Wochentag[]>([]);
  const [serieBis, setSerieBis] = useState("");
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState<string | null>(null);

  useEffect(() => {
    const intervallId = setInterval(() => router.refresh(), AKTUALISIERUNG_MS);
    return () => clearInterval(intervallId);
  }, [router]);

  function wechselDatum(neuesDatum: string) {
    router.push(`/dispo?datum=${neuesDatum}`);
  }
  function tagWechseln(richtung: -1 | 1) {
    wechselDatum(tagVerschieben(datum, richtung));
  }
  function ansichtWechseln(neueAnsicht: "tag" | "woche") {
    router.push(`/dispo?datum=${datum}&ansicht=${neueAnsicht}`);
  }
  function wocheWechseln(richtung: -1 | 1) {
    const montag = datumIso(wochenStart(berlinerMitternacht(datum)));
    router.push(`/dispo?datum=${montagVerschieben(montag, richtung)}&ansicht=woche`);
  }

  const wochenStartIso = datumIso(wochenStart(berlinerMitternacht(datum)));
  const wochenEndeIso = (() => {
    const ende = new Date(berlinerMitternacht(wochenStartIso));
    ende.setDate(ende.getDate() + 6);
    return datumIso(ende);
  })();

  function formularSchliessen() {
    setNeueFahrtOffen(false);
    setEingabe(LEER);
    setFahrgast(null);
    setSerieModus(false);
    setSerieWochentage([]);
    setSerieBis("");
    setFehler(null);
  }

  async function speichern() {
    if (!fahrgast) {
      setFehler("Bitte zuerst einen Fahrgast wählen.");
      return;
    }
    if (serieModus && (serieWochentage.length === 0 || !serieBis)) {
      setFehler("Bitte Wochentage und ein Enddatum der Serie angeben.");
      return;
    }
    setSpeichert(true);
    setFehler(null);
    setErfolg(null);
    try {
      if (serieModus) {
        const ergebnis = await serieAnlegen({
          passengerId: fahrgast.id,
          pickupPlaceId: eingabe.pickupPlaceId,
          dropoffPlaceId: eingabe.dropoffPlaceId,
          wochentage: serieWochentage,
          abholzeit: eingabe.abholzeit,
          terminzeit: eingabe.terminzeit,
          rueckfahrt: eingabe.rueckfahrt,
          rueckfahrtzeit: eingabe.rueckfahrtzeit,
          bis: serieBis,
          transportType: eingabe.transportType,
          companion: eingabe.companion,
          assistanceNotes: eingabe.assistanceNotes,
          prescription: eingabe.prescription,
          approval: eingabe.approval,
        });
        const hinweise = [`Serie angelegt, ${ergebnis.erzeugteFahrten.length} Fahrten erzeugt.`];
        if (ergebnis.feiertagsHinweise.length > 0) {
          hinweise.push(
            `Feiertage im Zeitraum: ${ergebnis.feiertagsHinweise.map((f) => `${f.datum} (${f.name})`).join(", ")}.`,
          );
        }
        if (ergebnis.genehmigungsWarnung) hinweise.push(ergebnis.genehmigungsWarnung);
        setErfolg(hinweise.join(" "));
      } else {
        const { probleme } = await fahrtAnlegen({ ...eingabe, passengerId: fahrgast.id });
        setErfolg(probleme.length > 0 ? `Fahrt angelegt, aber mit Hinweis: ${probleme.join(", ")}` : "Fahrt angelegt.");
      }
      formularSchliessen();
      router.refresh();
    } catch {
      setFehler("Konnte nicht gespeichert werden. Bitte Angaben prüfen.");
    } finally {
      setSpeichert(false);
    }
  }

  const offeneFahrt = fahrten.find((f) => f.id === offeneFahrtId) ?? null;
  const offenerGrund = offeneFahrtId ? brauchtSie.find((b) => b.rideId === offeneFahrtId)?.grund : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3">
        <div className="flex gap-1.5 rounded-xl border border-line-strong p-1">
          <button
            type="button"
            onClick={() => ansichtWechseln("tag")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${ansicht === "tag" ? "bg-accent text-surface" : "text-ink-soft"}`}
          >
            Tag
          </button>
          <button
            type="button"
            onClick={() => ansichtWechseln("woche")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${ansicht === "woche" ? "bg-accent text-surface" : "text-ink-soft"}`}
          >
            Woche
          </button>
        </div>

        {ansicht === "tag" ? (
          <div className="flex items-center gap-1 rounded-xl bg-ground p-1">
            <button type="button" onClick={() => tagWechseln(-1)} aria-label="Vorheriger Tag" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-surface">
              ‹
            </button>
            <span className="px-2 text-sm font-semibold text-ink">
              {berlinerMitternacht(datum).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}
            </span>
            <button type="button" onClick={() => tagWechseln(1)} aria-label="Nächster Tag" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-surface">
              ›
            </button>
            {datum !== datumIso(new Date()) ? (
              <button type="button" onClick={() => wechselDatum(datumIso(new Date()))} className="ml-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-accent hover:bg-surface">
                Heute
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => wocheWechseln(-1)}>
              ‹ Vorherige Woche
            </Button>
            <span className="whitespace-nowrap text-sm font-medium text-ink">
              {berlinerMitternacht(wochenStartIso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
              {" – "}
              {berlinerMitternacht(wochenEndeIso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
            <Button type="button" variant="secondary" onClick={() => wocheWechseln(1)}>
              Nächste Woche ›
            </Button>
          </div>
        )}

        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-line px-3 py-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="text-muted">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={suche}
            onChange={(event) => setSuche(event.target.value)}
            placeholder="Patient, Fahrzeug oder Telefonnummer suchen …"
            aria-label="Suche"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
        </label>

        {liveAnrufe.length > 0 ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-2 text-sm font-semibold text-accent">
            <span className="h-2 w-2 rounded-full bg-accent" />
            Dispona · {liveAnrufe.length} {liveAnrufe.length === 1 ? "Anruf läuft" : "Anrufe laufen"}
          </span>
        ) : null}

        {paket === "PRO" ? (
          <a href="/dispo/auswertung" className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-line-strong bg-surface px-5 text-base font-semibold text-ink hover:bg-accent-soft">
            Fahrtenbuch
          </a>
        ) : null}
        <Button type="button" onClick={() => setNeueFahrtOffen(true)}>
          + Neue Fahrt
        </Button>
      </div>

      {erfolg ? <p className="text-sm text-accent">{erfolg}</p> : null}

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-1 basis-[640px] flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <KpiTile
              label="Fahrten heute"
              wert={kennzahlen.fahrtenHeute}
              zusatz={`· ${fahrten.filter((f) => f.status === "ERLEDIGT").length} erledigt`}
            />
            {paket === "PRO" ? <KpiTile label="Gerade unterwegs" wert={kennzahlen.unterwegs} /> : null}
            {paket === "PRO" ? <KpiTile label="Von Dispona eingeplant" wert={kennzahlen.vonDisponaEingeplant} zusatz="heute" /> : null}
            <KpiTile label="Braucht Sie" wert={kennzahlen.brauchtSie} warnstil={kennzahlen.brauchtSie > 0} />
            {/* Bei zwei Spalten (LITE: 3, PRO: 5 Kacheln - beides ungerade) hängt die letzte
             * Kachel sonst allein in einer eigenen Reihe - siehe derselbe Fix auf /live. */}
            <div className="col-span-2 sm:col-span-1">
              <KpiTile label="Anrufe heute" wert={kennzahlen.anrufeHeute} />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
            {fahrten.length === 0 && (ansicht === "tag" ? fahrzeugZeilen.length === 0 : fahrer.length === 0) ? (
              <div>
                <p className="text-sm text-muted">{ansicht === "woche" ? "Keine Fahrten in dieser Woche." : "Keine Fahrten an diesem Tag."}</p>
                <Link href="/dispo/fahrer" className="mt-2 inline-block text-sm text-accent hover:underline">
                  Schichten verwalten, Fahrer einladen →
                </Link>
              </div>
            ) : (
              <Zeitstrahl
                fahrten={fahrten}
                fahrer={fahrer}
                fahrzeugZeilen={fahrzeugZeilen}
                suchbegriff={suche}
                datum={datum}
                ansicht={ansicht}
                onFahrtKlick={setOffeneFahrtId}
              />
            )}
          </div>
        </div>

        <div className="flex w-full flex-none flex-col gap-4 md:w-[380px]">
          {paket === "PRO" ? (
            <>
              {/* docs/DESIGN-GUIDE.md Abschnitt 9 (Pflicht): "Live-Änderungen (neuer Anruf, ...)
               * per aria-live="polite" ansagen." - meldet einen neu eingehenden oder beendeten
               * Anruf auch Screenreader-Nutzern, ohne bei jedem 5s-Poll-Tick selbst neu zu melden
               * (aria-atomic="false": nur was sich wirklich ändert). */}
              <div aria-live="polite" aria-atomic="false">
                {liveAnrufe.length > 0 ? (
                  <AnrufKarussell liveAnrufe={liveAnrufe} onFahrtKlick={setOffeneFahrtId} />
                ) : (
                  <AnrufWarteKarte anrufeHeute={kennzahlen.anrufeHeute} />
                )}
              </div>
              <BrauchtSieKarte eintraege={brauchtSie} fahrten={fahrten} fahrzeuge={fahrzeuge} onOeffnen={setOffeneFahrtId} />
            </>
          ) : (
            <Card>
              <p className="text-sm text-muted">
                Mit Dispona Lite erfasst Dispona Fahrtanfragen, plant sie aber nicht selbst ein. Die Übersicht dafür
                folgt – bis dahin sehen Sie neue Fahrten hier im Zeitstrahl ohne Fahrzeug.
              </p>
            </Card>
          )}
        </div>
      </div>

      {karte ? (
        <div className="flex flex-col gap-1">
          <Karte
            zentrum={karte.serviceArea.center}
            radiusKm={karte.serviceArea.radiusKm}
            depot={karte.serviceArea.depot}
            fahrzeuge={karte.fahrzeuge}
          />
          <p className="text-xs text-muted">Live-Standort aus der Fahrer-App, aktualisiert alle 10 Sekunden.</p>
        </div>
      ) : null}

      {neueFahrtOffen ? (
        <Modal titel={serieModus ? "Neue Serienfahrt" : "Neue Fahrt"} onClose={formularSchliessen} breit>
          <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto p-5">
            <h2 className="text-lg font-semibold text-ink">{serieModus ? "Neue Serienfahrt" : "Neue Fahrt"}</h2>
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={serieModus}
                onChange={(event) => setSerieModus(event.target.checked)}
                className="h-5 w-5 rounded border-line-strong"
              />
              Serie (wiederkehrend, z. B. Dialyse)
            </label>

            <FahrgastAuswahl wert={fahrgast} onChange={setFahrgast} />

            <div className="grid gap-4 sm:grid-cols-2">
              <OrtAuswahl
                titel="Abholadresse"
                orte={orte}
                wert={eingabe.pickupPlaceId}
                onChange={(id) => setEingabe({ ...eingabe, pickupPlaceId: id })}
              />
              <OrtAuswahl
                titel="Zieladresse"
                orte={orte}
                wert={eingabe.dropoffPlaceId}
                onChange={(id) => setEingabe({ ...eingabe, dropoffPlaceId: id })}
              />
            </div>

            {serieModus ? (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="mb-1.5 text-sm font-medium text-ink">Wochentage</p>
                  <div className="flex flex-wrap gap-2">
                    {WOCHENTAGE.map((tag) => (
                      <Tile
                        key={tag}
                        label={WOCHENTAG_LABEL[tag]}
                        active={serieWochentage.includes(tag)}
                        onClick={() =>
                          setSerieWochentage((bisher) =>
                            bisher.includes(tag) ? bisher.filter((t) => t !== tag) : [...bisher, tag],
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField
                    label="Abholzeit"
                    type="time"
                    value={eingabe.abholzeit}
                    onChange={(event) => setEingabe({ ...eingabe, abholzeit: event.target.value })}
                  />
                  <TextField
                    label="Termin am Ziel (optional)"
                    type="time"
                    value={eingabe.terminzeit}
                    onChange={(event) => setEingabe({ ...eingabe, terminzeit: event.target.value })}
                  />
                  <TextField label="Serie bis" type="date" value={serieBis} onChange={(event) => setSerieBis(event.target.value)} />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  label="Datum"
                  type="date"
                  value={eingabe.datum}
                  onChange={(event) => setEingabe({ ...eingabe, datum: event.target.value })}
                />
                <TextField
                  label="Abholzeit"
                  type="time"
                  value={eingabe.abholzeit}
                  onChange={(event) => setEingabe({ ...eingabe, abholzeit: event.target.value })}
                />
                <TextField
                  label="Termin am Ziel (optional)"
                  type="time"
                  value={eingabe.terminzeit}
                  onChange={(event) => setEingabe({ ...eingabe, terminzeit: event.target.value })}
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  checked={eingabe.rueckfahrt}
                  onChange={(event) => setEingabe({ ...eingabe, rueckfahrt: event.target.checked })}
                  className="h-5 w-5 rounded border-line-strong"
                />
                Rückfahrt nötig
              </label>
              {eingabe.rueckfahrt ? (
                <TextField
                  label="Rückfahrtzeit"
                  type="time"
                  value={eingabe.rueckfahrtzeit}
                  onChange={(event) => setEingabe({ ...eingabe, rueckfahrtzeit: event.target.value })}
                />
              ) : null}
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Beförderungsart</p>
              <div className="flex flex-wrap gap-2">
                {TRANSPORT_TYPES.map((typ) => (
                  <Tile
                    key={typ}
                    label={TRANSPORT_TYPE_LABEL[typ]}
                    active={eingabe.transportType === typ}
                    onClick={() => setEingabe({ ...eingabe, transportType: typ })}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">Transportschein vorhanden?</p>
                <div className="flex flex-wrap gap-2">
                  {DOC_STATUS.map((status) => (
                    <Tile
                      key={status}
                      label={DOC_STATUS_LABEL[status]}
                      active={eingabe.prescription === status}
                      onClick={() => setEingabe({ ...eingabe, prescription: status })}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">Genehmigung der Kasse?</p>
                <div className="flex flex-wrap gap-2">
                  {DOC_STATUS.map((status) => (
                    <Tile
                      key={status}
                      label={DOC_STATUS_LABEL[status]}
                      active={eingabe.approval === status}
                      onClick={() => setEingabe({ ...eingabe, approval: status })}
                    />
                  ))}
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={eingabe.companion}
                onChange={(event) => setEingabe({ ...eingabe, companion: event.target.checked })}
                className="h-5 w-5 rounded border-line-strong"
              />
              Begleitperson
            </label>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">Besonderheiten</label>
              <textarea
                value={eingabe.assistanceNotes}
                onChange={(event) => setEingabe({ ...eingabe, assistanceNotes: event.target.value })}
                rows={2}
                placeholder="z. B. Hilfe bis zur Wohnung, 3. OG ohne Aufzug"
                className="rounded-xl border border-line-strong bg-surface p-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </div>

            {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : null}

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={speichern}
                disabled={
                  speichert ||
                  !fahrgast ||
                  !eingabe.pickupPlaceId ||
                  !eingabe.dropoffPlaceId ||
                  (serieModus && (serieWochentage.length === 0 || !serieBis))
                }
              >
                {speichert ? "Speichert …" : serieModus ? "Serie anlegen" : "Fahrt anlegen"}
              </Button>
              <Button type="button" variant="secondary" onClick={formularSchliessen}>
                Abbrechen
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {offeneFahrt ? (
        <TripModal fahrt={offeneFahrt} grund={offenerGrund} fahrzeuge={fahrzeuge} onClose={() => setOffeneFahrtId(null)} />
      ) : null}
    </div>
  );
}
