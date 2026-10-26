"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { fahrzeugWaehlen } from "@/app/dispo/fahrten/actions";

export type VorschlagOption = {
  vehicleId: string;
  plate: string;
  etaMin: number;
  onTime: boolean;
  score: number;
  reason: string;
};

export function VorschlagAktion({
  rideId,
  beste,
  fahrzeuge,
  onErledigt,
}: {
  rideId: string;
  beste: VorschlagOption | null;
  fahrzeuge: { id: string; plate: string }[];
  onErledigt: () => void;
}) {
  const [andereOffen, setAndereOffen] = useState(false);
  const [laedt, setLaedt] = useState(false);

  async function waehlen(vehicleId: string) {
    if (!vehicleId) return;
    setLaedt(true);
    try {
      await fahrzeugWaehlen(rideId, vehicleId);
      onErledigt();
    } finally {
      setLaedt(false);
    }
  }

  if (!beste) {
    return (
      <select
        defaultValue=""
        onChange={(event) => waehlen(event.target.value)}
        disabled={laedt}
        className="h-10 rounded-lg border border-line-strong bg-surface px-2 text-sm text-ink"
      >
        <option value="">Fahrzeug wählen</option>
        {fahrzeuge.map((f) => (
          <option key={f.id} value={f.id}>
            {f.plate}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="text-right text-sm">
        <span className="font-medium text-ink">Vorschlag: {beste.plate}</span>
        <div className="mt-0.5">
          <Chip ton={beste.onTime ? "accent" : "warn"}>{beste.reason}</Chip>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={() => waehlen(beste.vehicleId)} disabled={laedt}>
          {laedt ? "…" : "Bestätigen"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setAndereOffen(!andereOffen)}>
          Anderes Fahrzeug
        </Button>
      </div>
      {andereOffen ? (
        <select
          defaultValue=""
          onChange={(event) => waehlen(event.target.value)}
          disabled={laedt}
          className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm text-ink"
        >
          <option value="">– wählen –</option>
          {fahrzeuge.map((f) => (
            <option key={f.id} value={f.id}>
              {f.plate}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
