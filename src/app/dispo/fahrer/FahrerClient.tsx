"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CsvImport } from "@/components/CsvImport";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { Chip } from "@/components/ui/Chip";
import { Hinweisbox } from "@/components/ui/Hinweisbox";
import { InfoTag } from "@/components/ui/InfoTag";
import { SelectField } from "@/components/ui/SelectField";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { TextField } from "@/components/ui/TextField";
import { FAHRER_IMPORT_FELDER, type FahrerEinladenEingabe } from "@/core/drivers/validation";
import { authClient } from "@/lib/auth-client";
import {
  aushilfeSetzen,
  einweisungSetzen,
  fahrerDeaktivieren,
  fahrerEinladen,
  fahrerGeraetAbmelden,
  fahrerGeraeteLaden,
  fahrerImportieren,
} from "./actions";
import { FAHRER_TEXTE as T } from "./texte";

type Person = {
  id: string;
  active: boolean;
  istAushilfe: boolean;
  scalamobilEinweisung: boolean;
  user: { id: string; name: string; phone: string | null; email: string };
};

/**
 * Personalverwaltung (vorher „Fahrer & Schichten“): Fahrer und Aushilfen einladen, Aushilfe und
 * Scalamobil-Einweisung pflegen, Geräte abmelden, deaktivieren. Schichten plant der Schichtplan
 * (/dispo/schichtplan); das frühere Schicht-Muster ist dort aufgegangen.
 */
