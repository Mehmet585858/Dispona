"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { datenschutzEinstellungenSpeichern, type DatenschutzEingabe } from "./actions";

export function DatenschutzEinstellungen({
  einstellungen,
  istAdmin,
}: {
  einstellungen: DatenschutzEingabe;
  istAdmin: boolean;
}) {
  const [werte, setWerte] = useState<DatenschutzEingabe>(einstellungen);
  const [speichert, setSpeichert] = useState(false);
  const [erfolg, setErfolg] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern() {
    setSpeichert(true);
    setErfolg(null);
    setFehler(null);
    try {
      await datenschutzEinstellungenSpeichern(werte);
      setErfolg("Gespeichert.");
    } catch {
      setFehler("Konnte nicht gespeichert werden. Bitte Angaben prüfen.");
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-ink">Datenschutz & Aufbewahrung</h2>
        <p className="text-sm text-muted">
          Danach werden Fahrten, Transkripte und Aufnahmen automatisch gelöscht (nachts, pro Mandant).
          {!istAdmin ? " Nur Admins können das ändern." : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Fahrten & Transkripte aufbewahren (Tage)"
          type="number"
          min={30}
          max={7300}
          value={werte.dataRetentionDays}
          disabled={!istAdmin}
          onChange={(e) => setWerte({ ...werte, dataRetentionDays: Number(e.target.value) })}
          hint="Danach werden Fahrt und Gesprächstranskript endgültig gelöscht. Standard: 3650 (10 Jahre)."
        />
        <TextField
          label="Anruf-Aufnahmen aufbewahren (Tage)"
          type="number"
          min={1}
          max={3650}
          value={werte.audioRetentionDays}
          disabled={!istAdmin}
          onChange={(e) => setWerte({ ...werte, audioRetentionDays: Number(e.target.value) })}
          hint="Danach wird nur die Audiodatei gelöscht, der Rest der Fahrt bleibt. Standard: 30."
        />
      </div>

      {erfolg ? <p className="text-sm text-accent">{erfolg}</p> : null}
      {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : null}

      {istAdmin ? (
        <div>
          <Button type="button" onClick={speichern} disabled={speichert}>
            {speichert ? "Speichert …" : "Speichern"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
