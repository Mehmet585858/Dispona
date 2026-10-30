"use client";

import { Chip } from "@/components/ui/Chip";
import { Modal } from "@/components/ui/Modal";
import { TransportBadge } from "@/components/ui/TransportBadge";
import type { TRANSPORT_TYPES } from "@/core/rides/validation";

export type LiveFahrtAnzeige = {
  titel: string;
  /** Echte Fahrten zeigen die farbige Transportart-Plakette, Beispiel-Fahrten nur den Text (die
   * Simulation kennt nur das deutsche Label, nicht den internen Transportart-Schlüssel). */
  transportArt?: (typeof TRANSPORT_TYPES)[number];
  transportLabel: string;
  statusLabel?: string;
  zeitraum: string;
  pickupLabel: string;
  dropoffLabel: string;
  vehiclePlate: string | null;
  fahrerName?: string | null;
  beispiel: boolean;
};

/** Rein lesende Fahrt-Details für die öffentliche Live-Demo (Klick auf eine Fahrt im Zeitstrahl,
 * siehe LiveZeitstrahl.tsx) - bewusst ein eigenes, einfaches Fenster statt des echten TripModal
 * (src/app/dispo/fahrten/TripModal.tsx): dessen Aktionen (Stornieren, Fahrzeug ändern, Anrufen)
 * brauchen alle eine Anmeldung und dürfen einem anonymen Besucher nie angeboten werden. */
export function LiveFahrtDetails({ fahrt, onClose }: { fahrt: LiveFahrtAnzeige; onClose: () => void }) {
  return (
    <Modal titel={fahrt.titel} onClose={onClose}>
      <div className="flex items-start justify-between gap-4 border-b border-line p-5">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {fahrt.transportArt ? (
              <TransportBadge art={fahrt.transportArt} variante="gefuellt" />
            ) : (
              <span className="text-sm text-ink-soft">{fahrt.transportLabel}</span>
            )}
            {fahrt.statusLabel ? <Chip ton="info">{fahrt.statusLabel}</Chip> : null}
            {fahrt.beispiel ? <Chip>Beispiel</Chip> : null}
          </div>
          <h2 className="text-xl font-semibold text-ink">{fahrt.titel}</h2>
          <p className="font-mono text-sm text-ink-soft">{fahrt.zeitraum}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Schließen" className="rounded-lg border border-line px-3 py-2 text-ink">
          ×
        </button>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted">Abholung</p>
          <p className="font-medium text-ink">{fahrt.pickupLabel}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Ziel</p>
          <p className="font-medium text-ink">{fahrt.dropoffLabel}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Fahrzeug</p>
          <p className="text-ink">{fahrt.vehiclePlate ?? "— noch nicht eingeplant"}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Besatzung</p>
          <p className="text-ink">{fahrt.fahrerName ?? "—"}</p>
        </div>
      </div>

      {fahrt.beispiel ? (
        <div className="mx-5 mb-5 rounded-xl bg-surface2 p-3 text-xs text-muted">
          Erfundene Beispiel-Fahrt, zeigt nur, wie ein Eintrag im Zeitstrahl aussieht - keine echten
          Daten, nirgends gespeichert.
        </div>
      ) : null}
    </Modal>
  );
}
