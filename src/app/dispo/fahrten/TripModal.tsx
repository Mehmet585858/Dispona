"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Modal } from "@/components/ui/Modal";
import { TransportBadge } from "@/components/ui/TransportBadge";
import { VorschlagAktion, type VorschlagOption } from "@/components/VorschlagAktion";
import { DOC_STATUS_LABEL } from "@/core/rides/validation";
import { datumIso } from "@/core/shifts/week";
import { fahrtStornieren } from "./actions";
import type { FahrtMini } from "./Zeitstrahl";

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
  UNTERWEGS: "Fährt zum Fahrgast",
  AN_BORD: "Fahrgast im Auto",
  ERLEDIGT: "Fahrgast am Ziel",
  NICHT_ANGETROFFEN: "Nicht angetroffen",
  STORNIERT: "Storniert",
  PROBLEM: "Problem",
};

const ABLAUF_SCHRITTE = ["Geplant", "Fährt zum Fahrgast", "Fahrgast im Auto", "Fahrgast am Ziel"];
const SCHRITT_FUER_STATUS: Record<string, number> = {
  DISPONIERT: 0,
  UNTERWEGS: 1,
  AN_BORD: 2,
  ERLEDIGT: 3,
};

function uhrzeit(datum: Date): string {
  return new Date(datum).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
}

/** "heute" nur, wenn die Fahrt wirklich heute ist – sonst Wochentag + Datum, sonst wirkt eine
 * Fahrt von gestern/morgen (über die ‹/›-Pfeile im Zeitstrahl erreichbar) irreführend "heutig". */
function tagLabel(datum: Date): string {
  if (datumIso(datum) === datumIso(new Date())) return "heute";
  return new Date(datum).toLocaleDateString("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export function TripModal({
  fahrt,
  grund,
  fahrzeuge,
  onClose,
}: {
  fahrt: FahrtMini & { fahrerName: string | null };
  grund?: string;
  fahrzeuge: { id: string; plate: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [fahrzeugAendernOffen, setFahrzeugAendernOffen] = useState(false);
  const [storniertBestaetigen, setStorniertBestaetigen] = useState(false);
  const [storniert, setStorniert] = useState(false);

  function aktualisieren() {
    router.refresh();
    onClose();
  }

  async function stornieren() {
    setStorniert(true);
    try {
      await fahrtStornieren(fahrt.id);
      aktualisieren();
    } finally {
      setStorniert(false);
    }
  }

  const schritt = SCHRITT_FUER_STATUS[fahrt.status];
  const telefon = fahrt.passenger.phones?.[0];

  return (
    <Modal titel={`${fahrt.passenger.firstName} ${fahrt.passenger.lastName}`} onClose={onClose} breit>
      <div className="flex items-start justify-between gap-4 border-b border-line p-5">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <TransportBadge art={fahrt.transportType} variante="gefuellt" />
            <Chip ton={STATUS_TON[fahrt.status] ?? "neutral"}>{STATUS_LABEL[fahrt.status] ?? fahrt.status}</Chip>
          </div>
          <h2 className="text-xl font-semibold text-ink">
            {fahrt.passenger.firstName} {fahrt.passenger.lastName}
          </h2>
          <p className="font-mono text-sm text-ink-soft">
            {tagLabel(fahrt.pickupAt)} {uhrzeit(fahrt.pickupAt)}–{uhrzeit(fahrt.geplantesEnde)}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Schließen" className="rounded-lg border border-line px-3 py-2 text-ink">
          ×
        </button>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted">Abholung</p>
          <p className="font-medium text-ink">{fahrt.pickupPlace.label}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Ziel</p>
          <p className="font-medium text-ink">{fahrt.dropoffPlace.label}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Fahrzeug</p>
          <p className="text-ink">{fahrt.vehicle?.plate ?? "— noch nicht eingeplant"}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Besatzung</p>
          <p className="text-ink">{fahrt.fahrerName ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Kostenträger</p>
          <p className="text-ink">{fahrt.passenger.insurer ?? "unbekannt"}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Transportschein / Genehmigung</p>
          <p className="text-ink">
            {DOC_STATUS_LABEL[fahrt.prescription as keyof typeof DOC_STATUS_LABEL] ?? fahrt.prescription} ·{" "}
            {DOC_STATUS_LABEL[fahrt.approval as keyof typeof DOC_STATUS_LABEL] ?? fahrt.approval}
          </p>
        </div>
      </div>

      {grund ? (
        <div className="mx-5 mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-warn-bd bg-warn-bg p-3">
          <p className="text-sm text-warn-ink">
            <strong>Braucht Sie:</strong> {grund}
          </p>
          <div className="ml-auto">
            <VorschlagAktion
              rideId={fahrt.id}
              beste={(fahrt.suggestions?.[0]?.options as VorschlagOption[] | undefined)?.[0] ?? null}
              fahrzeuge={fahrzeuge}
              onErledigt={aktualisieren}
            />
          </div>
        </div>
      ) : null}

      {schritt !== undefined ? (
        <div className="px-5 pb-2">
          <p className="mb-2 text-xs text-muted">Ablauf</p>
          <div className="flex gap-2">
            {ABLAUF_SCHRITTE.map((titel, index) => (
              <div key={titel} className="flex-1">
                <div
                  className={`mb-1.5 h-1.5 rounded-full ${
                    index <= schritt || fahrt.status === "ERLEDIGT" ? "bg-accent" : "bg-line"
                  }`}
                />
                <p className={`text-xs ${index <= schritt ? "font-medium text-ink" : "text-muted"}`}>{titel}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {fahrt.assistanceNotes ? (
        <div className="mx-5 mb-5 rounded-xl bg-surface2 p-3 text-sm text-ink-soft">
          <p className="mb-1 text-xs font-medium text-muted">Hinweise</p>
          {fahrt.assistanceNotes}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-line bg-surface2 p-4">
        {telefon ? (
          <a href={`tel:${telefon}`} className="inline-flex min-h-11 items-center rounded-[10px] border border-line-strong bg-surface px-5 text-base font-semibold text-ink hover:bg-accent-soft">
            Anrufen
          </a>
        ) : null}
        <Button type="button" variant="secondary" onClick={() => setFahrzeugAendernOffen(!fahrzeugAendernOffen)}>
          Fahrzeug ändern
        </Button>
        {fahrzeugAendernOffen ? (
          <VorschlagAktion rideId={fahrt.id} beste={null} fahrzeuge={fahrzeuge} onErledigt={aktualisieren} />
        ) : null}
        <div className="ml-auto">
          {storniertBestaetigen ? (
            <Button type="button" variant="danger" onClick={stornieren} disabled={storniert}>
              {storniert ? "…" : "Wirklich stornieren?"}
            </Button>
          ) : (
            <Button type="button" variant="danger" onClick={() => setStorniertBestaetigen(true)}>
              Stornieren
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
