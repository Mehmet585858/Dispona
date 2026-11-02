import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { InfoTag } from "@/components/ui/InfoTag";
import type { MeineSchicht } from "@/core/shifts/meinSchichtplan";
import { FAHRER_APP_TEXTE as T } from "./texte";

/**
 * „Mein Schichtplan“: eigene Schichten der nächsten 4 Wochen (als Fahrer oder Beifahrer), nur lesen.
 * Je Schicht: Datum, Zeit, Fahrzeug, Kollegin/Kollege, Scalamobil. Keine Fahrgastdaten.
 */
export function MeinSchichtplan({ schichten }: { schichten: MeineSchicht[] }) {
  return (
    <section aria-labelledby="mein-schichtplan">
      <h2 id="mein-schichtplan" className="text-base font-semibold text-ink">
        {T.meinSchichtplan}
      </h2>
      <p className="mb-2 text-sm text-muted">{T.naechsteWochen}</p>
      {schichten.length === 0 ? (
        <Card className="text-sm text-ink-soft">{T.keineSchichten}</Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {schichten.map((s) => (
            <li key={s.id}>
              <Card className="flex flex-col gap-1 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-semibold text-ink">{s.tag}</span>
                  <InfoTag>{s.rolle === "FAHRER" ? T.alsFahrer : T.alsBeifahrer}</InfoTag>
                </div>
                <p className="font-mono text-base font-semibold tabular-nums text-ink">
                  {s.von} – {s.bis}
                  {s.folgetag ? <span className="ml-1 font-sans text-sm font-normal text-muted">({T.folgetag})</span> : null}
                </p>
                <p className="text-base text-ink">
                  <span className="font-mono font-semibold">{s.plate}</span> · {s.kollege ? T.mit(s.kollege) : T.allein}
                </p>
                {s.scalamobil || s.faelltAus ? (
                  <div className="flex flex-wrap gap-2">
                    {s.scalamobil ? <Chip>{T.scalamobil}</Chip> : null}
                    {s.faelltAus ? <Chip ton="warn">{T.faelltAus}</Chip> : null}
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
