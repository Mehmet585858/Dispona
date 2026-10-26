"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { SignOutButton } from "@/components/SignOutButton";
import { TRANSPORT_TYPE_LABEL } from "@/core/rides/validation";
import type { RideStatus } from "@/generated/prisma/enums";
import { fahrerFaelltAus, fahrtStatusSetzenFahrer, problemMelden, schichtAktion, type ProblemArt } from "./actions";
import { PushAktivieren } from "./PushAktivieren";

type Ort = { label: string; street: string; zip: string; city: string; lat: number; lng: number };

export type FahrerFahrt = {
  id: string;
  pickupAt: Date | string;
  appointmentAt: Date | string | null;
  status: RideStatus;
  transportType: keyof typeof TRANSPORT_TYPE_LABEL;
  companion: boolean;
  assistanceNotes: string | null;
  passenger: { firstName: string; lastName: string; phones: string[] };
  pickupPlace: Ort;
  dropoffPlace: Ort;
};

type Schicht = {
  id: string;
  start: Date | string;
  end: Date | string;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  onBreak: boolean;
  vehicle: { plate: string };
};

const STATUS_CHIP: Partial<Record<RideStatus, { label: string; ton: "neutral" | "warn" | "info" | "danger" | "accent" }>> = {
  DISPONIERT: { label: "Geplant", ton: "neutral" },
  UNTERWEGS: { label: "Unterwegs", ton: "info" },
  AN_BORD: { label: "Fahrgast an Bord", ton: "accent" },
  ERLEDIGT: { label: "Erledigt", ton: "accent" },
  NICHT_ANGETROFFEN: { label: "Nicht angetroffen", ton: "warn" },
  PROBLEM: { label: "Problem", ton: "danger" },
};

const NAECHSTER_SCHRITT: Partial<Record<RideStatus, { label: string; next: RideStatus }>> = {
  DISPONIERT: { label: "Losgefahren", next: "UNTERWEGS" },
  UNTERWEGS: { label: "Fahrgast an Bord", next: "AN_BORD" },
  AN_BORD: { label: "Erledigt", next: "ERLEDIGT" },
};

const ABGESCHLOSSEN: RideStatus[] = ["ERLEDIGT", "NICHT_ANGETROFFEN", "PROBLEM"];

function uhrzeit(datum: Date | string): string {
  return new Date(datum).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
}

function kurzOrt(ort: Ort): string {
  return `${ort.label}, ${ort.street}`;
}

