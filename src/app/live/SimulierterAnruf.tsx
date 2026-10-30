"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SIMULATIONS_SZENARIEN } from "./simulationsSzenarien";

const ZEILE_MS = 2400;
const GEPLANT_MS = 7000;

type Phase = "gespraech" | "geplant";

/**
 * Zeigt einen erfundenen, aber realistischen Beispiel-Anruf, solange kein echter Anruf läuft -
 * rein clientseitig (kein Datenbankzugriff), damit die öffentliche Live-Demo (/live) nie leer
 * wirkt. Läuft parallel zu echten AnrufKarte-Karten weiter, statt sie zu ersetzen - genau das
 * zeigt live, dass Dispona mehrere Anrufe gleichzeitig annehmen kann (siehe LiveClient.tsx).
 */
export function SimulierterAnruf() {
  const [szenarioIndex, setSzenarioIndex] = useState(0);
  const [sichtbareZeilen, setSichtbareZeilen] = useState(1);
  const [phase, setPhase] = useState<Phase>("gespraech");

  const szenario = SIMULATIONS_SZENARIEN[szenarioIndex % SIMULATIONS_SZENARIEN.length];

  useEffect(() => {
    if (phase !== "gespraech") return;
    if (sichtbareZeilen >= szenario.linien.length) {
      setPhase("geplant");
      return;
    }
    const timer = setTimeout(() => setSichtbareZeilen((n) => n + 1), ZEILE_MS);
    return () => clearTimeout(timer);
  }, [phase, sichtbareZeilen, szenario]);

  useEffect(() => {
    if (phase !== "geplant") return;
    const timer = setTimeout(() => {
      setSzenarioIndex((i) => i + 1);
      setSichtbareZeilen(1);
      setPhase("gespraech");
    }, GEPLANT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <Card className="flex min-h-[22rem] flex-col gap-3 border-dashed border-line-strong">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-muted" />
        <b className="text-ink">Beispiel-Anruf</b>
        <span className="rounded-full bg-ground px-2 py-0.5 text-xs font-medium text-muted">
          zeigt, wie ein Anruf bei Dispona abläuft
        </span>
      </div>

      <div className="flex-1">
        <p className="mb-1 text-xs font-medium text-muted">Transkript</p>
        <div className="max-h-64 overflow-y-auto rounded-xl bg-surface2 p-3">
          <div className="flex flex-col gap-2">
            {szenario.linien.slice(0, sichtbareZeilen).map((zeile, index) => (
              <p key={index} className="text-sm text-ink-soft">
                <span className="font-medium text-ink">{zeile.sprecher === "ki" ? "Dispona" : szenario.anruferName}:</span>{" "}
                {zeile.text}
              </p>
            ))}
          </div>
        </div>
      </div>

      {phase === "geplant" ? (
        <div className="grid grid-cols-2 gap-2 rounded-xl border-t border-line pt-2.5 text-sm">
          <div>
            <p className="text-xs text-muted">Fahrgast</p>
            <p className="text-ink">{szenario.fahrgast}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Transport</p>
            <p className="text-ink">{szenario.transport}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Abholung</p>
            <p className="text-ink">{szenario.abholung}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Ziel</p>
            <p className="text-ink">{szenario.ziel}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-muted">Eingeplant bei</p>
            <p className="font-medium text-ink">
              {szenario.fahrzeug} · {szenario.uhrzeit}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Dispona erfasst die Fahrt im Gespräch …</p>
      )}
    </Card>
  );
}
