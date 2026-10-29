"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { KpiTile } from "@/components/ui/KpiTile";
import { Logo } from "@/components/ui/Logo";
import { AnrufKarte, AnrufWarteKarte } from "@/app/dispo/DispoClient";
import { zeitstrahlPosition } from "@/core/shifts/zeitstrahl";
import { liveDemoLaden, liveTranskriptLaden } from "./actions";
import { LiveZeitstrahl } from "./LiveZeitstrahl";

const AKTUALISIERUNG_MS = 5_000;
// Noch nicht eingerichtet (siehe docs/12-betrieb.md) - sobald eine Vapi-Nummer existiert, hier
// und in website/index.html eintragen.
const DEMO_TELEFONNUMMER = process.env.NEXT_PUBLIC_DEMO_PHONE ?? null;

type LiveDaten = Awaited<ReturnType<typeof liveDemoLaden>>;

function keinOp() {}

export function LiveClient({ initialDaten }: { initialDaten: LiveDaten }) {
  const [daten, setDaten] = useState(initialDaten);
  const [jetztProzent, setJetztProzent] = useState<number | null>(null);

  useEffect(() => {
    function aktualisieren() {
      setJetztProzent(zeitstrahlPosition(new Date()));
      liveDemoLaden()
        .then(setDaten)
        .catch(() => {});
    }
    aktualisieren();
    const intervallId = setInterval(aktualisieren, AKTUALISIERUNG_MS);
    return () => clearInterval(intervallId);
  }, []);

  return (
    <div className="min-h-screen bg-ground">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <a href="https://dispona.de" className="flex items-center">
            <Logo className="h-6 text-ink" />
          </a>
          <a href="https://dispona.de#demo" className="text-sm font-medium text-accent hover:underline">
            ← Zurück zu dispona.de
          </a>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
        <Card className="flex flex-col gap-2 border-line-strong">
          <h1 className="text-xl font-bold text-ink">So arbeitet Dispona – live</h1>
          {DEMO_TELEFONNUMMER ? (
            <p className="text-sm text-ink-soft">
              Rufen Sie{" "}
              <a href={`tel:${DEMO_TELEFONNUMMER}`} className="font-semibold text-accent">
                {DEMO_TELEFONNUMMER}
              </a>{" "}
              an, bestellen Sie eine Beispielfahrt, und schauen Sie hier zu, wie sie in Sekunden eingeplant wird.
              Diese Seite aktualisiert sich von selbst.
            </p>
          ) : (
            <p className="text-sm text-ink-soft">
              Die Demo-Telefonnummer wird gerade eingerichtet. Schauen Sie trotzdem schon zu – hier läuft die echte
              Demo-Umgebung.
            </p>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiTile label="Fahrten heute" wert={daten.kennzahlen.fahrtenHeute} />
          <KpiTile label="Gerade unterwegs" wert={daten.kennzahlen.unterwegs} />
          <KpiTile label="Von Dispona eingeplant" wert={daten.kennzahlen.vonDisponaEingeplant} zusatz="heute" />
          <KpiTile label="Anrufe heute" wert={daten.kennzahlen.anrufeHeute} />
        </div>

        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1 basis-[640px]">
            <LiveZeitstrahl fahrten={daten.fahrten} fahrzeugZeilen={daten.fahrzeugZeilen} jetztProzent={jetztProzent} />
          </div>
          <div className="w-full flex-none md:w-[380px]">
            {daten.liveAnrufe.length > 0 ? (
              daten.liveAnrufe.map((anruf, index) => (
                <AnrufKarte
                  key={anruf.id}
                  anruf={anruf}
                  index={index}
                  gesamt={daten.liveAnrufe.length}
                  onFahrtKlick={keinOp}
                  transkriptLaden={liveTranskriptLaden}
                />
              ))
            ) : (
              <AnrufWarteKarte anrufeHeute={daten.kennzahlen.anrufeHeute} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
