"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { TRANSPORT_TYPE_LABEL } from "@/core/rides/validation";
import { VorschlagAktion, type VorschlagOption } from "@/components/VorschlagAktion";
import type { RideStatus } from "@/generated/prisma/enums";

const AKTUALISIERUNG_MS = 5_000;

const ALARM_STATUS_LABEL: Partial<Record<RideStatus, string>> = {
  PROBLEM: "Problem",
  NICHT_ANGETROFFEN: "Nicht angetroffen",
};

const Karte = dynamic(() => import("@/components/Karte").then((m) => m.Karte), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 w-full items-center justify-center rounded-2xl bg-ground text-sm text-muted">
      Karte lädt …
    </div>
  ),
});

type Fahrt = {
  id: string;
  pickupAt: Date;
  transportType: keyof typeof TRANSPORT_TYPE_LABEL;
  passenger: { firstName: string; lastName: string };
  pickupPlace: { label: string };
  dropoffPlace: { label: string };
  vehicle?: { id: string; plate: string } | null;
  suggestions?: { options: unknown }[];
};

type AlarmFahrt = {
  id: string;
  pickupAt: Date;
  status: RideStatus;
  problems: string[];
  passenger: { firstName: string; lastName: string };
};

type LiegengebliebeneFahrt = {
  id: string;
  pickupAt: Date;
  autoSkipReason: string | null;
  passenger: { firstName: string; lastName: string };
};

