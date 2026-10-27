"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { KpiTile } from "@/components/ui/KpiTile";
import { berlinerMitternacht, montagVerschieben } from "@/core/shifts/week";
import type { Kennzahlen } from "@/core/auswertung/kennzahlen";

function prozent(wert: number | null): string {
  return wert === null ? "–" : `${wert.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

export function AuswertungClient({ montagIso, kennzahlen }: { montagIso: string; kennzahlen: Kennzahlen }) {
  const router = useRouter();
  const montag = berlinerMitternacht(montagIso);
  const sonntag = new Date(montag);
  sonntag.setDate(sonntag.getDate() + 6);

  function wocheWechseln(richtung: -1 | 1) {
    router.push(`/dispo/auswertung?montag=${montagVerschieben(montagIso, richtung)}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Auswertung</h1>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => wocheWechseln(-1)}>
            ‹ Vorherige Woche
          </Button>
          <span className="whitespace-nowrap text-sm font-medium text-ink">
            {montag.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
            {" – "}
            {sonntag.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </span>
          <Button type="button" variant="secondary" onClick={() => wocheWechseln(1)}>
            Nächste Woche ›
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KpiTile label="Anrufe" wert={kennzahlen.anrufeGesamt} />
        <KpiTile
          label="Vollständig erfasst"
          wert={prozent(kennzahlen.vollstaendigErfasstQuote)}
          zusatz="Ziel: ≥ 80 %"
        />
        <KpiTile
          label="Weiterleitungen an Menschen"
          wert={prozent(kennzahlen.weiterleitungenQuote)}
          zusatz="Ziel: < 20 %"
        />
        <KpiTile
          label="Vorschläge unverändert übernommen"
          wert={prozent(kennzahlen.vorschlaegeUnveraendertQuote)}
          zusatz="Ziel: ≥ 70 %"
        />
        <KpiTile
          label="Automatisch disponiert"
          wert={prozent(kennzahlen.automatischDisponiertQuote)}
          zusatz="Ziel: ≥ 95 %"
        />
        <KpiTile label="Pünktlich am Ziel" wert={prozent(kennzahlen.puenktlichkeitQuote)} zusatz="Ziel: ≥ 95 %" />
      </div>

      <p className="text-xs text-muted">
        „–&rdquo; bedeutet: für diese Kennzahl gab es in der Woche noch keine Grundlage (z. B. keine Anrufe
        oder keine Fahrten mit Termin).
      </p>
    </div>
  );
}
