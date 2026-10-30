"use client";

// Rein lesbare Variante des internen Zeitstrahls (src/app/dispo/fahrten/Zeitstrahl.tsx) für die
// öffentliche Live-Demo: keine Buttons, kein Ziehen, kein Klick öffnet etwas - bewusst dupliziert
// statt des interaktiven Original-Bausteins wiederverwendet, weil dessen Verschieben-per-Ziehen
// serverseitig eine Anmeldung voraussetzt (requireSession) und bei einem anonymen Besucher nur
// mit einer unbehandelten Fehlermeldung und einer für immer "hängenden" Kachel enden würde.
import { chipStil } from "@/core/rides/transportfarbe";
import { TRANSPORT_TYPE_LABEL } from "@/core/rides/validation";
import { zeitstrahlBreite, zeitstrahlPosition } from "@/core/shifts/zeitstrahl";
import {
  ZEITSTRAHL_BREITE_PX,
  PX_PRO_STUNDE,
  STUNDEN_TICKS,
  istAlarmFahrt,
  kurzname,
  px,
  uhrzeit,
  zustandFuerFahrt,
  type FahrtMini,
  type FahrzeugZeile,
} from "@/app/dispo/fahrten/Zeitstrahl";

export type SimulierteZeitstrahlFahrt = {
  vehicleId: string;
  pickupAt: Date;
  geplantesEnde: Date;
  fahrgast: string;
  transport: string;
};

export function LiveZeitstrahl({
  fahrten,
  fahrzeugZeilen,
  jetztProzent,
  simulierteFahrt,
}: {
  fahrten: FahrtMini[];
  fahrzeugZeilen: FahrzeugZeile[];
  jetztProzent: number | null;
  /** Rein clientseitig erfundene Beispiel-Fahrt (siehe SimulierterAnruf.tsx) - deutlich anders
   * gestaltet (gestrichelt, gedämpfte Farbe) als echte Fahrten, damit sie nie mit einer echten
   * verwechselt wird. */
  simulierteFahrt?: SimulierteZeitstrahlFahrt | null;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <div className="flex flex-col gap-y-2 p-4" style={{ width: 230 + ZEITSTRAHL_BREITE_PX }}>
        <div className="flex items-center gap-x-2">
          <div className="sticky left-0 z-10 w-[230px] flex-none bg-surface shadow-[2px_0_6px_-2px_rgba(16,24,32,0.12)]" />
          <div className="relative h-5 flex-none text-xs text-muted" style={{ width: ZEITSTRAHL_BREITE_PX }}>
            {STUNDEN_TICKS.map((stunde) => (
              <span key={stunde} className="absolute -translate-x-1/2" style={{ left: stunde * PX_PRO_STUNDE }}>
                {String(stunde).padStart(2, "0")}:00
              </span>
            ))}
          </div>
        </div>

        {fahrzeugZeilen.map((zeile) => (
          <div key={zeile.id} className="flex items-center gap-x-2">
            <div
              className="sticky left-0 z-10 w-[230px] flex-none bg-surface shadow-[2px_0_6px_-2px_rgba(16,24,32,0.12)]"
              title={zeile.plate}
            >
              <p className="font-semibold text-ink">{zeile.plate}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{zeile.typ}</p>
            </div>
            <div className="relative h-14 rounded-md bg-ground" style={{ width: ZEITSTRAHL_BREITE_PX }}>
              {jetztProzent !== null ? (
                <div className="absolute inset-y-0 w-px bg-now" style={{ left: px(jetztProzent) }} />
              ) : null}
              {fahrten
                .filter((f) => f.vehicleId === zeile.id)
                .map((fahrt) => (
                  <div
                    key={fahrt.id}
                    title={`${uhrzeit(fahrt.pickupAt)}–${uhrzeit(fahrt.geplantesEnde)} ${fahrt.passenger.firstName} ${fahrt.passenger.lastName}`}
                    className={`absolute top-1.5 bottom-1.5 flex flex-col justify-center overflow-hidden rounded-md px-2 text-left text-xs leading-tight ${istAlarmFahrt(fahrt) ? "ring-2 ring-danger-ink" : ""}`}
                    style={{
                      left: px(zeitstrahlPosition(fahrt.pickupAt)),
                      width: Math.max(px(zeitstrahlBreite(fahrt.pickupAt, fahrt.geplantesEnde)), 92),
                      ...chipStil(fahrt.transportType, zustandFuerFahrt(fahrt)),
                    }}
                  >
                    <span className="font-mono text-[11px]">{uhrzeit(fahrt.pickupAt)}</span>
                    <span className="truncate font-semibold">
                      {kurzname(fahrt.passenger.firstName, fahrt.passenger.lastName)}
                    </span>
                    <span className="truncate text-[10px] opacity-80">{TRANSPORT_TYPE_LABEL[fahrt.transportType]}</span>
                  </div>
                ))}
              {simulierteFahrt && simulierteFahrt.vehicleId === zeile.id ? (
                <div
                  title={`Beispiel: ${uhrzeit(simulierteFahrt.pickupAt)}–${uhrzeit(simulierteFahrt.geplantesEnde)} ${simulierteFahrt.fahrgast}`}
                  className="absolute top-1.5 bottom-1.5 flex flex-col justify-center overflow-hidden rounded-md border-2 border-dashed border-line-strong bg-surface/90 px-2 text-left text-xs leading-tight text-ink-soft"
                  style={{
                    left: px(zeitstrahlPosition(simulierteFahrt.pickupAt)),
                    width: Math.max(px(zeitstrahlBreite(simulierteFahrt.pickupAt, simulierteFahrt.geplantesEnde)), 92),
                  }}
                >
                  <span className="font-mono text-[11px]">{uhrzeit(simulierteFahrt.pickupAt)}</span>
                  <span className="truncate font-semibold">Beispiel · {simulierteFahrt.fahrgast}</span>
                  <span className="truncate text-[10px] opacity-80">{simulierteFahrt.transport}</span>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
