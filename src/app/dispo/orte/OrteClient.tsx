"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CsvImport } from "@/components/CsvImport";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { TextField } from "@/components/ui/TextField";
import { Tile } from "@/components/ui/Tile";
import {
  ORT_IMPORT_FELDER,
  PLACE_TYPE_LABEL,
  PLACE_TYPES,
  type OrtEingabe,
  type PlaceType,
} from "@/core/places/validation";
import { ortLöschen, orteImportieren, ortSpeichern } from "./actions";

type Ort = {
  id: string;
  label: string;
  street: string;
  zip: string;
  city: string;
  lat: number;
  lng: number;
  type: PlaceType;
};

const LEER: OrtEingabe = {
  label: "",
  street: "",
  zip: "",
  city: "",
  lat: 50.7753,
  lng: 6.0839,
  type: "PRAXIS",
};

export function OrteClient({ orte }: { orte: Ort[] }) {
  const router = useRouter();
  const [formularOffen, setFormularOffen] = useState(false);
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);
  const [eingabe, setEingabe] = useState<OrtEingabe>(LEER);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  function neuAnlegen() {
    setBearbeiteId(null);
    setEingabe(LEER);
    setFormularOffen(true);
  }

  function bearbeiten(ort: Ort) {
    setBearbeiteId(ort.id);
    setEingabe({
      label: ort.label,
      street: ort.street,
      zip: ort.zip,
      city: ort.city,
      lat: ort.lat,
      lng: ort.lng,
      type: ort.type,
    });
    setFormularOffen(true);
  }

  async function speichern() {
    setSpeichert(true);
    setFehler(null);
    try {
      await ortSpeichern(bearbeiteId, eingabe);
      setFormularOffen(false);
      router.refresh();
    } catch {
      setFehler("Konnte nicht gespeichert werden.");
    } finally {
      setSpeichert(false);
    }
  }

  async function löschen(id: string) {
    await ortLöschen(id);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Orte</h1>
        <div className="flex gap-3">
          <CsvImport titel="Orte" felder={ORT_IMPORT_FELDER} onImport={orteImportieren} />
          <Button type="button" onClick={neuAnlegen}>
            Weiterer Ort
          </Button>
        </div>
      </div>

      {formularOffen ? (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-ink">
            {bearbeiteId ? "Ort bearbeiten" : "Neuer Ort"}
          </h2>
          <div className="flex flex-col gap-4">
            <TextField
              label="Name (z. B. „Dialysezentrum Aachen“)"
              value={eingabe.label}
              onChange={(event) => setEingabe({ ...eingabe, label: event.target.value })}
              autoFocus
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Straße und Hausnummer"
                value={eingabe.street}
                onChange={(event) => setEingabe({ ...eingabe, street: event.target.value })}
              />
              <TextField
                label="PLZ"
                value={eingabe.zip}
                onChange={(event) => setEingabe({ ...eingabe, zip: event.target.value })}
              />
              <TextField
                label="Ort"
                value={eingabe.city}
                onChange={(event) => setEingabe({ ...eingabe, city: event.target.value })}
              />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Art</p>
              <div className="flex flex-wrap gap-2">
                {PLACE_TYPES.map((typ) => (
                  <Tile
                    key={typ}
                    label={PLACE_TYPE_LABEL[typ]}
                    active={eingabe.type === typ}
                    onClick={() => setEingabe({ ...eingabe, type: typ })}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Breitengrad (lat)"
                type="number"
                step="0.0001"
                value={eingabe.lat}
                onChange={(event) => setEingabe({ ...eingabe, lat: Number(event.target.value) })}
              />
              <TextField
                label="Längengrad (lng)"
                type="number"
                step="0.0001"
                value={eingabe.lng}
                onChange={(event) => setEingabe({ ...eingabe, lng: Number(event.target.value) })}
              />
            </div>
            <p className="text-sm text-muted">
              Koordinaten finden Sie z. B. bei Google Maps: Rechtsklick auf die Adresse → Koordinaten
              kopieren. Ab Phase 3 schlägt die Software die Adresse automatisch vor.
            </p>
            {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : null}
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={speichern}
                disabled={speichert || !eingabe.label.trim() || !eingabe.street.trim()}
              >
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
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Adresse</TableHeaderCell>
          <TableHeaderCell>Art</TableHeaderCell>
          <TableHeaderCell></TableHeaderCell>
        </TableHead>
        <tbody>
          {orte.map((ort) => (
            <TableRow key={ort.id}>
              <TableCell>{ort.label}</TableCell>
              <TableCell>
                {ort.street}, {ort.zip} {ort.city}
              </TableCell>
              <TableCell>
                <Chip ton="accent">{PLACE_TYPE_LABEL[ort.type]}</Chip>
              </TableCell>
              <TableCell>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => bearbeiten(ort)}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={() => löschen(ort.id)}
                    className="text-sm font-medium text-muted hover:text-danger-ink"
                  >
                    Löschen
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {orte.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4}>
                <span className="text-muted">Noch keine Orte angelegt.</span>
              </TableCell>
            </TableRow>
          ) : null}
        </tbody>
      </Table>
    </div>
  );
}
