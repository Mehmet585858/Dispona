"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { uhrzeit } from "@/app/dispo/fahrten/Zeitstrahl";
import { SIMULATIONS_SZENARIEN, type SimulationsZeile } from "./simulationsSzenarien";
import type { SimulierteZeitstrahlFahrt } from "./LiveZeitstrahl";

// Spürbar gemächlicher als ein reines Lese-Tempo - wirkt sonst wie vorgespult statt wie ein
// echtes Telefonat. Vor einer Antwort von Lisa kommt zusätzlich eine kurze "Überlegen"-Pause
// dazu (DENKPAUSE_MS), vor der nächsten Anrufer-Zeile reicht die normale Pause.
const ZEICHEN_MS = 42;
const ZEILE_PAUSE_MS = 900;
const DENKPAUSE_MS = 600;
const GEPLANT_MS = 8000;

type Phase = "gespraech" | "geplant";

/**
 * Zeigt einen erfundenen, aber realistischen Beispiel-Anruf, solange kein echter Anruf läuft -
 * rein clientseitig (kein Datenbankzugriff), damit die öffentliche Live-Demo (/live) nie leer
 * wirkt. Läuft parallel zu echten AnrufKarte-Karten weiter, statt sie zu ersetzen - genau das
 * zeigt live, dass Dispona mehrere Anrufe gleichzeitig annehmen kann (siehe LiveClient.tsx).
 * Zeilen werden per Tipp-Effekt zeichenweise aufgebaut statt alle auf einmal zu erscheinen.
 *
 * Meldet jede neu "eingeplante" Beispiel-Fahrt einmalig nach oben (onFahrtErfasst), damit
 * LiveClient sie dauerhaft als Beispiel-Kachel im Zeitstrahl sammelt - einmal eingeplante Fahrten
 * bleiben stehen (wie im echten Dashboard), statt beim nächsten Gespräch zu verschwinden.
 *
 * zielZeit (= "jetzt" + offsetMinuten) wird einmal pro Szenario berechnet, nicht erst am Ende -
 * sonst konnte die im Gespräch genannte Uhrzeit (Platzhalter "{{ZEIT}}" in simulationsSzenarien.ts,
 * z. B. "Heute um {{ZEIT}} Uhr") von der tatsächlich eingeplanten abweichen, wenn "jetzt" zwischen
 * Gesprächsbeginn und -ende weiterlief. Beide - gesprochener Text und eingeplante Fahrt - nutzen
 * jetzt denselben Wert, können also nie mehr auseinanderlaufen.
 */
export function SimulierterAnruf({
  onFahrtErfasst,
}: {
  onFahrtErfasst?: (fahrt: Omit<SimulierteZeitstrahlFahrt, "vehicleId" | "id"> & { plate: string }) => void;
}) {
  const [szenarioIndex, setSzenarioIndex] = useState(0);
  const [zeilenIndex, setZeilenIndex] = useState(0);
  const [zeichenIndex, setZeichenIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("gespraech");
  const [zielZeit, setZielZeit] = useState<Date>(
    () => new Date(Date.now() + SIMULATIONS_SZENARIEN[0].offsetMinuten * 60_000),
  );

  const szenario = SIMULATIONS_SZENARIEN[szenarioIndex % SIMULATIONS_SZENARIEN.length];
  const aktuelleZeile = szenario.linien[zeilenIndex];

  function zeileText(zeile: SimulationsZeile): string {
    return zeile.text.replace("{{ZEIT}}", uhrzeit(zielZeit));
  }
  const aktuelleZeileText = aktuelleZeile ? zeileText(aktuelleZeile) : undefined;

  // Neu berechnet, sobald ein neues Szenario beginnt (inklusive des allerersten) - danach bleibt
  // zielZeit für das gesamte Gespräch fest, siehe Kommentar oben.
  useEffect(() => {
    setZielZeit(new Date(Date.now() + szenario.offsetMinuten * 60_000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [szenarioIndex]);

  useEffect(() => {
    if (phase !== "gespraech") return;
    if (!aktuelleZeileText) {
      const geplantesEnde = new Date(zielZeit.getTime() + szenario.dauerMinuten * 60_000);
      onFahrtErfasst?.({
        plate: szenario.fahrzeug,
        pickupAt: zielZeit,
        geplantesEnde,
        fahrgast: szenario.fahrgast,
        transport: szenario.transport,
      });
      setPhase("geplant");
      return;
    }
    if (zeichenIndex < aktuelleZeileText.length) {
      const timer = setTimeout(() => setZeichenIndex((n) => n + 1), ZEICHEN_MS);
      return () => clearTimeout(timer);
    }
    const naechsteZeile = szenario.linien[zeilenIndex + 1];
    const pause = naechsteZeile?.sprecher === "ki" ? ZEILE_PAUSE_MS + DENKPAUSE_MS : ZEILE_PAUSE_MS;
    const timer = setTimeout(() => {
      setZeilenIndex((n) => n + 1);
      setZeichenIndex(0);
    }, pause);
    return () => clearTimeout(timer);
  }, [phase, zeichenIndex, aktuelleZeileText, szenario, zeilenIndex, zielZeit, onFahrtErfasst]);

  useEffect(() => {
    if (phase !== "geplant") return;
    const timer = setTimeout(() => {
      setSzenarioIndex((i) => i + 1);
      setZeilenIndex(0);
      setZeichenIndex(0);
      setPhase("gespraech");
    }, GEPLANT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const fertigeZeilen = szenario.linien.slice(0, zeilenIndex);

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
            {fertigeZeilen.map((zeile, index) => (
              <p key={index} className="text-sm text-ink-soft">
                <span className="font-medium text-ink">{zeile.sprecher === "ki" ? "Lisa" : szenario.anruferName}:</span>{" "}
                {zeileText(zeile)}
              </p>
            ))}
            {aktuelleZeileText !== undefined ? (
              <p className="text-sm text-ink-soft">
                <span className="font-medium text-ink">{aktuelleZeile!.sprecher === "ki" ? "Lisa" : szenario.anruferName}:</span>{" "}
                {aktuelleZeileText.slice(0, zeichenIndex)}
                <span className="animate-pulse">▍</span>
              </p>
            ) : null}
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
              {szenario.fahrzeug} · {uhrzeit(zielZeit)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Lisa erfasst die Fahrt im Gespräch …</p>
      )}
    </Card>
  );
}
