"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { TextField } from "@/components/ui/TextField";
import { Tile } from "@/components/ui/Tile";
import {
  DOC_STATUS,
  DOC_STATUS_LABEL,
  TRANSPORT_TYPE_LABEL,
  TRANSPORT_TYPES,
  type FahrtEingabe,
} from "@/core/rides/validation";
import { datumIso } from "@/core/shifts/week";
import { VorschlagAktion, type VorschlagOption } from "@/components/VorschlagAktion";
import { FahrgastAuswahl } from "./FahrgastAuswahl";
import { OrtAuswahl } from "./OrtAuswahl";
import { fahrtAnlegen } from "./actions";

type Fahrt = {
  id: string;
  pickupAt: Date;
  transportType: (typeof TRANSPORT_TYPES)[number];
  status: string;
  problems: string[];
  passenger: { firstName: string; lastName: string };
  pickupPlace: { label: string };
  dropoffPlace: { label: string };
  vehicle: { plate: string } | null;
  suggestions?: { options: unknown }[];
};
type Ort = { id: string; label: string; street: string; city: string };
type Fahrzeug = { id: string; plate: string };

const STATUS_TON: Record<string, "neutral" | "warn" | "info" | "danger" | "accent"> = {
  ENTWURF: "neutral",
  ERFASST: "warn",
  VORGESCHLAGEN: "warn",
  DISPONIERT: "info",
  UNTERWEGS: "info",
  AN_BORD: "info",
  ERLEDIGT: "accent",
  NICHT_ANGETROFFEN: "danger",
  STORNIERT: "neutral",
  PROBLEM: "danger",
};
const STATUS_LABEL: Record<string, string> = {
  ENTWURF: "Entwurf",
  ERFASST: "Erfasst",
  VORGESCHLAGEN: "Vorgeschlagen",
  DISPONIERT: "Disponiert",
  UNTERWEGS: "Unterwegs",
  AN_BORD: "Fahrgast an Bord",
  ERLEDIGT: "Erledigt",
  NICHT_ANGETROFFEN: "Nicht angetroffen",
  STORNIERT: "Storniert",
  PROBLEM: "Problem",
};

const LEER: FahrtEingabe = {
  passengerId: "",
  pickupPlaceId: "",
  dropoffPlaceId: "",
  datum: datumIso(new Date()),
  abholzeit: "09:00",
  terminzeit: "",
  rueckfahrt: false,
  rueckfahrtzeit: "",
  transportType: "SITZEND",
  companion: false,
  assistanceNotes: "",
  prescription: "UNKLAR",
  approval: "NICHT_NOETIG",
};