function navigationsLink(ort: Ort): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${ort.lat},${ort.lng}`;
}

export function FahrerClient({
  name,
  schichten,
  fahrten,
  laufendeSchichtId,
}: {
  name: string;
  schichten: Schicht[];
  fahrten: FahrerFahrt[];
  laufendeSchichtId: string | null;
}) {
  const [istLaufend, startTransition] = useTransition();
  const [aktuelleFahrten, setAktuelleFahrten] = useState(fahrten);
  const [problemOffen, setProblemOffen] = useState(false);

  const laufendeSchicht = schichten.find((s) => s.id === laufendeSchichtId) ?? null;

  const aktiveFahrten = useMemo(
    () =>
      aktuelleFahrten
        .filter((f) => !ABGESCHLOSSEN.includes(f.status))
        .sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime()),
    [aktuelleFahrten],
  );
  const naechsteFahrt = aktiveFahrten[0] ?? null;
  const danach = aktiveFahrten.slice(1);
  const erledigtHeute = aktuelleFahrten.filter((f) => f.status === "ERLEDIGT").length;

  function statusSetzen(rideId: string, status: RideStatus) {
    startTransition(async () => {
      await fahrtStatusSetzenFahrer(rideId, status);
      setAktuelleFahrten((vorher) => vorher.map((f) => (f.id === rideId ? { ...f, status } : f)));
    });
  }

  function schicht(aktion: "start" | "pause" | "weiter" | "beenden") {
    if (!laufendeSchicht) return;
    startTransition(async () => {
      await schichtAktion(laufendeSchicht.id, aktion);
    });
  }

  function problem(rideId: string, art: ProblemArt) {
    startTransition(async () => {
      await problemMelden(rideId, art);
      if (art === "FAHRGAST_NICHT_DA") {
        setAktuelleFahrten((vorher) => vorher.map((f) => (f.id === rideId ? { ...f, status: "NICHT_ANGETROFFEN" } : f)));
      } else if (art === "FAHRZEUG_DEFEKT") {
        setAktuelleFahrten((vorher) => vorher.map((f) => (f.id === rideId ? { ...f, status: "PROBLEM" } : f)));
      }
      setProblemOffen(false);
    });
  }

  function ausfall() {
    startTransition(async () => {
      await fahrerFaelltAus();
      setAktuelleFahrten((vorher) =>
        vorher.map((f) =>
          f.status === "DISPONIERT" || f.status === "UNTERWEGS" || f.status === "AN_BORD"
            ? { ...f, status: "PROBLEM" }
            : f,
        ),
      );
      setProblemOffen(false);
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4 pb-28">
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-ink">Guten Tag, {name}</h1>
            <p className="text-sm text-ink-soft">
              Heute {aktuelleFahrten.length} {aktuelleFahrten.length === 1 ? "Fahrt" : "Fahrten"}
              {erledigtHeute > 0 ? ` · ${erledigtHeute} erledigt` : ""}
              {laufendeSchicht ? ` · ${laufendeSchicht.vehicle.plate}` : ""}
            </p>
          </div>
          <SignOutButton />
        </div>

        {laufendeSchicht ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {!laufendeSchicht.startedAt ? (
              <Button type="button" onClick={() => schicht("start")} disabled={istLaufend}>
                Schicht starten
              </Button>
            ) : laufendeSchicht.endedAt ? (
              <Chip ton="neutral">Schicht beendet</Chip>
            ) : (
              <>
                {laufendeSchicht.onBreak ? (
                  <Button type="button" variant="secondary" onClick={() => schicht("weiter")} disabled={istLaufend}>
                    Weiter
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" onClick={() => schicht("pause")} disabled={istLaufend}>
                    Pause
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={() => schicht("beenden")} disabled={istLaufend}>
                  Schicht beenden
                </Button>
              </>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-soft">Heute ist keine Schicht für Sie eingetragen.</p>
        )}

        <div className="mt-4">
          <PushAktivieren />
        </div>
      </Card>

      {naechsteFahrt ? (
        <Card className="border-accent">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-semibold tabular-nums text-ink">{uhrzeit(naechsteFahrt.pickupAt)}</span>
            {STATUS_CHIP[naechsteFahrt.status] ? (
              <Chip ton={STATUS_CHIP[naechsteFahrt.status]!.ton}>{STATUS_CHIP[naechsteFahrt.status]!.label}</Chip>
            ) : null}
          </div>
          <p className="mt-2 text-lg font-medium text-ink">
            {naechsteFahrt.passenger.firstName} {naechsteFahrt.passenger.lastName}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {kurzOrt(naechsteFahrt.pickupPlace)} → {kurzOrt(naechsteFahrt.dropoffPlace)}
          </p>
          {naechsteFahrt.appointmentAt ? (
            <p className="mt-1 text-sm text-ink-soft">Termin: {uhrzeit(naechsteFahrt.appointmentAt)}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip ton="neutral">{TRANSPORT_TYPE_LABEL[naechsteFahrt.transportType]}</Chip>
            {naechsteFahrt.companion ? <Chip ton="neutral">Begleitperson</Chip> : null}
            {naechsteFahrt.assistanceNotes ? <Chip ton="info">{naechsteFahrt.assistanceNotes}</Chip> : null}
          </div>

          <div className="mt-4 flex gap-2">
            {naechsteFahrt.passenger.phones[0] ? (
              <a
                href={`tel:${naechsteFahrt.passenger.phones[0]}`}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-line-strong bg-surface px-4 text-base font-medium text-ink hover:bg-accent-soft"
              >
                Fahrgast anrufen
              </a>
            ) : null}
            <a
              href={navigationsLink(naechsteFahrt.status === "AN_BORD" ? naechsteFahrt.dropoffPlace : naechsteFahrt.pickupPlace)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-line-strong bg-surface px-4 text-base font-medium text-ink hover:bg-accent-soft"
            >
              Navigation starten
            </a>
          </div>

          {NAECHSTER_SCHRITT[naechsteFahrt.status] ? (
            <button
              type="button"
              disabled={istLaufend}
              onClick={() => statusSetzen(naechsteFahrt.id, NAECHSTER_SCHRITT[naechsteFahrt.status]!.next)}
              className="mt-4 flex min-h-16 w-full items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-surface transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {istLaufend ? "…" : NAECHSTER_SCHRITT[naechsteFahrt.status]!.label}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setProblemOffen((offen) => !offen)}
            className="mt-3 w-full text-sm font-medium text-danger-ink underline-offset-2 hover:underline"
          >
            Problem melden
          </button>

          {problemOffen ? (
            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-line bg-ground p-3">
              <p className="text-sm font-medium text-ink-soft">Verspätung</p>
              <div className="flex gap-2">
                {(["VERSPAETUNG_10", "VERSPAETUNG_20", "VERSPAETUNG_30"] as const).map((art) => (
                  <Button
                    key={art}
                    type="button"
                    variant="secondary"
                    disabled={istLaufend}
                    onClick={() => problem(naechsteFahrt.id, art)}
                    className="flex-1"
                  >
                    +{art.split("_")[1]} Min
                  </Button>
                ))}
              </div>
              {naechsteFahrt.status === "UNTERWEGS" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={istLaufend}
                  onClick={() => problem(naechsteFahrt.id, "FAHRGAST_NICHT_DA")}
                >
                  Fahrgast nicht da
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                disabled={istLaufend}
                onClick={() => problem(naechsteFahrt.id, "FAHRZEUG_DEFEKT")}
              >
                Fahrzeug defekt
              </Button>
              <button
                type="button"
                disabled={istLaufend}
                onClick={ausfall}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-danger-bg px-5 text-base font-medium text-danger-ink transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ich falle aus
              </button>
            </div>
          ) : null}
        </Card>
      ) : (
        <Card className="text-center text-ink-soft">Keine weiteren Fahrten heute oder morgen.</Card>
      )}

      {danach.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink-soft">Danach</h2>
          <div className="flex flex-col gap-2">
            {danach.map((fahrt) => (
              <Card key={fahrt.id} className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold tabular-nums text-ink">{uhrzeit(fahrt.pickupAt)}</span>
                  {STATUS_CHIP[fahrt.status] ? (
                    <Chip ton={STATUS_CHIP[fahrt.status]!.ton}>{STATUS_CHIP[fahrt.status]!.label}</Chip>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-ink">
                  {fahrt.passenger.firstName} {fahrt.passenger.lastName}
                </p>
                <p className="text-sm text-ink-soft">
                  {kurzOrt(fahrt.pickupPlace)} → {kurzOrt(fahrt.dropoffPlace)}
                </p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
