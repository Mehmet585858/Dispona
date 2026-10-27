"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { anrufTranskriptLaden } from "./actions";

type Fahrt = { id: string; pickupAt: Date; name: string };
type Anruf = {
  id: string;
  startedAt: Date;
  durationSec: number | null;
  fromNumber: string | null;
  summary: string | null;
  outcome: string | null;
  audioUrl: string | null;
  hatTranskript: boolean;
  fahrten: Fahrt[];
};

const OUTCOME_LABEL: Record<string, string> = {
  FAHRT_ERFASST: "Fahrt erfasst",
  FAHRT_GEAENDERT: "Fahrt geändert",
  FAHRT_STORNIERT: "Fahrt storniert",
  AUSKUNFT: "Auskunft",
  WEITERGELEITET: "Weitergeleitet",
  ABGEBROCHEN: "Abgebrochen",
  NOTFALL_HINWEIS: "Notfall-Hinweis",
};

function dauer(sek: number | null): string {
  if (sek === null) return "—";
  const minuten = Math.floor(sek / 60);
  const rest = sek % 60;
  return `${minuten}:${String(rest).padStart(2, "0")} Min.`;
}

function uhrzeit(datum: Date): string {
  return new Date(datum).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AnrufeClient({ anrufe }: { anrufe: Anruf[] }) {
  const [offenerAnruf, setOffenerAnruf] = useState<string | null>(null);
  const [transkripte, setTranskripte] = useState<Record<string, string | null>>({});
  const [laedt, setLaedt] = useState<string | null>(null);

  async function anrufOeffnen(anruf: Anruf) {
    if (offenerAnruf === anruf.id) {
      setOffenerAnruf(null);
      return;
    }
    setOffenerAnruf(anruf.id);
    if (anruf.hatTranskript && !(anruf.id in transkripte)) {
      setLaedt(anruf.id);
      const text = await anrufTranskriptLaden(anruf.id);
      setTranskripte((bisher) => ({ ...bisher, [anruf.id]: text }));
      setLaedt(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Anrufe</h1>

      {anrufe.length === 0 ? (
        <EmptyState text="Noch keine Anrufe. Sobald die KI am Telefon eingerichtet ist, erscheinen Gespräche hier." />
      ) : (
        <Table>
          <TableHead>
            <TableHeaderCell>Zeit</TableHeaderCell>
            <TableHeaderCell>Dauer</TableHeaderCell>
            <TableHeaderCell>Anrufer</TableHeaderCell>
            <TableHeaderCell>Ergebnis</TableHeaderCell>
            <TableHeaderCell>Zusammenfassung</TableHeaderCell>
          </TableHead>
          <tbody>
            {anrufe.map((anruf) => (
              <Fragment key={anruf.id}>
                <TableRow>
                  <TableCell nums>
                    <button type="button" onClick={() => anrufOeffnen(anruf)} className="text-left hover:underline">
                      {uhrzeit(anruf.startedAt)}
                    </button>
                  </TableCell>
                  <TableCell nums>{dauer(anruf.durationSec)}</TableCell>
                  <TableCell>{anruf.fromNumber ?? "—"}</TableCell>
                  <TableCell>
                    {anruf.outcome ? <Chip ton="accent">{OUTCOME_LABEL[anruf.outcome] ?? anruf.outcome}</Chip> : "—"}
                  </TableCell>
                  <TableCell>{anruf.summary ?? "—"}</TableCell>
                </TableRow>
                {offenerAnruf === anruf.id ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Card className="flex flex-col gap-3">
                        {anruf.audioUrl ? (
                          <audio controls src={anruf.audioUrl} className="w-full" />
                        ) : (
                          <p className="text-sm text-muted">Keine Aufnahme verfügbar.</p>
                        )}

                        {anruf.fahrten.length > 0 ? (
                          <div>
                            <p className="mb-1 text-sm font-medium text-ink">Verknüpfte Fahrten</p>
                            <div className="flex flex-col gap-1">
                              {anruf.fahrten.map((f) => (
                                <Link
                                  key={f.id}
                                  href={`/dispo/fahrten?datum=${new Date(f.pickupAt).toISOString().slice(0, 10)}`}
                                  className="text-sm text-accent hover:underline"
                                >
                                  {uhrzeit(f.pickupAt)} · {f.name}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div>
                          <p className="mb-1 text-sm font-medium text-ink">Transkript</p>
                          {laedt === anruf.id ? (
                            <p className="text-sm text-muted">Lädt …</p>
                          ) : anruf.hatTranskript ? (
                            <p className="whitespace-pre-wrap text-sm text-ink-soft">
                              {transkripte[anruf.id] ?? "Kein Transkript verfügbar."}
                            </p>
                          ) : (
                            <p className="text-sm text-muted">Kein Transkript verfügbar.</p>
                          )}
                        </div>
                      </Card>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
