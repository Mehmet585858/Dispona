"use client";

import { Fragment, useMemo, useState } from "react";
import { CsvImport } from "@/components/CsvImport";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { TextField } from "@/components/ui/TextField";
import { Tile } from "@/components/ui/Tile";
import {
  FAHRER_IMPORT_FELDER,
  type FahrerEinladenEingabe,
  type SchichtMusterEingabe,
} from "@/core/drivers/validation";
import { fahrzeugArtLabel } from "@/core/vehicles/validation";
import {
  berlinerMitternacht,
  datumIso,
  montagVerschieben,
  wochenTage,
  WOCHENTAG_KURZ,
} from "@/core/shifts/week";
import { authClient } from "@/lib/auth-client";
import {
  fahrerEinladen,
  fahrerGeraetAbmelden,
  fahrerGeraeteLaden,
  fahrerImportieren,
  schichtenFuerWoche,
  schichtLöschen,
  schichtMusterAnlegen,
} from "./actions";

type Fahrer = { id: string; user: { id: string; name: string; phone: string | null; email: string } };
type Fahrzeug = {
  id: string;
  plate: string;
  wheelchairSpots: number;
  carryChair: boolean;
  stretcher: boolean;
};
type Schicht = {
  id: string;
  driverId: string;
  vehicleId: string;
  start: Date;
  end: Date;
  vehicle: { plate: string };
};