export function FahrtenClient({
  fahrten,
  orte,
  fahrzeuge,
  datum,
}: {
  fahrten: Fahrt[];
  orte: Ort[];
  fahrzeuge: Fahrzeug[];
  datum: string;
}) {
  const router = useRouter();
  const [formularOffen, setFormularOffen] = useState(false);
  const [fahrgast, setFahrgast] = useState<{ id: string; name: string } | null>(null);
  const [eingabe, setEingabe] = useState<FahrtEingabe>(LEER);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState<string | null>(null);

  function wechselDatum(neuesDatum: string) {
    router.push(`/dispo/fahrten?datum=${neuesDatum}`);
  }

  async function speichern() {
    if (!fahrgast) {
      setFehler("Bitte zuerst einen Fahrgast wählen.");
      return;
    }
    setSpeichert(true);
    setFehler(null);
    setErfolg(null);
    try {
      const { probleme } = await fahrtAnlegen({ ...eingabe, passengerId: fahrgast.id });
      setErfolg(
        probleme.length > 0
          ? `Fahrt angelegt, aber mit Hinweis: ${probleme.join(", ")}`
          : "Fahrt angelegt.",
      );
      setEingabe(LEER);
      setFahrgast(null);
      setFormularOffen(false);
      router.refresh();
    } catch {
      setFehler("Konnte nicht gespeichert werden. Bitte Angaben prüfen.");
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Fahrten</h1>
        <div className="flex items-center gap-3">
          <TextField
            label="Datum"
            type="date"
            value={datum}
            onChange={(event) => wechselDatum(event.target.value)}
          />
          <Button type="button" onClick={() => setFormularOffen(!formularOffen)} className="mt-6">
            Fahrt manuell anlegen
          </Button>
        </div>
      </div>

      {erfolg ? <p className="text-sm text-accent">{erfolg}</p> : null}

      {formularOffen ? (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-ink">Neue Fahrt</h2>
          <div className="flex flex-col gap-4">
            <FahrgastAuswahl wert={fahrgast} onChange={setFahrgast} />

            <div className="grid gap-4 sm:grid-cols-2">
              <OrtAuswahl
                titel="Abholadresse"
                orte={orte}
                wert={eingabe.pickupPlaceId}
                onChange={(id) => setEingabe({ ...eingabe, pickupPlaceId: id })}
              />
              <OrtAuswahl
                titel="Zieladresse"
                orte={orte}
                wert={eingabe.dropoffPlaceId}
                onChange={(id) => setEingabe({ ...eingabe, dropoffPlaceId: id })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                label="Datum"
                type="date"
                value={eingabe.datum}
                onChange={(event) => setEingabe({ ...eingabe, datum: event.target.value })}
              />
              <TextField
                label="Abholzeit"
                type="time"
                value={eingabe.abholzeit}
                onChange={(event) => setEingabe({ ...eingabe, abholzeit: event.target.value })}
              />
              <TextField
                label="Termin am Ziel (optional)"
                type="time"
                value={eingabe.terminzeit}
                onChange={(event) => setEingabe({ ...eingabe, terminzeit: event.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  checked={eingabe.rueckfahrt}
                  onChange={(event) => setEingabe({ ...eingabe, rueckfahrt: event.target.checked })}
                  className="h-5 w-5 rounded border-line-strong"
                />
                Rückfahrt nötig
              </label>
              {eingabe.rueckfahrt ? (
                <TextField
                  label="Rückfahrtzeit"
                  type="time"
                  value={eingabe.rueckfahrtzeit}
                  onChange={(event) => setEingabe({ ...eingabe, rueckfahrtzeit: event.target.value })}
                />
              ) : null}
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Beförderungsart</p>
              <div className="flex flex-wrap gap-2">
                {TRANSPORT_TYPES.map((typ) => (
                  <Tile
                    key={typ}
                    label={TRANSPORT_TYPE_LABEL[typ]}
                    active={eingabe.transportType === typ}
                    onClick={() => setEingabe({ ...eingabe, transportType: typ })}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">Transportschein vorhanden?</p>
                <div className="flex flex-wrap gap-2">
                  {DOC_STATUS.map((status) => (
                    <Tile
                      key={status}
                      label={DOC_STATUS_LABEL[status]}
                      active={eingabe.prescription === status}
                      onClick={() => setEingabe({ ...eingabe, prescription: status })}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">Genehmigung der Kasse?</p>
                <div className="flex flex-wrap gap-2">
                  {DOC_STATUS.map((status) => (
                    <Tile
                      key={status}
                      label={DOC_STATUS_LABEL[status]}
                      active={eingabe.approval === status}
                      onClick={() => setEingabe({ ...eingabe, approval: status })}
                    />
                  ))}
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={eingabe.companion}
                onChange={(event) => setEingabe({ ...eingabe, companion: event.target.checked })}
                className="h-5 w-5 rounded border-line-strong"
              />
              Begleitperson
            </label>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">Besonderheiten</label>
              <textarea
                value={eingabe.assistanceNotes}
                onChange={(event) => setEingabe({ ...eingabe, assistanceNotes: event.target.value })}
                rows={2}
                placeholder="z. B. Hilfe bis zur Wohnung, 3. OG ohne Aufzug"
                className="rounded-xl border border-line-strong bg-surface p-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </div>

            {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : null}

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={speichern}
                disabled={
                  speichert || !fahrgast || !eingabe.pickupPlaceId || !eingabe.dropoffPlaceId
                }
              >
                {speichert ? "Speichert …" : "Fahrt anlegen"}
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
          <TableHeaderCell>Zeit</TableHeaderCell>
          <TableHeaderCell>Fahrgast</TableHeaderCell>
          <TableHeaderCell>Von → Nach</TableHeaderCell>
          <TableHeaderCell>Art</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Fahrzeug</TableHeaderCell>
        </TableHead>
        <tbody>
          {fahrten.map((fahrt) => (
            <TableRow key={fahrt.id}>
              <TableCell nums>
                {new Date(fahrt.pickupAt).toLocaleTimeString("de-DE", {
                  timeZone: "Europe/Berlin",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </TableCell>
              <TableCell>
                {fahrt.passenger.firstName} {fahrt.passenger.lastName}
              </TableCell>
              <TableCell>
                {fahrt.pickupPlace.label} → {fahrt.dropoffPlace.label}
              </TableCell>
              <TableCell>{TRANSPORT_TYPE_LABEL[fahrt.transportType]}</TableCell>
              <TableCell>
                <Chip ton={STATUS_TON[fahrt.status]}>{STATUS_LABEL[fahrt.status]}</Chip>
                {fahrt.problems.length > 0 ? (
                  <div className="mt-1">
                    <Chip ton="danger">{fahrt.problems.join(", ")}</Chip>
                  </div>
                ) : null}
              </TableCell>
              <TableCell>
                {fahrt.vehicle ? (
                  fahrt.vehicle.plate
                ) : fahrt.status === "ERFASST" || fahrt.status === "VORGESCHLAGEN" ? (
                  <VorschlagAktion
                    rideId={fahrt.id}
                    beste={
                      (fahrt.suggestions?.[0]?.options as VorschlagOption[] | undefined)?.[0] ?? null
                    }
                    fahrzeuge={fahrzeuge}
                    onErledigt={() => router.refresh()}
                  />
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
          {fahrten.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <span className="text-muted">Keine Fahrten an diesem Tag.</span>
              </TableCell>
            </TableRow>
          ) : null}
        </tbody>
      </Table>
    </div>
  );
}
