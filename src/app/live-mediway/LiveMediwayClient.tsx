"use client";

// Kopie von src/app/live/LiveClient.tsx, nur auf den Mediway-Testmandanten umgebogen - bewusst
// dupliziert statt die Demo-Seite generisch gemacht (siehe actions.ts), da das nur für den
// Live-Testanruf gedacht ist und danach wieder entfernt wird.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KpiTile } from "@/components/ui/KpiTile";
import { Logo } from "@/components/ui/Logo";
import { AnrufKarte, AnrufWarteKarte } from "@/app/dispo/DispoClient";
import { zeitstrahlPosition } from "@/core/shifts/zeitstrahl";
import { LiveZeitstrahl } from "@/app/live/LiveZeitstrahl";
import { liveMediwayLaden, liveMediwayTranskriptLaden } from "./actions";

const AKTUALISIERUNG_MS = 5_000;
const TESTNUMMER = "+1 858 399 4019";

const NAVIGATION = ["Dashboard", "Fahrzeuge", "Fahrgäste", "Orte", "Anrufe", "Auswertung", "Einstellungen"];

type LiveDaten = Awaited<ReturnType<typeof liveMediwayLaden>>;

function keinOp() {}

export function LiveMediwayClient({ initialDaten }: { initialDaten: LiveDaten }) {
  const [daten, setDaten] = useState(initialDaten);
  const [jetztProzent, setJetztProzent] = useState<number | null>(null);

  useEffect(() => {
    function aktualisieren() {
      setJetztProzent(zeitstrahlPosition(new Date()));
      liveMediwayLaden()
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
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex flex-wrap items-center gap-1">
            <a href="https://dispona.de" className="mr-4 flex items-center">
              <Logo className="h-6 text-ink" />
            </a>
            {NAVIGATION.map((label) => (
              <span key={label} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft">
                {label}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">Mediway Live-Test</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
        <Card className="flex flex-col gap-2 border-line-strong">
          <h1 className="text-xl font-bold text-ink">Mediway Krankenfahrdienst – Live-Test</h1>
          <p className="text-sm text-ink-soft">
            Rufen Sie{" "}
            <a href={`tel:${TESTNUMMER.replaceAll(" ", "")}`} className="font-semibold text-accent">
              {TESTNUMMER}
            </a>{" "}
            an. Diese Seite aktualisiert sich von selbst.
          </p>
        </Card>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3">
          <div className="flex gap-1.5 rounded-xl border border-line-strong p-1">
            <span className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-surface">Tag</span>
            <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft">Woche</span>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-ground p-1">
            <span className="flex h-9 w-9 items-center justify-center text-ink-soft">‹</span>
            <span className="px-2 text-sm font-semibold text-ink">
              {new Date().toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}
            </span>
            <span className="flex h-9 w-9 items-center justify-center text-ink-soft">›</span>
          </div>
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-line px-3 py-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="text-muted">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="Patient, Fahrzeug oder Telefonnummer suchen …"
              aria-label="Suche (hier ohne Funktion)"
              disabled
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
          </div>
          {daten.liveAnrufe.length > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-2 text-sm font-semibold text-accent">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Dispona · {daten.liveAnrufe.length} {daten.liveAnrufe.length === 1 ? "Anruf läuft" : "Anrufe laufen"}
            </span>
          ) : null}
          <span className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-line-strong bg-surface px-5 text-base font-semibold text-ink">
            Fahrtenbuch
          </span>
          <Button type="button" disabled>
            + Neue Fahrt
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <KpiTile
            label="Fahrten heute"
            wert={daten.kennzahlen.fahrtenHeute}
            zusatz={`· ${daten.fahrten.filter((f) => f.status === "ERLEDIGT").length} erledigt`}
          />
          <KpiTile label="Gerade unterwegs" wert={daten.kennzahlen.unterwegs} />
          <KpiTile label="Von Dispona eingeplant" wert={daten.kennzahlen.vonDisponaEingeplant} zusatz="heute" />
          <KpiTile label="Braucht Sie" wert={daten.kennzahlen.brauchtSie} warnstil={daten.kennzahlen.brauchtSie > 0} />
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
                  transkriptLaden={liveMediwayTranskriptLaden}
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
