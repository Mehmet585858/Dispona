"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { letzteFahrtenLaden } from "./actions";

type Fahrer = { id: string; user: { name: string }; pushSubscriptions: { id: string }[] };
type Fahrt = { id: string; pickupAt: Date; passenger: { firstName: string; lastName: string } };

export function Schritt7Testanruf({ kiNummer, fahrer }: { kiNummer: string | null; fahrer: Fahrer[] }) {
  const [beobachtet, setBeobachtet] = useState(false);
  const [fahrten, setFahrten] = useState<Fahrt[]>([]);
  const seitRef = useRef<string | null>(null);

  useEffect(() => {
    if (!beobachtet) return;
    const intervall = setInterval(async () => {
      if (!seitRef.current) return;
      const neue = await letzteFahrtenLaden(seitRef.current);
      if (neue.length > 0) setFahrten(neue);
    }, 3000);
    return () => clearInterval(intervall);
  }, [beobachtet]);

  function beobachtungStarten() {
    seitRef.current = new Date().toISOString();
    setFahrten([]);
    setBeobachtet(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Testanruf</h1>
        <p className="text-sm text-muted">Rufen Sie jetzt selbst an und bestellen Sie eine Probefahrt.</p>
      </div>

      <Card className="flex flex-col items-center gap-3 py-8 text-center">
        {kiNummer ? (
          <p className="text-4xl font-semibold tabular-nums text-accent">{kiNummer}</p>
        ) : (
          <p className="text-sm text-danger-ink">Noch keine KI-Nummer hinterlegt – zurück zu Schritt 2.</p>
        )}
        <Button type="button" onClick={beobachtungStarten} disabled={!kiNummer || beobachtet}>
          {beobachtet ? "Wartet auf die Testfahrt …" : "Live mitverfolgen"}
        </Button>
      </Card>

      {fahrten.length > 0 ? (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-ink">Erfasste Testfahrt</h2>
          {fahrten.map((fahrt) => (
            <p key={fahrt.id} className="text-sm text-ink-soft">
              {new Date(fahrt.pickupAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} ·{" "}
              {fahrt.passenger.firstName} {fahrt.passenger.lastName}
            </p>
          ))}
          <p className="text-sm text-accent">
            Die Fahrt erscheint jetzt auch auf der Startseite mit einem Fahrzeugvorschlag.
          </p>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink">Testfahrer</h2>
        <p className="text-sm text-muted">Ein Fahrer mit installierter App bekommt eine Push-Nachricht, sobald eine Fahrt disponiert wird.</p>
        <div className="flex flex-col gap-1.5">
          {fahrer.map((f) => (
            <div key={f.id} className="flex items-center justify-between">
              <span className="text-sm text-ink">{f.user.name}</span>
              <Chip ton={f.pushSubscriptions.length > 0 ? "accent" : "neutral"}>
                {f.pushSubscriptions.length > 0 ? "App eingerichtet" : "App noch nicht eingerichtet"}
              </Chip>
            </div>
          ))}
          {fahrer.length === 0 ? <p className="text-sm text-muted">Noch kein Fahrer eingeladen (Schritt 4).</p> : null}
        </div>
      </Card>
    </div>
  );
}
