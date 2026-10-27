"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { datumIso, tagVerschieben } from "@/core/shifts/week";
import { EXPORT_SPALTEN_LABEL, type ExportSpalte } from "@/core/export/abrechnung";
import { exportVorlageSpeichern } from "./actions";

function dateiNameAusHeader(header: string | null, fallback: string): string {
  const treffer = header ? /filename="([^"]+)"/.exec(header) : null;
  return treffer?.[1] ?? fallback;
}

export function ExportAbrechnung({ anfangsSpalten }: { anfangsSpalten: ExportSpalte[] }) {
  const heute = datumIso(new Date());
  const [von, setVon] = useState(tagVerschieben(heute, -7));
  const [bis, setBis] = useState(heute);
  const [nurNichtExportierte, setNurNichtExportierte] = useState(true);
  const [spalten, setSpalten] = useState<ExportSpalte[]>(anfangsSpalten);
  const [speichertVorlage, setSpeichertVorlage] = useState(false);
  const [vorlageGespeichert, setVorlageGespeichert] = useState(false);
  const [laedt, setLaedt] = useState<"csv" | "xlsx" | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  function verschieben(index: number, richtung: -1 | 1) {
    setSpalten((aktuell) => {
      const neu = [...aktuell];
      const ziel = index + richtung;
      if (ziel < 0 || ziel >= neu.length) return aktuell;
      [neu[index], neu[ziel]] = [neu[ziel], neu[index]];
      return neu;
    });
    setVorlageGespeichert(false);
  }

  async function vorlageSpeichern() {
    setSpeichertVorlage(true);
    try {
      await exportVorlageSpeichern(spalten);
      setVorlageGespeichert(true);
    } finally {
      setSpeichertVorlage(false);
    }
  }

  async function herunterladen(format: "csv" | "xlsx") {
    setLaedt(format);
    setFehler(null);
    try {
      const params = new URLSearchParams({ von, bis, format, nurNichtExportierte: String(nurNichtExportierte) });
      const antwort = await fetch(`/api/export/abrechnung?${params}`);
      if (!antwort.ok) {
        const text = await antwort.text();
        try {
          setFehler(JSON.parse(text).error ?? "Export fehlgeschlagen.");
        } catch {
          setFehler("Export fehlgeschlagen.");
        }
        return;
      }
      const blob = await antwort.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = dateiNameAusHeader(antwort.headers.get("Content-Disposition"), `abrechnung-${von}-bis-${bis}.${format}`);
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setLaedt(null);
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-ink">Export für die Abrechnung</h2>
        <p className="text-sm text-muted">
          Erledigte Fahrten eines Zeitraums als CSV oder Excel – zum Übernehmen in Ihre Abrechnungssoftware.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Von" type="date" value={von} onChange={(e) => setVon(e.target.value)} />
        <TextField label="Bis" type="date" value={bis} onChange={(e) => setBis(e.target.value)} />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={nurNichtExportierte}
          onChange={(e) => setNurNichtExportierte(e.target.checked)}
          className="h-5 w-5 rounded border-line-strong"
        />
        Nur noch nicht exportierte Fahrten
      </label>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">Spaltenreihenfolge</p>
        <div className="flex flex-col gap-1">
          {spalten.map((spalte, index) => (
            <div key={spalte} className="flex items-center justify-between rounded-lg border border-line px-3 py-1.5 text-sm">
              <span className="text-ink-soft">{EXPORT_SPALTEN_LABEL[spalte]}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => verschieben(index, -1)}
                  disabled={index === 0}
                  className="rounded px-2 py-0.5 text-muted hover:bg-accent-soft hover:text-accent disabled:opacity-30"
                  aria-label={`${EXPORT_SPALTEN_LABEL[spalte]} nach oben`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => verschieben(index, 1)}
                  disabled={index === spalten.length - 1}
                  className="rounded px-2 py-0.5 text-muted hover:bg-accent-soft hover:text-accent disabled:opacity-30"
                  aria-label={`${EXPORT_SPALTEN_LABEL[spalte]} nach unten`}
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" className="mt-2" onClick={vorlageSpeichern} disabled={speichertVorlage}>
          {speichertVorlage ? "Speichert …" : "Vorlage speichern"}
        </Button>
        {vorlageGespeichert ? <span className="ml-3 text-sm text-accent">Gespeichert.</span> : null}
      </div>

      {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : null}

      <div className="flex gap-3">
        <Button type="button" onClick={() => herunterladen("csv")} disabled={laedt !== null}>
          {laedt === "csv" ? "Erstellt …" : "CSV herunterladen"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => herunterladen("xlsx")} disabled={laedt !== null}>
          {laedt === "xlsx" ? "Erstellt …" : "Excel herunterladen"}
        </Button>
      </div>
    </Card>
  );
}
