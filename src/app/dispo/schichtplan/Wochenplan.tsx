"use client";

import { Fragment } from "react";
import { fahrzeugTypKurz } from "@/core/vehicles/validation";
import { tagKurzIso, tagVerschieben, WOCHENTAG_LABEL, wochentagVonIso } from "@/core/shifts/week";
import { tagLabel, type PlanPerson } from "@/core/shifts/schichtplan";
import type { BesatzungsEtikett } from "@/core/shifts/besatzung";
import { etikettenFuer, schichtenAm, zeitText, type Fahrzeug, type Schicht } from "./anzeige";
import { SCHICHTPLAN_UI as T } from "./texte";

const ETIKETT_FARBE: Record<BesatzungsEtikett["ton"], string> = {
  ok: "text-ok-ink",
  warn: "text-warn-ink",
  neutral: "text-muted",
};

/** Besatzungs-Etikett: Punkt + Text (Farbe nie allein). */
export function Etikett({ etikett }: { etikett: BesatzungsEtikett }) {
  return (
    <span className={`mt-1 inline-flex items-center gap-1.5 text-xs font-semibold ${ETIKETT_FARBE[etikett.ton]}`}>
      <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full bg-current" />
      {etikett.text}
    </span>
  );
}

/**
 * Wochenansicht: Fahrzeuge als Zeilen, Montag bis Sonntag als Spalten, volle Namen (keine Kürzel),
 * leere Felder „+ Schicht planen“, Besatzungs-Etiketten. Jede Zelle ist ein Knopf und öffnet das
 * Seitenfenster; vergangene Tage sind nur zum Ansehen. Breite Tabelle scrollt in ihrem Kasten.
 */
export function Wochenplan({
  montagIso,
  heuteIso,
  fahrzeuge,
  schichten,
  personen,
  onZelle,
}: {
  montagIso: string;
  heuteIso: string;
  fahrzeuge: Fahrzeug[];
  schichten: Schicht[];
  personen: Map<string, PlanPerson>;
  onZelle: (vehicleId: string, tagIso: string) => void;
}) {
  const tage = Array.from({ length: 7 }, (_, i) => tagVerschieben(montagIso, i));
  const name = (id: string | null) => (id ? (personen.get(id)?.name ?? "") : "");

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <div className="grid min-w-[1290px] grid-cols-[170px_repeat(7,minmax(0,1fr))]">
        <div className="border-b border-line bg-surface2" />
        {tage.map((tag) => {
          const wochenende = wochentagVonIso(tag) >= 5;
          const istHeute = tag === heuteIso;
          return (
            <div
              key={tag}
              className={`border-b border-line px-2.5 py-3 text-[13px] ${
                istHeute ? "bg-accent text-accent-soft" : wochenende ? "bg-weekend text-muted" : "bg-surface2 text-muted"
              }`}
            >
              {istHeute ? T.heuteSpalte : WOCHENTAG_LABEL[wochentagVonIso(tag)]}
              <b className={`block text-[15px] ${istHeute ? "text-surface" : "text-ink"}`}>{tagKurzIso(tag)}</b>
            </div>
          );
        })}
        {fahrzeuge.map((f) => (
          <Fragment key={f.id}>
            <div className="sticky left-0 z-[1] flex flex-col justify-center gap-0.5 border-b border-r border-line bg-surface px-3 py-3.5">
              <span className="font-mono text-[15px] font-semibold text-ink">{f.plate}</span>
              <span className="text-[13px] text-muted">{fahrzeugTypKurz(f)}</span>
            </div>
            {tage.map((tag) => {
              const am = schichtenAm(schichten, f.id, tag);
              const vergangen = tag < heuteIso;
              const wochenende = wochentagVonIso(tag) >= 5;
              const inhalt = am.length
                ? am
                    .map((s) => {
                      const z = zeitText(s);
                      return `${z.von} bis ${z.bis} ${name(s.driverId)}${s.beifahrerId ? ` ${T.mit(name(s.beifahrerId))}` : ""}`;
                    })
                    .join(", ")
                : T.nichtsGeplant;
              const label = T.zelleLabel(f.plate, tagLabel(tag), inhalt);
              const chips = am.map((s) => {
                const z = zeitText(s);
                const etiketten = etikettenFuer(f, s, personen);
                const warn = s.unavailable || etiketten.some((e) => e.ton === "warn");
                return (
                  <span
                    key={s.id}
                    className={`flex flex-col gap-0.5 rounded-[10px] border px-2.5 py-2 ${
                      warn ? "border-warn-bd bg-warn-bg" : "border-ok-bd bg-ok-bg"
                    }`}
                  >
                    <span className={`font-mono text-[13px] font-semibold ${warn ? "text-warn-ink" : "text-ok-ink"}`}>
                      {z.von} – {z.bis}
                      {z.folgetag ? " +1" : ""}
                    </span>
                    <span className="text-sm font-semibold text-ink">{name(s.driverId)}</span>
                    {s.beifahrerId ? <span className="text-[13px] text-ink-soft">{T.mit(name(s.beifahrerId))}</span> : null}
                    {s.scalamobil ? <span className="text-[13px] text-ink-soft">{T.scalamobilAnBord}</span> : null}
                    {s.unavailable ? <span className="text-xs font-semibold text-warn-ink">{T.faelltAus}</span> : null}
                    {etiketten.map((e) => (
                      <Etikett key={e.text} etikett={e} />
                    ))}
                  </span>
                );
              });
              const zellenStil = `flex min-h-24 flex-col gap-1.5 border-b border-r border-line p-2 text-left ${
                tag === heuteIso ? "bg-surface2" : wochenende ? "bg-weekend" : "bg-surface"
              }`;
              if (vergangen) {
                return (
                  <div key={tag} className={`${zellenStil} opacity-70`} aria-label={`${label} (${T.vergangen})`} role="group">
                    {chips}
                  </div>
                );
              }
              return (
                <button key={tag} type="button" className={`${zellenStil} group`} aria-label={label} onClick={() => onZelle(f.id, tag)}>
                  {chips.length > 0 ? (
                    chips
                  ) : (
                    <span className="grid min-h-[78px] flex-1 place-items-center rounded-[10px] border-[1.5px] border-dashed border-line text-sm font-medium text-muted group-hover:border-accent group-hover:text-accent">
                      {T.schichtPlanen}
                    </span>
                  )}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
