"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KpiTile } from "@/components/ui/KpiTile";
import { Logo } from "@/components/ui/Logo";
import { AnrufKarussell, AnrufWarteKarte } from "@/app/dispo/DispoClient";
import { zeitstrahlPosition } from "@/core/shifts/zeitstrahl";
import { liveDemoLaden, liveTranskriptLaden } from "./actions";
import { LiveZeitstrahl } from "./LiveZeitstrahl";

const AKTUALISIERUNG_MS = 5_000;
// Noch nicht eingerichtet (siehe docs/12-betrieb.md) - sobald eine Vapi-Nummer existiert, hier
// und in website/index.html eintragen.
const DEMO_TELEFONNUMMER = process.env.NEXT_PUBLIC_DEMO_PHONE ?? null;

// Dieselbe Liste wie src/app/dispo/layout.tsx - hier bewusst als reiner Text nachgebaut (nicht
// verlinkt), damit die Demo optisch 1:1 wie das echte Dashboard aussieht, ohne Besucher ohne
// Konto auf Seiten zu schicken, die sie sofort zum Login zurückwerfen würden.
const NAVIGATION = ["Dashboard", "Fahrzeuge", "Fahrgäste", "Orte", "Anrufe", "Auswertung", "Einstellungen"];

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
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">Live-Demo</span>
            <a href="https://dispona.de#demo" className="text-sm font-medium text-accent hover:underline">
              ← Zurück zu dispona.de
            </a>
          </div>
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col gap-5 px-6 py-8">
        <Card className="flex flex-col gap-2 border-line-strong">
          <h1 className="text-xl font-bold text-ink">So arbeitet Dispona – live</h1>
          {DEMO_TELEFONNUMMER ? (
            <p className="text-sm text-ink-soft">
              Rufen Sie{" "}
              <a href={`tel:${DEMO_TELEFONNUMMER}`} className="font-semibold text-accent">
                {DEMO_TELEFONNUMMER}
              </a>{" "}
              an, bestellen Sie eine Fahrt, und schauen Sie hier zu, wie sie in Sekunden eingeplant wird. Diese
              Seite aktualisiert sich von selbst.
            </p>
          ) : (
            <p className="text-sm text-ink-soft">
              Die Demo-Telefonnummer wird gerade eingerichtet. Schauen Sie trotzdem schon zu – hier läuft die echte
              Demo-Umgebung.
            </p>
          )}
        </Card>

        {/* Dieselbe Werkzeugleiste wie im echten Dashboard (DispoClient) - hier ohne Funktion
            nachgebaut (keine Links/Buttons, feste Werte), damit Besucher sehen, wie die Oberfläche
            insgesamt aussieht, ohne auf Steuerelemente zu stoßen, die ohne Konto nichts tun würden. */}
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
              aria-label="Suche (in der Demo ohne Funktion)"
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

        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-1 basis-[640px] flex-col gap-3">
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
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
              <LiveZeitstrahl fahrten={daten.fahrten} fahrzeugZeilen={daten.fahrzeugZeilen} jetztProzent={jetztProzent} />
            </div>
          </div>
          <div className="flex w-full flex-none flex-col gap-4 md:w-[380px]">
            {daten.liveAnrufe.length > 0 ? (
              <AnrufKarussell liveAnrufe={daten.liveAnrufe} onFahrtKlick={keinOp} transkriptLaden={liveTranskriptLaden} />
            ) : (
              <AnrufWarteKarte anrufeHeute={daten.kennzahlen.anrufeHeute} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