function uhrzeit(datum: Date): string {
  return new Date(datum).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function FahrerClient({
  fahrer,
  fahrzeuge,
  anfangsSchichten,
  anfangsMontag,
}: {
  fahrer: Fahrer[];
  fahrzeuge: Fahrzeug[];
  anfangsSchichten: Schicht[];
  anfangsMontag: string;
}) {
  const [montag, setMontag] = useState(anfangsMontag);
  const [schichten, setSchichten] = useState(anfangsSchichten);
  const [lädtWoche, setLädtWoche] = useState(false);

  const [einladenOffen, setEinladenOffen] = useState(false);
  const [einladeEingabe, setEinladeEingabe] = useState<FahrerEinladenEingabe>({ name: "", phone: "" });
  const [einladeStatus, setEinladeStatus] = useState<string | null>(null);
  const [einladeFehler, setEinladeFehler] = useState<string | null>(null);

  const [musterEingabe, setMusterEingabe] = useState<SchichtMusterEingabe>({
    driverId: fahrer[0]?.id ?? "",
    vehicleId: fahrzeuge[0]?.id ?? "",
    wochentage: [0, 1, 2, 3, 4],
    start: "06:00",
    end: "14:00",
  });
  const [musterFehler, setMusterFehler] = useState<string | null>(null);
  const [musterSpeichert, setMusterSpeichert] = useState(false);

  const [geraeteFahrerId, setGeraeteFahrerId] = useState(fahrer[0]?.id ?? "");
  const [geraete, setGeraete] = useState<{ id: string; createdAt: Date; updatedAt: Date; userAgent: string | null }[]>([]);
  const [geraeteLaedt, setGeraeteLaedt] = useState(false);
  const [geraeteGeladen, setGeraeteGeladen] = useState(false);

  const tage = useMemo(() => wochenTage(berlinerMitternacht(montag)), [montag]);

  async function wocheLaden(neuerMontagIso: string) {
    setLädtWoche(true);
    try {
      const ergebnis = await schichtenFuerWoche(neuerMontagIso);
      setMontag(neuerMontagIso);
      setSchichten(ergebnis);
    } finally {
      setLädtWoche(false);
    }
  }

  function wocheWechseln(richtung: -1 | 1) {
    wocheLaden(montagVerschieben(montag, richtung));
  }

  async function einladen() {
    setEinladeFehler(null);
    setEinladeStatus(null);
    try {
      const { email } = await fahrerEinladen(einladeEingabe);
      await authClient.signIn.magicLink({ email, callbackURL: "/" });
      setEinladeStatus(
        "Fahrer angelegt. Der Anmelde-Link wurde (im Entwicklungsmodus) ins Server-Terminal geschrieben – später kommt er per SMS.",
      );
      setEinladeEingabe({ name: "", phone: "" });
      await wocheLaden(montag);
    } catch {
      setEinladeFehler("Konnte nicht angelegt werden. Handynummer schon vergeben?");
    }
  }

  function wochentagUmschalten(index: number) {
    setMusterEingabe((aktuell) => ({
      ...aktuell,
      wochentage: aktuell.wochentage.includes(index)
        ? aktuell.wochentage.filter((w) => w !== index)
        : [...aktuell.wochentage, index].sort(),
    }));
  }

  async function musterAnlegen() {
    setMusterFehler(null);
    setMusterSpeichert(true);
    try {
      await schichtMusterAnlegen(musterEingabe, montag);
      await wocheLaden(montag);
    } catch {
      setMusterFehler("Konnte nicht angelegt werden.");
    } finally {
      setMusterSpeichert(false);
    }
  }

  async function schichtEntfernen(id: string) {
    await schichtLöschen(id);
    await wocheLaden(montag);
  }

  async function geraeteLaden(fahrerId: string) {
    setGeraeteFahrerId(fahrerId);
    setGeraeteLaedt(true);
    try {
      setGeraete(await fahrerGeraeteLaden(fahrerId));
      setGeraeteGeladen(true);
    } finally {
      setGeraeteLaedt(false);
    }
  }

  async function geraetAbmelden(sessionId: string) {
    await fahrerGeraetAbmelden(geraeteFahrerId, sessionId);
    await geraeteLaden(geraeteFahrerId);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Fahrer & Schichten</h1>
        <div className="flex gap-3">
          <CsvImport titel="Fahrer" felder={FAHRER_IMPORT_FELDER} onImport={fahrerImportieren} />
          <Button type="button" onClick={() => setEinladenOffen(!einladenOffen)}>
            Fahrer einladen
          </Button>
        </div>
      </div>

      {einladenOffen ? (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-ink">Neuen Fahrer einladen</h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <TextField
              label="Name"
              value={einladeEingabe.name}
              onChange={(event) => setEinladeEingabe({ ...einladeEingabe, name: event.target.value })}
            />
            <TextField
              label="Handynummer"
              value={einladeEingabe.phone}
              onChange={(event) => setEinladeEingabe({ ...einladeEingabe, phone: event.target.value })}
              placeholder="+49 170 1234567"
            />
            <Button type="button" onClick={einladen}>
              Einladen
            </Button>
          </div>
          {einladeStatus ? <p className="mt-3 text-sm text-accent">{einladeStatus}</p> : null}
          {einladeFehler ? <p className="mt-3 text-sm text-danger-ink">{einladeFehler}</p> : null}
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-ink">Schicht-Muster für diese Woche</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">Fahrer</label>
            <select
              value={musterEingabe.driverId}
              onChange={(event) => setMusterEingabe({ ...musterEingabe, driverId: event.target.value })}
              className="h-11 rounded-xl border border-line-strong bg-surface px-3 text-base text-ink"
            >
              {fahrer.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.user.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">Fahrzeug</label>
            <select
              value={musterEingabe.vehicleId}
              onChange={(event) => setMusterEingabe({ ...musterEingabe, vehicleId: event.target.value })}
              className="h-11 rounded-xl border border-line-strong bg-surface px-3 text-base text-ink"
            >
              {fahrzeuge.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} ({fahrzeugArtLabel(v)})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-medium text-ink">Wochentage</p>
          <div className="flex flex-wrap gap-2">
            {WOCHENTAG_KURZ.map((kurz, index) => (
              <Tile
                key={kurz}
                label={kurz}
                active={musterEingabe.wochentage.includes(index)}
                onClick={() => wochentagUmschalten(index)}
              />
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField
            label="Startzeit"
            type="time"
            value={musterEingabe.start}
            onChange={(event) => setMusterEingabe({ ...musterEingabe, start: event.target.value })}
          />
          <TextField
            label="Endzeit"
            type="time"
            value={musterEingabe.end}
            onChange={(event) => setMusterEingabe({ ...musterEingabe, end: event.target.value })}
          />
        </div>
        {musterFehler ? <p className="mt-3 text-sm text-danger-ink">{musterFehler}</p> : null}
        <Button
          type="button"
          className="mt-4"
          onClick={musterAnlegen}
          disabled={musterSpeichert || !musterEingabe.driverId || !musterEingabe.vehicleId}
        >
          {musterSpeichert ? "Legt an …" : "Für diese Woche anlegen"}
        </Button>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-ink">Geräte verwalten</h2>
        <p className="mb-3 text-sm text-muted">
          Ein abgemeldetes Gerät braucht beim nächsten Öffnen wieder einen neuen Anmelde-Link.
        </p>
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">Fahrer</label>
            <select
              value={geraeteFahrerId}
              onChange={(event) => {
                setGeraeteGeladen(false);
                setGeraeteFahrerId(event.target.value);
              }}
              className="h-11 rounded-xl border border-line-strong bg-surface px-3 text-base text-ink"
            >
              {fahrer.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.user.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" variant="secondary" onClick={() => geraeteLaden(geraeteFahrerId)} disabled={geraeteLaedt || !geraeteFahrerId}>
            {geraeteLaedt ? "Lädt …" : "Geräte anzeigen"}
          </Button>
        </div>
        {geraeteGeladen ? (
          <div className="mt-4 flex flex-col gap-2">
            {geraete.length === 0 ? (
              <p className="text-sm text-muted">Keine angemeldeten Geräte.</p>
            ) : (
              geraete.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm">
                  <span className="text-ink-soft">
                    Zuletzt aktiv {new Date(g.updatedAt).toLocaleString("de-DE")}
                    {g.userAgent ? ` · ${g.userAgent.slice(0, 40)}` : ""}
                  </span>
                  <button type="button" onClick={() => geraetAbmelden(g.id)} className="font-medium text-danger-ink hover:underline">
                    Abmelden
                  </button>
                </div>
              ))
            )}
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <Button type="button" variant="secondary" onClick={() => wocheWechseln(-1)} disabled={lädtWoche}>
            ‹ Vorherige Woche
          </Button>
          <h2 className="text-base font-semibold text-ink">
            {tage[0].toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} –{" "}
            {tage[6].toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </h2>
          <Button type="button" variant="secondary" onClick={() => wocheWechseln(1)} disabled={lädtWoche}>
            Nächste Woche ›
          </Button>
        </div>

        <div className="overflow-x-auto">
          <div className="grid min-w-[800px] grid-cols-[140px_repeat(7,1fr)] gap-px rounded-xl bg-line">
            <div className="bg-ground p-2" />
            {tage.map((tag, index) => (
              <div key={tag.toISOString()} className="bg-ground p-2 text-center text-xs font-medium text-muted">
                {WOCHENTAG_KURZ[index]} {tag.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
              </div>
            ))}
            {fahrer.map((f) => (
              <Fragment key={f.id}>
                <div className="flex items-center bg-surface p-2 text-sm font-medium text-ink">
                  {f.user.name}
                </div>
                {tage.map((tag) => {
                  const tagesSchichten = schichten.filter(
                    (s) => s.driverId === f.id && datumIso(new Date(s.start)) === datumIso(tag),
                  );
                  return (
                    <div key={`${f.id}-${tag.toISOString()}`} className="flex flex-col gap-1 bg-surface p-2">
                      {tagesSchichten.map((schicht) => (
                        <button
                          key={schicht.id}
                          type="button"
                          onClick={() => schichtEntfernen(schicht.id)}
                          title="Zum Entfernen klicken"
                        >
                          <Chip ton="accent">
                            {uhrzeit(schicht.start)}–{uhrzeit(schicht.end)} · {schicht.vehicle.plate}
                          </Chip>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
        {fahrer.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Noch keine Fahrer eingeladen.</p>
        ) : null}
      </Card>
    </div>
  );
}
