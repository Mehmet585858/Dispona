"use client";

import { useState, type FormEvent } from "react";
import { CsvImport } from "@/components/CsvImport";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { TextField } from "@/components/ui/TextField";
import { FAHRGAST_IMPORT_FELDER, type FahrgastEingabe } from "@/core/passengers/validation";
import {
  fahrgaesteImportieren,
  fahrgaesteLaden,
  fahrgastSpeichern,
  genehmigungLöschen,
  genehmigungSpeichern,
} from "./actions";

type Genehmigung = {
  id: string;
  validFrom: Date;
  validUntil: Date;
  maxRides: number | null;
  reference: string | null;
};

type Fahrgast = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  phones: string[];
  insurer: string | null;
  notes: string | null;
  approvals: Genehmigung[];
};

const LEER: FahrgastEingabe = { firstName: "", lastName: "", birthDate: "", phones: "", insurer: "", notes: "" };

function datumText(datum: Date | null): string {
  if (!datum) return "";
  return new Date(datum).toISOString().slice(0, 10);
}

export function FahrgaesteClient({ fahrgaeste: anfangsListe }: { fahrgaeste: Fahrgast[] }) {
  const [fahrgaeste, setFahrgaeste] = useState(anfangsListe);
  const [suchtext, setSuchtext] = useState("");
  const [sucht, setSucht] = useState(false);
  const [bearbeiteId, setBearbeiteId] = useState<string | null | "neu">(null);
  const [eingabe, setEingabe] = useState<FahrgastEingabe>(LEER);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [genehmigungEingabe, setGenehmigungEingabe] = useState({
    validFrom: "",
    validUntil: "",
    maxRides: "",
    reference: "",
  });

  async function suchen(event?: FormEvent) {
    event?.preventDefault();
    setSucht(true);
    try {
      const ergebnis = await fahrgaesteLaden(suchtext);
      setFahrgaeste(ergebnis);
    } finally {
      setSucht(false);
    }
  }

  function neuAnlegen() {
    setBearbeiteId("neu");
    setEingabe(LEER);
  }

  function bearbeiten(fahrgast: Fahrgast) {
    setBearbeiteId(fahrgast.id);
    setEingabe({
      firstName: fahrgast.firstName,
      lastName: fahrgast.lastName,
      birthDate: datumText(fahrgast.birthDate),
      phones: fahrgast.phones.join(", "),
      insurer: fahrgast.insurer ?? "",
      notes: fahrgast.notes ?? "",
    });
  }

  async function speichern() {
    setSpeichert(true);
    setFehler(null);
    try {
      await fahrgastSpeichern(bearbeiteId === "neu" ? null : bearbeiteId, eingabe);
      setBearbeiteId(null);
      await suchen();
    } catch {
      setFehler("Konnte nicht gespeichert werden.");
    } finally {
      setSpeichert(false);
    }
  }

  async function genehmigungAnlegen(passengerId: string) {
    if (!genehmigungEingabe.validFrom || !genehmigungEingabe.validUntil) return;
    await genehmigungSpeichern(passengerId, genehmigungEingabe);
    setGenehmigungEingabe({ validFrom: "", validUntil: "", maxRides: "", reference: "" });
    await suchen();
  }

  const bearbeiteterFahrgast =
    bearbeiteId && bearbeiteId !== "neu" ? fahrgaeste.find((f) => f.id === bearbeiteId) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Fahrgäste</h1>
        <div className="flex gap-3">
          <CsvImport titel="Fahrgäste" felder={FAHRGAST_IMPORT_FELDER} onImport={fahrgaesteImportieren} />
          <Button type="button" onClick={neuAnlegen}>
            Neuer Fahrgast
          </Button>
        </div>
      </div>

      <form onSubmit={suchen} className="flex max-w-md gap-3">
        <TextField
          label="Suche nach Name oder Telefonnummer"
          value={suchtext}
          onChange={(event) => setSuchtext(event.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={sucht} className="mt-7">
          {sucht ? "…" : "Suchen"}
        </Button>
      </form>

      {bearbeiteId ? (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-ink">
            {bearbeiteId === "neu" ? "Neuer Fahrgast" : "Fahrgast bearbeiten"}
          </h2>
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Vorname"
                value={eingabe.firstName}
                onChange={(event) => setEingabe({ ...eingabe, firstName: event.target.value })}
                autoFocus
              />
              <TextField
                label="Nachname"
                value={eingabe.lastName}
                onChange={(event) => setEingabe({ ...eingabe, lastName: event.target.value })}
              />
              <TextField
                label="Geburtsdatum"
                type="date"
                value={eingabe.birthDate}
                onChange={(event) => setEingabe({ ...eingabe, birthDate: event.target.value })}
              />
              <TextField
                label="Krankenkasse"
                value={eingabe.insurer}
                onChange={(event) => setEingabe({ ...eingabe, insurer: event.target.value })}
              />
            </div>
            <TextField
              label="Telefonnummer(n), durch Komma getrennt"
              value={eingabe.phones}
              onChange={(event) => setEingabe({ ...eingabe, phones: event.target.value })}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">Hinweise (nur organisatorisch, keine Diagnosen)</label>
              <textarea
                value={eingabe.notes}
                onChange={(event) => setEingabe({ ...eingabe, notes: event.target.value })}
                rows={3}
                className="rounded-xl border border-line-strong bg-surface p-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </div>
            {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : null}
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={speichern}
                disabled={speichert || !eingabe.firstName.trim() || !eingabe.lastName.trim()}
              >
                {speichert ? "Speichert …" : "Speichern"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setBearbeiteId(null)}>
                Abbrechen
              </Button>
            </div>
          </div>

          {bearbeiteterFahrgast ? (
            <div className="mt-6 border-t border-line pt-6">
              <h3 className="mb-3 text-base font-semibold text-ink">Genehmigungen der Krankenkasse</h3>
              <div className="flex flex-col gap-2">
                {bearbeiteterFahrgast.approvals.map((genehmigung) => (
                  <div
                    key={genehmigung.id}
                    className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm"
                  >
                    <span>
                      {datumText(genehmigung.validFrom)} bis {datumText(genehmigung.validUntil)}
                      {genehmigung.maxRides ? ` · max. ${genehmigung.maxRides} Fahrten` : ""}
                      {genehmigung.reference ? ` · ${genehmigung.reference}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await genehmigungLöschen(genehmigung.id);
                        await suchen();
                      }}
                      className="text-muted hover:text-danger-ink"
                    >
                      Entfernen
                    </button>
                  </div>
                ))}
                {bearbeiteterFahrgast.approvals.length === 0 ? (
                  <p className="text-sm text-muted">Noch keine Genehmigung hinterlegt.</p>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <TextField
                  label="Gültig ab"
                  type="date"
                  value={genehmigungEingabe.validFrom}
                  onChange={(event) =>
                    setGenehmigungEingabe({ ...genehmigungEingabe, validFrom: event.target.value })
                  }
                />
                <TextField
                  label="Gültig bis"
                  type="date"
                  value={genehmigungEingabe.validUntil}
                  onChange={(event) =>
                    setGenehmigungEingabe({ ...genehmigungEingabe, validUntil: event.target.value })
                  }
                />
                <TextField
                  label="Max. Fahrten"
                  type="number"
                  value={genehmigungEingabe.maxRides}
                  onChange={(event) =>
                    setGenehmigungEingabe({ ...genehmigungEingabe, maxRides: event.target.value })
                  }
                />
                <TextField
                  label="Aktenzeichen"
                  value={genehmigungEingabe.reference}
                  onChange={(event) =>
                    setGenehmigungEingabe({ ...genehmigungEingabe, reference: event.target.value })
                  }
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() => genehmigungAnlegen(bearbeiteterFahrgast.id)}
              >
                Genehmigung hinzufügen
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Table>
        <TableHead>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Geburtsdatum</TableHeaderCell>
          <TableHeaderCell>Telefon</TableHeaderCell>
          <TableHeaderCell>Krankenkasse</TableHeaderCell>
          <TableHeaderCell>Genehmigung</TableHeaderCell>
          <TableHeaderCell></TableHeaderCell>
        </TableHead>
        <tbody>
          {fahrgaeste.map((fahrgast) => (
            <TableRow key={fahrgast.id}>
              <TableCell>
                {fahrgast.firstName} {fahrgast.lastName}
              </TableCell>
              <TableCell nums>{datumText(fahrgast.birthDate) || "—"}</TableCell>
              <TableCell>{fahrgast.phones.join(", ") || "—"}</TableCell>
              <TableCell>{fahrgast.insurer || "—"}</TableCell>
              <TableCell>
                {fahrgast.approvals.length > 0 ? (
                  <Chip ton="info">{fahrgast.approvals.length}</Chip>
                ) : (
                  <Chip ton="neutral">keine</Chip>
                )}
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  onClick={() => bearbeiten(fahrgast)}
                  className="text-sm font-medium text-accent hover:underline"
                >
                  Bearbeiten
                </button>
              </TableCell>
            </TableRow>
          ))}
          {fahrgaeste.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <span className="text-muted">Keine Fahrgäste gefunden.</span>
              </TableCell>
            </TableRow>
          ) : null}
        </tbody>
      </Table>
    </div>
  );
}