function uhrzeit(datum: Date): string {
  return new Date(datum).toLocaleTimeString("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DispoClient({
  kennzahlen,
  bitteBestaetigen,
  tagesplan,
  alarme,
  fahrzeuge,
  serviceArea,
  automodusText,
  heuteNacht,
}: {
  kennzahlen: { fahrtenHeute: number; wartenAufSie: number; unterwegs: number; anrufeAngenommen: number };
  bitteBestaetigen: Fahrt[];
  tagesplan: Fahrt[];
  alarme: AlarmFahrt[];
  fahrzeuge: { id: string; plate: string; position: { lat: number; lng: number; at: Date } | null }[];
  serviceArea: { center: { lat: number; lng: number }; radiusKm: number; depot: { lat: number; lng: number } | null } | null;
  automodusText: string;
  heuteNacht: { automatischDisponiert: number; liegenGeblieben: LiegengebliebeneFahrt[] };
}) {
  const router = useRouter();

  useEffect(() => {
    const intervallId = setInterval(() => router.refresh(), AKTUALISIERUNG_MS);
    return () => clearInterval(intervallId);
  }, [router]);

  const nachFahrzeug = new Map<string, { plate: string; fahrten: Fahrt[] }>();
  for (const fahrt of tagesplan) {
    if (!fahrt.vehicle) continue;
    const eintrag = nachFahrzeug.get(fahrt.vehicle.id) ?? { plate: fahrt.vehicle.plate, fahrten: [] };
    eintrag.fahrten.push(fahrt);
    nachFahrzeug.set(fahrt.vehicle.id, eintrag);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-ink">Heute</h1>
        <Chip ton={automodusText.startsWith("Automodus: aus") ? "neutral" : "accent"}>{automodusText}</Chip>
      </div>

      {heuteNacht.automatischDisponiert > 0 || heuteNacht.liegenGeblieben.length > 0 ? (
        <Card className="flex flex-col gap-2">
          <h2 className="font-semibold text-ink">Heute Nacht</h2>
          <p className="text-sm text-ink-soft">
            {heuteNacht.automatischDisponiert} automatisch disponiert, {heuteNacht.liegenGeblieben.length} liegen
            geblieben
          </p>
          {heuteNacht.liegenGeblieben.length > 0 ? (
            <div className="mt-1 flex flex-col gap-1">
              {heuteNacht.liegenGeblieben.map((fahrt) => (
                <p key={fahrt.id} className="text-sm text-muted">
                  {uhrzeit(fahrt.pickupAt)} · {fahrt.passenger.firstName} {fahrt.passenger.lastName} ·{" "}
                  {fahrt.autoSkipReason}
                </p>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      {alarme.length > 0 ? (
        <div className="rounded-[14px] border border-warn-bd bg-warn-bg p-4">
          <p className="font-semibold text-warn-ink">
            {alarme.length} {alarme.length === 1 ? "Fahrt braucht" : "Fahrten brauchen"} Ihre Aufmerksamkeit
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {alarme.map((fahrt) => (
              <p key={fahrt.id} className="text-sm text-warn-ink">
                {uhrzeit(fahrt.pickupAt)} · {fahrt.passenger.firstName} {fahrt.passenger.lastName} ·{" "}
                {fahrt.problems.length > 0 ? fahrt.problems.join(", ") : (ALARM_STATUS_LABEL[fahrt.status] ?? fahrt.status)}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-sm text-muted">Fahrten heute</p>
          <p className="text-2xl font-semibold text-ink tabular-nums">{kennzahlen.fahrtenHeute}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Warten auf Sie</p>
          <p className="text-2xl font-semibold text-warn-ink tabular-nums">{kennzahlen.wartenAufSie}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Fahrzeuge unterwegs</p>
          <p className="text-2xl font-semibold text-ink tabular-nums">{kennzahlen.unterwegs}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Anrufe von der KI</p>
          <p className="text-2xl font-semibold text-ink tabular-nums">{kennzahlen.anrufeAngenommen}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">Bitte bestätigen ({bitteBestaetigen.length})</h2>
          {bitteBestaetigen.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">Nichts zu bestätigen.</p>
            </Card>
          ) : null}
          {bitteBestaetigen.map((fahrt) => {
            const beste = (fahrt.suggestions?.[0]?.options as VorschlagOption[] | undefined)?.[0] ?? null;
            return (
              <Card key={fahrt.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">
                      {uhrzeit(fahrt.pickupAt)} · {fahrt.passenger.firstName} {fahrt.passenger.lastName}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {fahrt.pickupPlace.label} → {fahrt.dropoffPlace.label}
                    </p>
                    <div className="mt-1">
                      <Chip ton="accent">{TRANSPORT_TYPE_LABEL[fahrt.transportType]}</Chip>
                    </div>
                  </div>
                  <VorschlagAktion
                    rideId={fahrt.id}
                    beste={beste}
                    fahrzeuge={fahrzeuge}
                    onErledigt={() => router.refresh()}
                  />
                </div>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">Fahrzeuge jetzt</h2>
          {serviceArea ? (
            <Karte
              zentrum={serviceArea.center}
              radiusKm={serviceArea.radiusKm}
              depot={serviceArea.depot}
              fahrzeuge={fahrzeuge}
            />
          ) : (
            <Card>
              <p className="text-sm text-muted">Kein Einsatzgebiet hinterlegt.</p>
            </Card>
          )}
          <p className="text-xs text-muted">
            Standort aus der Fahrer-App, aktualisiert alle 5 Sekunden. Fahrzeuge ohne eigene Meldung stehen am
            Betriebshof.
          </p>

          <h2 className="mt-2 text-lg font-semibold text-ink">Tagesplan</h2>
          {nachFahrzeug.size === 0 ? (
            <Card>
              <p className="text-sm text-muted">Noch keiner Fahrt ein Fahrzeug zugewiesen.</p>
            </Card>
          ) : null}
          {[...nachFahrzeug.values()].map((eintrag) => (
            <Card key={eintrag.plate}>
              <p className="mb-2 font-medium text-ink">{eintrag.plate}</p>
              <div className="flex flex-col gap-1.5">
                {eintrag.fahrten.map((fahrt) => (
                  <div key={fahrt.id} className="flex justify-between text-sm">
                    <span className="text-ink-soft">
                      {uhrzeit(fahrt.pickupAt)} {fahrt.passenger.firstName} {fahrt.passenger.lastName}
                    </span>
                    <span className="text-muted">
                      {fahrt.pickupPlace.label} → {fahrt.dropoffPlace.label}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