export function FahrerClient({ fahrer: anfangsPersonal, istAdmin = true }: { fahrer: Person[]; istAdmin?: boolean }) {
  const router = useRouter();
  const [personal, setPersonal] = useState(anfangsPersonal);
  // Nach router.refresh() kommen neue Daten als Prop – dann die Liste übernehmen (React-Muster:
  // State beim Rendern an eine geänderte Prop anpassen, statt in einem Effect).
  const [letzteProp, setLetzteProp] = useState(anfangsPersonal);
  if (anfangsPersonal !== letzteProp) {
    setLetzteProp(anfangsPersonal);
    setPersonal(anfangsPersonal);
  }

  const [einladenOffen, setEinladenOffen] = useState(false);
  const [einladeEingabe, setEinladeEingabe] = useState<FahrerEinladenEingabe>({ name: "", phone: "", istAushilfe: false });
  const [einladeStatus, setEinladeStatus] = useState<string | null>(null);
  const [einladeFehler, setEinladeFehler] = useState<string | null>(null);

  const [zeilenFehler, setZeilenFehler] = useState<string | null>(null);
  const [deaktivierenId, setDeaktivierenId] = useState<string | null>(null);

  const [geraeteId, setGeraeteId] = useState(anfangsPersonal[0]?.id ?? "");
  const [geraete, setGeraete] = useState<{ id: string; createdAt: Date; updatedAt: Date; userAgent: string | null }[]>([]);
  const [geraeteLaedt, setGeraeteLaedt] = useState(false);
  const [geraeteGeladen, setGeraeteGeladen] = useState(false);

  function setzeLokal(id: string, teil: Partial<Person>) {
    setPersonal((liste) => liste.map((p) => (p.id === id ? { ...p, ...teil } : p)));
  }

  async function einladen() {
    setEinladeFehler(null);
    setEinladeStatus(null);
    try {
      const { email } = await fahrerEinladen(einladeEingabe);
      const { error } = await authClient.signIn.magicLink({ email, callbackURL: "/" });
      setEinladeStatus(error ? T.einladungOhneLink(error.message ?? "Unbekannter Fehler.") : T.einladungGesendet);
      setEinladeEingabe({ name: "", phone: "", istAushilfe: false });
      router.refresh();
    } catch {
      setEinladeFehler(T.einladungFehler);
    }
  }

  async function einweisung(person: Person, wert: boolean) {
    setZeilenFehler(null);
    try {
      const ergebnis = await einweisungSetzen(person.id, wert);
      if (!ergebnis.ok) {
        setZeilenFehler(ergebnis.fehler);
        return;
      }
      setzeLokal(person.id, { scalamobilEinweisung: wert });
    } catch {
      setZeilenFehler(T.aenderungFehler);
    }
  }

  async function aushilfe(person: Person, wert: boolean) {
    setZeilenFehler(null);
    try {
      await aushilfeSetzen(person.id, wert);
      setzeLokal(person.id, { istAushilfe: wert });
    } catch {
      setZeilenFehler(T.aenderungFehler);
    }
  }

  /** Offboarding (Maßnahme M-12): zweistufig, zerstörende Aktion immer mit Rückfrage (Design-Guide 5.1). */
  async function deaktivieren(id: string) {
    setZeilenFehler(null);
    try {
      await fahrerDeaktivieren(id);
      setzeLokal(id, { active: false });
      setDeaktivierenId(null);
    } catch {
      setZeilenFehler(T.deaktivierenFehler);
    }
  }

  async function geraeteLaden(id: string) {
    setGeraeteId(id);
    setGeraeteLaedt(true);
    try {
      setGeraete(await fahrerGeraeteLaden(id));
      setGeraeteGeladen(true);
    } finally {
      setGeraeteLaedt(false);
    }
  }

  async function geraetAbmelden(sessionId: string) {
    await fahrerGeraetAbmelden(geraeteId, sessionId);
    await geraeteLaden(geraeteId);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{T.titel}</h1>
          <p className="text-sm text-muted">
            {T.untertitel}{" "}
            <Link href="/dispo/schichtplan" className="font-semibold text-accent hover:underline">
              {T.zumSchichtplan}
            </Link>
          </p>
        </div>
        <div className="flex gap-3">
          <CsvImport titel="Personal" felder={FAHRER_IMPORT_FELDER} onImport={fahrerImportieren} />
          <Button type="button" onClick={() => setEinladenOffen(!einladenOffen)}>
            {T.einladen}
          </Button>
        </div>
      </div>

      {einladenOffen ? (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-ink">{T.einladenTitel}</h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <TextField label={T.name} value={einladeEingabe.name} onChange={(e) => setEinladeEingabe({ ...einladeEingabe, name: e.target.value })} />
            <TextField
              label={T.handy}
              value={einladeEingabe.phone}
              onChange={(e) => setEinladeEingabe({ ...einladeEingabe, phone: e.target.value })}
              placeholder="+49 170 1234567"
            />
            <Button type="button" onClick={einladen}>
              {T.einladenKnopf}
            </Button>
          </div>
          <div className="mt-3">
            <CheckboxField
              label={T.aushilfe}
              hint={T.aushilfeHinweis}
              checked={!!einladeEingabe.istAushilfe}
              onChange={(e) => setEinladeEingabe({ ...einladeEingabe, istAushilfe: e.target.checked })}
            />
          </div>
          {einladeStatus ? <p className="mt-3 text-sm text-accent">{einladeStatus}</p> : null}
          {einladeFehler ? <p className="mt-3 text-sm text-danger-ink">{einladeFehler}</p> : null}
        </Card>
      ) : null}

      {zeilenFehler ? <Hinweisbox ton="fehler">{zeilenFehler}</Hinweisbox> : null}

      {personal.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-surface p-4 text-sm text-muted">{T.keinPersonal}</p>
      ) : (
        <Table>
          <TableHead>
            <TableHeaderCell>{T.spalteName}</TableHeaderCell>
            <TableHeaderCell>{T.spalteRolle}</TableHeaderCell>
            <TableHeaderCell>{T.spalteEinweisung}</TableHeaderCell>
            <TableHeaderCell>{T.spalteStatus}</TableHeaderCell>
          </TableHead>
          <tbody>
            {personal.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {p.user.name}
                    {p.istAushilfe ? <InfoTag>{T.rolleAushilfe}</InfoTag> : null}
                  </span>
                </TableCell>
                <TableCell>
                  <CheckboxField
                    label={T.rolleAushilfe}
                    aria-label={T.aushilfeLabel(p.user.name)}
                    checked={p.istAushilfe}
                    disabled={!p.active}
                    onChange={(e) => aushilfe(p, e.target.checked)}
                  />
                </TableCell>
                <TableCell>
                  <CheckboxField
                    label="Eingewiesen"
                    aria-label={T.einweisungLabel(p.user.name)}
                    checked={p.scalamobilEinweisung}
                    disabled={!p.active}
                    onChange={(e) => einweisung(p, e.target.checked)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    {p.active ? <Chip>{T.aktiv}</Chip> : <Chip>{T.deaktiviert}</Chip>}
                    {p.active && istAdmin ? (
                      deaktivierenId === p.id ? (
                        <button type="button" onClick={() => deaktivieren(p.id)} className="text-left text-xs font-semibold text-danger-ink hover:underline">
                          {T.deaktivierenBestaetigen}
                        </button>
                      ) : (
                        <button type="button" onClick={() => setDeaktivierenId(p.id)} className="text-xs font-semibold text-danger-ink hover:underline">
                          {T.deaktivieren}
                        </button>
                      )
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      )}

      <Card>
        <h2 className="mb-2 text-lg font-semibold text-ink">{T.geraeteTitel}</h2>
        <p className="mb-3 text-sm text-muted">{T.geraeteHinweis}</p>
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label={T.person}
            value={geraeteId}
            onChange={(e) => {
              setGeraeteGeladen(false);
              setGeraeteId(e.target.value);
            }}
          >
            {personal.map((p) => (
              <option key={p.id} value={p.id}>
                {p.user.name}
              </option>
            ))}
          </SelectField>
          <Button type="button" variant="secondary" onClick={() => geraeteLaden(geraeteId)} disabled={geraeteLaedt || !geraeteId}>
            {geraeteLaedt ? T.geraeteLaedt : T.geraeteAnzeigen}
          </Button>
        </div>
        {geraeteGeladen ? (
          <div className="mt-4 flex flex-col gap-2">
            {geraete.length === 0 ? (
              <p className="text-sm text-muted">{T.keineGeraete}</p>
            ) : (
              geraete.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm">
                  <span className="text-ink-soft">
                    {T.zuletztAktiv(new Date(g.updatedAt).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }))}
                    {g.userAgent ? ` · ${g.userAgent.slice(0, 40)}` : ""}
                  </span>
                  <button type="button" onClick={() => geraetAbmelden(g.id)} className="font-semibold text-danger-ink hover:underline">
                    {T.abmelden}
                  </button>
                </div>
              ))
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
