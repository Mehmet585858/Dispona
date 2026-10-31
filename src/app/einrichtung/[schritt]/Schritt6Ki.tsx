"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { kiEinstellungenSpeichern, type KiEingabe } from "./actions";
import { STIMMEN } from "./konstanten";

export function Schritt6Ki({ initial }: { initial: KiEingabe }) {
  const [werte, setWerte] = useState<KiEingabe>(initial);
  const [speichert, setSpeichert] = useState(false);
  const [erfolg, setErfolg] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern() {
    setSpeichert(true);
    setErfolg(null);
    setFehler(null);
    try {
      // Maßnahme M-47: ungültige Weiterleitungsnummer wird abgelehnt – Meldung zeigen, gespeicherte
      // (normalisierte) Nummer übernehmen.
      const ergebnis = await kiEinstellungenSpeichern(werte);
      if (ergebnis.ok) {
        setWerte({ ...werte, escalationNumber: ergebnis.escalationNumber });
        setErfolg("Gespeichert.");
      } else {
        setFehler(ergebnis.fehler);
      }
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">KI anpassen</h1>
        <p className="text-sm text-muted">Stimme, Begrüßung und Weiterleitungsnummer für die KI am Telefon.</p>
      </div>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">Stimme</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {STIMMEN.map((stimme) => (
            <label
              key={stimme.voiceId}
              className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 ${
                werte.voiceId === stimme.voiceId ? "border-accent bg-accent-soft" : "border-line"
              }`}
            >
              <input
                type="radio"
                name="voiceId"
                className="sr-only"
                checked={werte.voiceId === stimme.voiceId}
                onChange={() => setWerte({ ...werte, voiceId: stimme.voiceId })}
              />
              <span className="font-medium text-ink">{stimme.name}</span>
              <span className="text-sm text-muted">{stimme.beschreibung}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">Hörproben folgen, sobald Testanrufe möglich sind (Schritt 7).</p>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">Begrüßung</h2>
        <textarea
          value={werte.greeting}
          onChange={(e) => setWerte({ ...werte, greeting: e.target.value })}
          rows={3}
          className="rounded-xl border border-line-strong bg-surface p-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">Weiterleitungsnummer</h2>
        <p className="text-sm text-muted">
          Hierhin leitet die KI weiter, wenn sie ausgeschaltet ist oder jemand mit einem Menschen sprechen
          möchte. Bitte Ihr Handy oder eine Durchwahl angeben, nicht die Hauptnummer.
        </p>
        <TextField
          label="Weiterleitungsnummer"
          type="tel"
          value={werte.escalationNumber}
          onChange={(e) => setWerte({ ...werte, escalationNumber: e.target.value })}
        />
      </Card>

      {erfolg ? <p className="text-sm text-accent">{erfolg}</p> : null}
      {fehler ? (
        <p className="text-sm text-danger-ink" role="alert">
          {fehler}
        </p>
      ) : null}
      <div>
        <Button type="button" onClick={speichern} disabled={speichert}>
          {speichert ? "Speichert …" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}
