"use client";

import { Card } from "@/components/ui/Card";
import { StatusDot } from "@/components/ui/StatusDot";
import { berlinerMitternacht, tagVerschieben, uhrzeitBerlin } from "@/core/shifts/week";
import { tagLabel } from "@/core/shifts/schichtplan";
import type { Fahrzeug, Person, Schicht } from "./anzeige";
import { SCHICHTPLAN_UI as T } from "./texte";

/**
 * Block „Heute“: je Fahrzeug, wer gerade fährt (oder als Nächstes), mit Beifahrer und Status-Pille
 * (Punkt + Text). Nachtschichten vom Vortag, die noch laufen, zählen mit.
 */
export function HeuteKarte({
  heuteIso,
  jetzt,
  fahrzeuge,
  schichten,
  personal,
}: {
  heuteIso: string;
  jetzt: Date;
  fahrzeuge: Fahrzeug[];
  schichten: Schicht[];
  personal: Person[];
}) {
  const tagStart = berlinerMitternacht(heuteIso);
  const tagEnde = berlinerMitternacht(tagVerschieben(heuteIso, 1));
  const name = (id: string | null) => (id ? (personal.find((p) => p.id === id)?.name ?? "") : "");

  return (
    <Card className="flex flex-col gap-3">
      <section aria-label={T.heute(tagLabel(heuteIso))}>
        <h2 className="mb-3 text-base font-bold text-ink">
          {T.heute(tagLabel(heuteIso))} · <span className="font-mono font-semibold text-now">{uhrzeitBerlin(jetzt)}</span>
        </h2>
        <div className="flex flex-col">
          {fahrzeuge.map((f, index) => {
            const heute = schichten
              .filter((s) => s.vehicleId === f.id && new Date(s.start) < tagEnde && new Date(s.end) > tagStart)
              .sort((a, b) => +new Date(a.start) - +new Date(b.start));
            const laeuft = heute.find((s) => new Date(s.start) <= jetzt && new Date(s.end) > jetzt && !s.unavailable);
            const kommt = heute.find((s) => new Date(s.start) > jetzt && !s.unavailable);
            const ausgefallen = heute.find((s) => s.unavailable && new Date(s.end) > jetzt);
            const zeige = laeuft ?? kommt ?? ausgefallen;
            let status = <StatusDot>{T.nichtImDienst}</StatusDot>;
            if (laeuft) {
              status = laeuft.onBreak ? <StatusDot ton="warn">{T.pause}</StatusDot> : <StatusDot ton="ok">{T.imDienstBis(uhrzeitBerlin(new Date(laeuft.end)))}</StatusDot>;
            } else if (kommt) status = <StatusDot>{T.beginntUm(uhrzeitBerlin(new Date(kommt.start)))}</StatusDot>;
            else if (ausgefallen) status = <StatusDot ton="warn">{T.faelltAus}</StatusDot>;
            else if (heute.length > 0) status = <StatusDot>{T.feierabend}</StatusDot>;
            return (
              <div
                key={f.id}
                className={`grid grid-cols-[90px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[110px_minmax(0,1fr)_auto] ${
                  index > 0 ? "border-t border-line" : ""
                }`}
              >
                <span className="font-mono text-sm font-semibold text-ink">{f.plate}</span>
                <span className="min-w-0 font-semibold text-ink">
                  {zeige ? (
                    <>
                      {name(zeige.driverId)}
                      {zeige.beifahrerId ? <small className="block text-[13px] font-normal text-muted">{T.mit(name(zeige.beifahrerId))}</small> : null}
                    </>
                  ) : (
                    <span className="font-normal text-muted">{T.keinFahrer}</span>
                  )}
                </span>
                <span className="col-start-2 sm:col-start-auto">{status}</span>
              </div>
            );
          })}
        </div>
      </section>
    </Card>
  );
}
