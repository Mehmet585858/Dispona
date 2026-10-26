"use client";

import Papa from "papaparse";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { type ImportFeld, spaltenVorschlagen, zeilenZuordnen } from "@/lib/csv";

type Schritt = "datei" | "zuordnen" | "ergebnis";

export function CsvImport({
  titel,
  felder,
  onImport,
}: {
  titel: string;
  felder: readonly ImportFeld[];
  onImport: (zeilen: Record<string, string>[]) => Promise<{ ok: number; fehler: string[] }>;
}) {
  const [offen, setOffen] = useState(false);
  const [schritt, setSchritt] = useState<Schritt>("datei");
  const [spalten, setSpalten] = useState<string[]>([]);
  const [rohZeilen, setRohZeilen] = useState<Record<string, string>[]>([]);
  const [zuordnung, setZuordnung] = useState<Record<string, string>>({});
  const [ladend, setLadend] = useState(false);
  const [ergebnis, setErgebnis] = useState<{ ok: number; fehler: string[] } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  function zurücksetzen() {
    setSchritt("datei");
    setSpalten([]);
    setRohZeilen([]);
    setZuordnung({});
    setErgebnis(null);
    setFehler(null);
  }

  function dateiGewählt(datei: File) {
    setFehler(null);
    Papa.parse<Record<string, string>>(datei, {
      header: true,
      skipEmptyLines: true,
      complete: (ergebnis) => {
        const erkannteSpalten = ergebnis.meta.fields ?? [];
        if (erkannteSpalten.length === 0 || ergebnis.data.length === 0) {
          setFehler("Die Datei konnte nicht gelesen werden. Bitte als CSV-Datei mit Kopfzeile speichern.");
          return;
        }
        setSpalten(erkannteSpalten);
        setRohZeilen(ergebnis.data);
        setZuordnung(spaltenVorschlagen(felder, erkannteSpalten));
        setSchritt("zuordnen");
      },
      error: () => setFehler("Die Datei konnte nicht gelesen werden."),
    });
  }

  async function importieren() {
    setLadend(true);
    setFehler(null);
    try {
      const zugeordnet = zeilenZuordnen(rohZeilen, zuordnung);
      const ergebnis = await onImport(zugeordnet);
      setErgebnis(ergebnis);
      setSchritt("ergebnis");
    } catch {
      setFehler("Der Import ist fehlgeschlagen.");
    } finally {
      setLadend(false);
    }
  }

  const fehlendePflichtfelder = felder.filter((f) => f.pflicht && !zuordnung[f.schlüssel]);

  if (!offen) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOffen(true)}>
        Aus Excel/CSV importieren
      </Button>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">{titel} importieren</h2>
        <button
          type="button"
          onClick={() => {
            setOffen(false);
            zurücksetzen();
          }}
          className="text-sm text-muted hover:text-ink"
        >
          Schließen
        </button>
      </div>

      {schritt === "datei" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-soft">
            Speichern Sie Ihre Excel-Liste als CSV-Datei (Excel: „Speichern unter&quot; →
            „CSV&quot;) und wählen Sie sie hier aus. Die erste Zeile muss die Spaltennamen
            enthalten.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const datei = event.target.files?.[0];
              if (datei) dateiGewählt(datei);
            }}
            className="text-sm text-ink-soft"
          />
          {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : null}
        </div>
      )}

      {schritt === "zuordnen" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-soft">
            {rohZeilen.length} Zeilen gefunden. Ordnen Sie jedem Feld die passende Spalte aus Ihrer
            Datei zu.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {felder.map((feld) => (
              <div key={feld.schlüssel} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ink">
                  {feld.label}
                  {feld.pflicht ? " *" : ""}
                </label>
                <select
                  value={zuordnung[feld.schlüssel] ?? ""}
                  onChange={(event) =>
                    setZuordnung((aktuell) => ({ ...aktuell, [feld.schlüssel]: event.target.value }))
                  }
                  className="h-11 rounded-xl border border-line-strong bg-surface px-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                >
                  <option value="">– nicht übernehmen –</option>
                  {spalten.map((spalte) => (
                    <option key={spalte} value={spalte}>
                      {spalte}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <h3 className="mt-2 text-sm font-medium text-ink">Vorschau (erste 5 Zeilen)</h3>
          <Table>
            <TableHead>
              {felder.map((feld) => (
                <TableHeaderCell key={feld.schlüssel}>{feld.label}</TableHeaderCell>
              ))}
            </TableHead>
            <tbody>
              {zeilenZuordnen(rohZeilen.slice(0, 5), zuordnung).map((zeile, index) => (
                <TableRow key={`vorschau-${index}`}>
                  {felder.map((feld) => (
                    <TableCell key={feld.schlüssel}>{zeile[feld.schlüssel] || "—"}</TableCell>
                  ))}
                </TableRow>
              ))}
            </tbody>
          </Table>

          {fehlendePflichtfelder.length > 0 ? (
            <p className="text-sm text-warn-ink">
              Bitte noch zuordnen: {fehlendePflichtfelder.map((f) => f.label).join(", ")}
            </p>
          ) : null}
          {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : null}

          <div className="flex gap-3">
            <Button
              type="button"
              onClick={importieren}
              disabled={ladend || fehlendePflichtfelder.length > 0}
            >
              {ladend ? "Einen Moment …" : `${rohZeilen.length} Zeilen importieren`}
            </Button>
            <Button type="button" variant="secondary" onClick={zurücksetzen}>
              Andere Datei
            </Button>
          </div>
        </div>
      )}

      {schritt === "ergebnis" && ergebnis ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-soft">
            {ergebnis.ok} von {rohZeilen.length} Zeilen übernommen.
          </p>
          {ergebnis.fehler.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-danger-ink">
              {ergebnis.fehler.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setOffen(false);
              zurücksetzen();
            }}
          >
            Fertig
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
