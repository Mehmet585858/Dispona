import { TRANSPORT_TYPE_LABEL, type TRANSPORT_TYPES } from "@/core/rides/validation";
import { farbeFuerArt } from "@/core/rides/transportfarbe";

type Transportart = (typeof TRANSPORT_TYPES)[number];

/**
 * Transportart-Etikett (docs/DESIGN-GUIDE.md Abschnitt 2). "quadrat" für Listen/Tabellen
 * (10×10-Farbquadrat vor dem Namen), "gefuellt" für Detail-Seiten (dunkle Füllung, weiße Schrift).
 */
export function TransportBadge({ art, variante = "quadrat" }: { art: Transportart; variante?: "quadrat" | "gefuellt" }) {
  if (variante === "quadrat") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-ink" title={TRANSPORT_TYPE_LABEL[art]}>
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-2.5 rounded-[2px]"
          style={{ background: farbeFuerArt(art, "solid") }}
        />
        {TRANSPORT_TYPE_LABEL[art]}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-[6px] px-2 py-1 text-sm font-semibold text-white"
      style={{ background: farbeFuerArt(art, "solid") }}
    >
      {TRANSPORT_TYPE_LABEL[art]}
    </span>
  );
}
