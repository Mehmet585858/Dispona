"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { automodusEinstellungenSpeichern, type AutomodusEingabe, type DatenschutzEingabe } from "./actions";
import { DatenschutzEinstellungen } from "./DatenschutzEinstellungen";
import { ExportAbrechnung } from "./ExportAbrechnung";
import type { ExportSpalte } from "@/core/export/abrechnung";

const AUTOMODUS_OPTIONEN: { wert: AutomodusEingabe["autoMode"]; label: string; hinweis: string }[] = [
  { wert: "AUS", label: "Aus", hinweis: "Jede Fahrt bestätigt ein Disponent von Hand." },
  { wert: "NACHTS_WOCHENENDE", label: "Nur nachts und am Wochenende", hinweis: "Empfehlung zum Start." },
  { wert: "IMMER", label: "Immer", hinweis: "Rund um die Uhr, auch tagsüber unter der Woche." },
];

export function EinstellungenClient({
  einstellungen,
  datenschutzEinstellungen,
  istAdmin,
  exportSpalten,
}: {
  einstellungen: AutomodusEingabe;
  datenschutzEinstellungen: DatenschutzEingabe;
  istAdmin: boolean;
  exportSpalten: ExportSpalte[];
}) {
  const router = useRouter();
  const [werte, setWerte] = useState<AutomodusEingabe>(einstellungen);
  const [speichert, setSpeichert] = useState(false);
  const [erfolg, setErfolg] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern() {
    setSpeichert(true);
    setErfolg(null);
    setFehler(null);
    try {
      await automodusEinstellungenSpeichern(werte);
      setErfolg("Gespeichert.");
      router.refresh();
    } catch {
      setFehler("Konnte nicht gespeichert werden. Bitte Angaben prüfen.");
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Einstellungen</h1>

      <Card className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold text-ink">Automodus</h2>
          <p className="text-sm text-muted">
            Eindeutige Fahrten automatisch disponieren, ohne dass ein Disponent jede Fahrt bestätigen muss.
            {!istAdmin ? " Nur Admins können das ändern." : ""}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {AUTOMODUS_OPTIONEN.map((option) => (
            <label
              key={option.wert}
              className={`flex items-start gap-3 rounded-xl border p-3 ${
                werte.autoMode === option.wert ? "border-accent bg-accent-soft" : "border-line"
              } ${istAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
            >
              <input
                type="radio"
                name="autoMode"
                checked={werte.autoMode === option.wert}
                disabled={!istAdmin}
                onChange={() => setWerte({ ...werte, autoMode: option.wert })}
                className="mt-1 h-5 w-5"
              />
              <span>
                <span className="block font-medium text-ink">{option.label}</span>
                <span className="block text-sm text-muted">{option.hinweis}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Mindestabstand zum zweitbesten Vorschlag"
            type="number"
            min={0}
            max={100}
            value={werte.autoModeMinMargin}
            disabled={!istAdmin}
            onChange={(e) => setWerte({ ...werte, autoModeMinMargin: Number(e.target.value) })}
            hint="Je größer, desto vorsichtiger. Standard: 5."
          />
          <TextField
            label="Höchstens Tage im Voraus"
            type="number"
            min={0}
            max={14}
            value={werte.autoModeMaxDaysAhead}
            disabled={!istAdmin}
            onChange={(e) => setWerte({ ...werte, autoModeMaxDaysAhead: Number(e.target.value) })}
            hint="Standard: 3."
          />
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={werte.requireDocsForAuto}
            disabled={!istAdmin}
            onChange={(e) => setWerte({ ...werte, requireDocsForAuto: e.target.checked })}
            className="h-5 w-5 rounded border-line-strong"
          />
          Transportschein muss vorliegen, damit automatisch disponiert wird
        </label>

        <TextField
          label="Alarm-Handynummer (Inhaber/Bereitschaft)"
          type="tel"
          value={werte.alertPhone}
          disabled={!istAdmin}
          onChange={(e) => setWerte({ ...werte, alertPhone: e.target.value })}
          placeholder="+49170…"
          hint="Bekommt eine SMS, wenn ein Fahrer nicht bestätigt oder keine Fahrt gefunden wird."
        />

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

      <DatenschutzEinstellungen einstellungen={datenschutzEinstellungen} istAdmin={istAdmin} />

      <ExportAbrechnung anfangsSpalten={exportSpalten} />
    </div>
  );
}
