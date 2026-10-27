"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@/components/ui/Chip";
import { VorschlagAktion, type VorschlagOption } from "@/components/VorschlagAktion";
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

const STATUS_TON: Record<string, "neutral" | "warn" | "info" | "danger" | "accent"> = {
  ENTWURF: "neutral",
  ERFASST: "warn",
  VORGESCHLAGEN: "warn",
  DISPONIERT: "info",
  UNTERWEGS: "info",
  AN_BORD: "info",
  ERLEDIGT: "accent",
  NICHT_ANGETROFFEN: "danger",
  STORNIERT: "neutral",
  PROBLEM: "danger",
};
const STATUS_LABEL: Record<string, string> = {
  ENTWURF: "Entwurf",
  ERFASST: "Erfasst",
  VORGESCHLAGEN: "Vorgeschlagen",
  DISPONIERT: "Disponiert",
  UNTERWEGS: "Fährt zum Fahrgast",
  AN_BORD: "Fahrgast im Auto",
  ERLEDIGT: "Fahrgast am Ziel",
  NICHT_ANGETROFFEN: "Nicht angetroffen",
  STORNIERT: "Storniert",
  PROBLEM: "Problem",
};

const STUNDEN_TICKS = [6, 8, 10, 12, 14, 16, 18, 20, 22];

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

export type FahrtMini = {
  id: string;
  pickupAt: Date;
  status: string;
  problems: string[];
  passenger: { firstName: string; lastName: string };
  pickupPlace: { label: string };
  dropoffPlace: { label: string };
  vehicle: { plate: string } | null;
  driverId: string | null;
  suggestions?: { options: unknown }[];
};

export type FahrerZeile = {
  id: string;
  name: string;
  schichten: { start: Date; end: Date; plate: string }[];
};

function Spur({
  schicht,
  fahrten,
  jetztProzent,
  kompakt,
  ausgewaehlteId,
  onKlick,
}: {
  schicht: { start: Date; end: Date } | null;
  fahrten: FahrtMini[];
  jetztProzent: number | null;
  kompakt: boolean;
  ausgewaehlteId: string | null;
  onKlick?: (id: string) => void;
}) {
  return (
    <div className={`relative rounded-md bg-ground ${kompakt ? "h-5" : "h-11"}`}>
      {schicht ? (
        <div
          className="absolute inset-y-0.5 rounded-sm bg-accent-soft"
          style={{
            left: `${zeitstrahlPosition(schicht.start)}%`,
            width: `${zeitstrahlBreite(schicht.start, schicht.end)}%`,
          }}
        />
      ) : null}
      {jetztProzent !== null ? (
        <div className="absolute inset-y-0 w-px bg-danger-ink" style={{ left: `${jetztProzent}%` }} />
      ) : null}
      {fahrten.map((fahrt) => (
        <button
          key={fahrt.id}
          type="button"
          onClick={() => onKlick?.(fahrt.id)}
          title={`${uhrzeit(fahrt.pickupAt)} ${fahrt.passenger.firstName} ${fahrt.passenger.lastName}`}
          className={`absolute rounded-sm ${kompakt ? "top-0.5 bottom-0.5 w-1.5" : "top-1 bottom-1 w-9"} ${
            istAlarmFahrt(fahrt) ? "bg-danger-ink" : "bg-accent"
          } ${ausgewaehlteId === fahrt.id ? "ring-2 ring-ink" : ""}`}
          style={{ left: `${zeitstrahlPosition(fahrt.pickupAt)}%` }}
        />
      ))}
    </div>
  );
}

