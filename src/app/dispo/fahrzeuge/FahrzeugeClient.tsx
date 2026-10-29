"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CsvImport } from "@/components/CsvImport";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { NumberField } from "@/components/ui/NumberField";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { TextField } from "@/components/ui/TextField";
import { Tile } from "@/components/ui/Tile";
import { FAHRZEUG_IMPORT_FELDER, type FahrzeugEingabe } from "@/core/vehicles/validation";
import { fahrzeugLöschen, fahrzeugeImportieren, fahrzeugSpeichern } from "./actions";

type Fahrzeug = {
  id: string;
  plate: string;
  seats: number;
  wheelchairSpots: number;
  carryChair: boolean;
  stretcher: boolean;
  active: boolean;
};

const LEER: FahrzeugEingabe = {
  plate: "",
  seats: 4,
  wheelchairSpots: 0,
  carryChair: false,
  stretcher: false,
  active: true,
};

export function FahrzeugeClient({ fahrzeuge }: { fahrzeuge: Fahrzeug[] }) {
  const router = useRouter();
  const [formularOffen, setFormularOffen] = useState(false);
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);
  const [eingabe, setEingabe] = useState<FahrzeugEingabe>(LEER);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  function neuAnlegen() {
    setBearbeiteId(null);
    setEingabe(LEER);
    setFormularOffen(true);
  }

  function bearbeiten(fahrzeug: Fahrzeug) {
    setBearbeiteId(fahrzeug.id);
    setEingabe({
      plate: fahrzeug.plate,
      seats: fahrzeug.seats,
      wheelchairSpots: fahrzeug.wheelchairSpots,
      carryChair: fahrzeug.carryChair,
      stretcher: fahrzeug.stretcher,
      active: fahrzeug.active,
    });
    setFormularOffen(true);
  }

  async function speichern() {
    setSpeichert(true);
    setFehler(null);
    try {
      const ergebnis = await fahrzeugSpeichern(bearbeiteId, eingabe);
      if (!ergebnis.ok) {
        setFehler(ergebnis.fehler);
        return;
      }
      setFormularOffen(false);
      router.refresh();
    } catch {
      setFehler("Unerwarteter Fehler. Bitte erneut versuchen.");
    } finally {
      setSpeichert(false);
    }
  }

  async function deaktivieren(id: string) {
    await fahrzeugLöschen(id);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Fahrzeuge</h1>
        <div className="flex gap-3">
          <CsvImport titel="Fahrzeuge" felder={FAHRZEUG_IMPORT_FELDER} onImport={fahrzeugeImportieren} />
          <Button type="button" onClick={neuAnlegen}>
            Weiteres Fahrzeug
          </Button>
        </div>
      </div>

      {formularOffen ? (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-ink">
            {bearbeiteId ? "Fahrzeug bearbeiten" : "Neues Fahrzeug"}
          </h2>
          <div className="flex flex-col gap-4">
            <TextField
              label="Kennzeichen"
              value={eingabe.plate}
              onChange={(event) => setEingabe({ ...eingabe, plate: event.target.value })}
              autoFocus
            />
            <NumberField
              label="Sitzplätze"
              value={eingabe.seats}
              onChange={(wert) => setEingabe({ ...eingabe, seats: wert })}
            />
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Ausstattung</p>
              <div className="flex gap-2">
                <Tile
                  label="Rollstuhl"
                  active={eingabe.wheelchairSpots > 0}
                  onClick={() =>
                    setEingabe({ ...eingabe, wheelchairSpots: eingabe.wheelchairSpots > 0 ? 0 : 1 })
                  }
                />
                <Tile
                  label="Tragestuhl"
                  active={eingabe.carryChair}
                  onClick={() => setEingabe({ ...eingabe, carryChair: !eingabe.carryChair })}
                />
                <Tile
                  label="Liegend"
                  active={eingabe.stretcher}
                  onClick={() => setEingabe({ ...eingabe, stretcher: !eingabe.stretcher })}
                />
              </div>
            </div>
            {eingabe.wheelchairSpots > 0 ? (
              <NumberField
                label="Rollstuhlplätze"
                value={eingabe.wheelchairSpots}
                onChange={(wert) => setEingabe({ ...eingabe, wheelchairSpots: wert })}
              />
            ) : null}
            {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : null}
            <div className="flex gap-3">
              <Button type="button" onClick={speichern} disabled={speichert || !eingabe.plate.trim()}>
                {speichert ? "Speichert …" : "Speichern"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setFormularOffen(false)}>
                Abbrechen
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Table>
        <TableHead>
          <TableHeaderCell>Kennzeichen</TableHeaderCell>
          <TableHeaderCell>Plätze</TableHeaderCell>
          <TableHeaderCell>Ausstattung</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell></TableHeaderCell>
        </TableHead>
        <tbody>
          {fahrzeuge.map((fahrzeug) => (
            <TableRow key={fahrzeug.id}>
              <TableCell>{fahrzeug.plate}</TableCell>
              <TableCell nums>{fahrzeug.seats}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {fahrzeug.wheelchairSpots > 0 ? <Chip ton="accent">Rollstuhl</Chip> : null}
                  {fahrzeug.carryChair ? <Chip ton="accent">Tragestuhl</Chip> : null}
                  {fahrzeug.stretcher ? <Chip ton="accent">Liegend</Chip> : null}
                </div>
              </TableCell>
              <TableCell>
                <Chip ton={fahrzeug.active ? "info" : "neutral"}>
                  {fahrzeug.active ? "aktiv" : "inaktiv"}
                </Chip>
              </TableCell>
              <TableCell>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => bearbeiten(fahrzeug)}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Bearbeiten
                  </button>
                  {fahrzeug.active ? (
                    <button
                      type="button"
                      onClick={() => deaktivieren(fahrzeug.id)}
                      className="text-sm font-medium text-muted hover:text-danger-ink"
                    >
                      Deaktivieren
                    </button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {fahrzeuge.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5}>
                <span className="text-muted">Noch keine Fahrzeuge angelegt.</span>
              </TableCell>
            </TableRow>
          ) : null}
        </tbody>
      </Table>
    </div>
  );
}
