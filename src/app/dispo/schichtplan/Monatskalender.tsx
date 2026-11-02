"use client";

import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { monatsTageIso, tagVerschieben, WOCHENTAG_KURZ, wochentagVonIso } from "@/core/shifts/week";
import { tagLabel } from "@/core/shifts/schichtplan";
import { monatName, type Fahrzeug, type Schicht } from "./anzeige";
import { SCHICHTPLAN_UI as T } from "./texte";

/**
 * Monatskalender mit Füllgrad je Tag (wie viele aktive Fahrzeuge haben eine Schicht). Klick auf
 * einen Tag springt zu dessen Woche. Farbe immer mit Text: Legende darunter und aria-label je Tag.
 */
export function Monatskalender({
  monat,
  montagIso,
  heuteIso,
  fahrzeuge,
  schichten,
  onMonat,
  onTag,
}: {
  monat: string;
  montagIso: string;
  heuteIso: string;
  fahrzeuge: Fahrzeug[];
  schichten: Schicht[];
  onMonat: (versatz: number) => void;
  onTag: (tagIso: string) => void;
}) {
  const tage = monatsTageIso(`${monat}-01`);
  const versatz = wochentagVonIso(tage[0]);
  const sonntag = tagVerschieben(montagIso, 6);
  const besetztAm = (tag: string) =>
    fahrzeuge.filter((f) => schichten.some((s) => s.vehicleId === f.id && s.tagIso === tag && !s.unavailable)).length;

  return (
    <Card className="flex flex-col gap-3">
      <section aria-label={T.monatsuebersicht} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <IconButton aria-label={T.vorherigerMonat} onClick={() => onMonat(-1)}>
            ‹
          </IconButton>
          <h2 className="text-base font-bold text-ink">{monatName(monat)}</h2>
          <IconButton aria-label={T.naechsterMonat} onClick={() => onMonat(1)}>
            ›
          </IconButton>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WOCHENTAG_KURZ.map((kurz) => (
            <span key={kurz} className="pb-0.5 text-center text-xs text-muted" aria-hidden>
              {kurz}
            </span>
          ))}
          {Array.from({ length: versatz }, (_, i) => (
            <span key={`leer-${i}`} aria-hidden />
          ))}
          {tage.map((tag) => {
            const besetzt = besetztAm(tag);
            const stil =
              fahrzeuge.length > 0 && besetzt === fahrzeuge.length
                ? "bg-ok-strong text-surface"
                : besetzt > 0
                  ? "bg-ok-mid text-ok-ink"
                  : "bg-accent-soft text-muted";
            const inWoche = tag >= montagIso && tag <= sonntag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onTag(tag)}
                aria-label={T.tagBesetzt(tagLabel(tag), besetzt, fahrzeuge.length)}
                aria-current={tag === heuteIso ? "date" : undefined}
                className={`relative grid aspect-square place-items-center rounded-[10px] font-mono text-sm font-semibold ${stil} ${
                  inWoche ? "ring-2 ring-accent" : ""
                }`}
              >
                {Number(tag.slice(8, 10))}
                {tag === heuteIso ? <span aria-hidden className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-now" /> : null}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden className="inline-block h-3 w-3 rounded bg-ok-strong" />
            {T.legendeVoll}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden className="inline-block h-3 w-3 rounded bg-ok-mid" />
            {T.legendeTeil}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden className="inline-block h-3 w-3 rounded bg-accent-soft" />
            {T.legendeLeer}
          </span>
        </div>
      </section>
    </Card>
  );
}