export function Zeitstrahl({
  fahrten,
  fahrer,
  fahrzeuge,
  datum,
  ansicht,
}: {
  fahrten: FahrtMini[];
  fahrer: FahrerZeile[];
  fahrzeuge: { id: string; plate: string }[];
  datum: string;
  ansicht: "tag" | "woche";
}) {
  const router = useRouter();
  const [ausgewaehlteId, setAusgewaehlteId] = useState<string | null>(null);
  const [jetzt, setJetzt] = useState<Date | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => setJetzt(new Date()));
    const intervallId = setInterval(() => setJetzt(new Date()), 30_000);
    return () => clearInterval(intervallId);
  }, []);

  const heuteIso = datumIso(new Date());
  const nichtZugewiesen = useMemo(() => fahrten.filter((f) => !f.driverId), [fahrten]);
  const ausgewaehlteFahrt = fahrten.find((f) => f.id === ausgewaehlteId) ?? null;

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
      router.push(`/dispo/fahrten?datum=${datumIso(tag)}&ansicht=tag`);
    }

    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[140px_repeat(7,minmax(0,1fr))] items-center gap-x-2 gap-y-2 rounded-2xl border border-line bg-surface p-4">
          <div />
          {tage.map((tag, index) => (
            <div
              key={index}
              className={`text-center text-xs font-medium ${datumIso(tag) === heuteIso ? "text-danger-ink" : "text-muted"}`}
            >
              {WOCHENTAG_KURZ[index]}
            </div>
          ))}

          {nichtZugewiesen.length > 0 ? (
            <>
              <div className="text-sm font-medium text-danger-ink">Nicht zugewiesen</div>
              {tage.map((tag, index) => {
                const tagesFahrten = fahrtenAmTag(null, tag);
                return (
                  <div
                    key={index}
                    className={tagesFahrten.length > 0 ? "cursor-pointer" : ""}
                    onClick={() => tagesFahrten.length > 0 && zuTagWechseln(tag)}
                  >
                    <Spur schicht={null} fahrten={tagesFahrten} jetztProzent={null} kompakt ausgewaehlteId={null} />
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
                  <Spur
                    schicht={schichtAmTag(zeile, tag)}
                    fahrten={fahrtenAmTag(zeile.id, tag)}
                    jetztProzent={null}
                    kompakt
                    ausgewaehlteId={null}
                  />
                </div>
              ))}
            </Fragment>
          ))}
        </div>
        <p className="text-xs text-muted">Tag anklicken, um die Stunden-Ansicht für diesen Tag zu öffnen.</p>
      </div>
    );
  }

  const jetztProzentHeute = jetzt && datum === heuteIso ? zeitstrahlPosition(jetzt) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-x-2 gap-y-2 rounded-2xl border border-line bg-surface p-4">
        <div />
        <div className="relative h-5 text-xs text-muted">
          {STUNDEN_TICKS.map((stunde) => (
            <span
              key={stunde}
              className="absolute -translate-x-1/2"
              style={{
                left: `${((stunde - ZEITSTRAHL_START_STUNDE) / (ZEITSTRAHL_ENDE_STUNDE - ZEITSTRAHL_START_STUNDE)) * 100}%`,
              }}
            >
              {String(stunde).padStart(2, "0")}
            </span>
          ))}
        </div>

        {nichtZugewiesen.length > 0 ? (
          <>
            <div className="text-sm font-medium text-danger-ink">Nicht zugewiesen</div>
            <Spur
              schicht={null}
              fahrten={nichtZugewiesen}
              jetztProzent={jetztProzentHeute}
              kompakt={false}
              ausgewaehlteId={ausgewaehlteId}
              onKlick={setAusgewaehlteId}
            />
          </>
        ) : null}

        {fahrer.map((zeile) => (
          <Fragment key={zeile.id}>
            <div>
              <p className="text-sm text-ink">{zeile.name}</p>
              {zeile.schichten[0] ? (
                <p className="text-xs text-muted">{zeile.schichten[0].plate}</p>
              ) : (
                <p className="text-xs text-muted">Keine Schicht</p>
              )}
            </div>
            <Spur
              schicht={zeile.schichten[0] ? { start: zeile.schichten[0].start, end: zeile.schichten[0].end } : null}
              fahrten={fahrten.filter((f) => f.driverId === zeile.id)}
              jetztProzent={jetztProzentHeute}
              kompakt={false}
              ausgewaehlteId={ausgewaehlteId}
              onKlick={setAusgewaehlteId}
            />
          </Fragment>
        ))}
      </div>

      {ausgewaehlteFahrt ? (
        <div className="rounded-2xl border border-line-strong bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-ink">
                {uhrzeit(ausgewaehlteFahrt.pickupAt)} · {ausgewaehlteFahrt.passenger.firstName}{" "}
                {ausgewaehlteFahrt.passenger.lastName}
              </p>
              <p className="text-sm text-ink-soft">
                {ausgewaehlteFahrt.pickupPlace.label} → {ausgewaehlteFahrt.dropoffPlace.label}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Chip ton={STATUS_TON[ausgewaehlteFahrt.status] ?? "neutral"}>
                  {STATUS_LABEL[ausgewaehlteFahrt.status] ?? ausgewaehlteFahrt.status}
                </Chip>
                {ausgewaehlteFahrt.problems.length > 0 ? (
                  <Chip ton="danger">{ausgewaehlteFahrt.problems.join(", ")}</Chip>
                ) : null}
              </div>
            </div>
            {!ausgewaehlteFahrt.vehicle &&
            (ausgewaehlteFahrt.status === "ERFASST" || ausgewaehlteFahrt.status === "VORGESCHLAGEN") ? (
              <VorschlagAktion
                rideId={ausgewaehlteFahrt.id}
                beste={
                  (ausgewaehlteFahrt.suggestions?.[0]?.options as VorschlagOption[] | undefined)?.[0] ?? null
                }
                fahrzeuge={fahrzeuge}
                onErledigt={() => {
                  router.refresh();
                  setAusgewaehlteId(null);
                }}
              />
            ) : (
              <span className="whitespace-nowrap text-sm text-muted">{ausgewaehlteFahrt.vehicle?.plate ?? "—"}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAusgewaehlteId(null)}
            className="mt-3 text-xs text-muted underline"
          >
            Schließen
          </button>
        </div>
      ) : null}
    </div>
  );
}
