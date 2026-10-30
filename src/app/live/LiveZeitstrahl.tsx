"use client";

// Rein lesbare Variante des internen Zeitstrahls (src/app/dispo/fahrten/Zeitstrahl.tsx) für die
// öffentliche Live-Demo: kein Ziehen (das Verschieben-per-Ziehen braucht serverseitig eine
// Anmeldung und würde bei einem anonymen Besucher nur mit einer unbehandelten Fehlermeldung und
// einer für immer "hängenden" Kachel enden) - ein Klick öffnet aber, genau wie im echten
// Dashboard, ein rein lesendes Detail-Fenster (LiveFahrtDetails.tsx), ohne jede Aktion, die eine
// Anmeldung bräuchte. Layout, Kopfzeile, Live-Status pro Fahrzeug und Legende sind aus dem
// Original importiert statt nachgebaut, damit beide Ansichten nie wieder auseinanderlaufen.
import { useState } from "react";
import { chipStil } from "@/core/rides/transportfarbe";
import { TRANSPORT_TYPE_LABEL } from "@/core/rides/validation";
import { ZEITSTRAHL_ENDE_STUNDE, ZEITSTRAHL_START_STUNDE, zeitstrahlBreite, zeitstrahlPosition } from "@/core/shifts/zeitstrahl";
import {
  LIVE_PUNKT_FARBE,
  Legende,
  PX_PRO_STUNDE,
  STUNDEN_TICKS,
  ZEITSTRAHL_BREITE_PX,
  istAlarmFahrt,
  kurzname,
  px,
  uhrzeit,
  zustandFuerFahrt,
  type FahrtMini,
  type FahrzeugZeile,
} from "@/app/dispo/fahrten/Zeitstrahl";
import { LiveFahrtDetails, type LiveFahrtAnzeige } from "./LiveFahrtDetails";

export type SimulierteZeitstrahlFahrt = {
  id: string;
  vehicleId: string;
  pickupAt: Date;
  geplantesEnde: Date;
  fahrgast: string;
  transport: string;
};

// Spiegelt TripModal.tsx (src/app/dispo/fahrten/TripModal.tsx) - dort nicht exportiert, weil als
// Seiten-internes Detail gedacht; hier dupliziert statt importiert, damit die Live-Demo nicht von
// einem Baustein des angemeldeten Bereichs abhängt.
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

export function LiveZeitstrahl({
  fahrten,
  fahrzeugZeilen,
  jetztProzent,
  simulierteFahrten,
}: {
  fahrten: (FahrtMini & { fahrerName: string | null })[];
  fahrzeugZeilen: FahrzeugZeile[];
  jetztProzent: number | null;
  /** Rein clientseitig erfundene Beispiel-Fahrten (siehe SimulierterAnruf.tsx) - sammeln sich über
   * die Sitzung und bleiben stehen (wie im echten Dashboard), statt beim nächsten simulierten
   * Anruf zu verschwinden. Deutlich anders gestaltet (gestrichelt, gedämpfte Farbe) als echte
   * Fahrten, damit sie nie mit einer echten verwechselt werden. */
  simulierteFahrten?: SimulierteZeitstrahlFahrt[];
}) {
  const [offeneFahrt, setOffeneFahrt] = useState<LiveFahrtAnzeige | null>(null);
  const unterwegsCount = fahrten.filter((f) => f.status === "UNTERWEGS" || f.status === "AN_BORD").length;
  const verspaetetCount = fahrten.filter((f) => !!f.driverDelayMin && f.driverDelayMin > 0).length;

  function echteFahrtOeffnen(fahrt: (typeof fahrten)[number]) {
    setOffeneFahrt({
      titel: `${fahrt.passenger.firstName} ${fahrt.passenger.lastName}`,
      transportArt: fahrt.transportType,
      transportLabel: TRANSPORT_TYPE_LABEL[fahrt.transportType],
      statusLabel: STATUS_LABEL[fahrt.status] ?? fahrt.status,
      zeitraum: `${uhrzeit(fahrt.pickupAt)}–${uhrzeit(fahrt.geplantesEnde)}`,
      pickupLabel: fahrt.pickupPlace.label,
      dropoffLabel: fahrt.dropoffPlace.label,
      vehiclePlate: fahrt.vehicle?.plate ?? null,
      fahrerName: fahrt.fahrerName,
      beispiel: false,
    });
  }

  function beispielFahrtOeffnen(simulierteFahrt: SimulierteZeitstrahlFahrt, plate: string) {
    setOffeneFahrt({
      titel: `Beispiel · ${simulierteFahrt.fahrgast}`,
      transportLabel: simulierteFahrt.transport,
      zeitraum: `${uhrzeit(simulierteFahrt.pickupAt)}–${uhrzeit(simulierteFahrt.geplantesEnde)}`,
      pickupLabel: "—",
      dropoffLabel: "—",
      vehiclePlate: plate,
      beispiel: true,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-2 text-sm">
        <b className="text-ink">
          {fahrzeugZeilen.length} Fahrzeuge · {String(ZEITSTRAHL_START_STUNDE).padStart(2, "0")}–
          {String(ZEITSTRAHL_ENDE_STUNDE).padStart(2, "0")} Uhr
        </b>
        <span className="ml-auto text-ink-soft">
          {fahrten.length} Fahrten · {unterwegsCount} unterwegs · {verspaetetCount} verspätet
        </span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <div className="flex flex-col gap-y-2 p-4" style={{ width: 230 + ZEITSTRAHL_BREITE_PX }}>
          <div className="flex items-center gap-x-2">
            <div className="sticky left-0 z-10 w-[230px] flex-none bg-surface shadow-[2px_0_6px_-2px_rgba(16,24,32,0.12)]" />
            <div className="relative h-5 flex-none text-xs text-muted" style={{ width: ZEITSTRAHL_BREITE_PX }}>
              {STUNDEN_TICKS.map((stunde) => (
                <span
                  key={stunde}
                  className="absolute -translate-x-1/2"
                  style={{ left: (stunde - ZEITSTRAHL_START_STUNDE) * PX_PRO_STUNDE }}
                >
                  {String(stunde).padStart(2, "0")}:00
                </span>
              ))}
            </div>
          </div>

          {fahrzeugZeilen.map((zeile) => (
            <div key={zeile.id} className="flex items-center gap-x-2">
              <div
                className="sticky left-0 z-10 w-[230px] flex-none bg-surface shadow-[2px_0_6px_-2px_rgba(16,24,32,0.12)]"
                title={`${zeile.plate} · ${zeile.typ} · ${zeile.fahrerNamen || "ohne Fahrer"}`}
              >
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink">{zeile.plate}</p>
                  {zeile.fahrerNamen ? (
                    <span className="truncate rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-ink-soft">
                      {zeile.fahrerNamen}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: LIVE_PUNKT_FARBE[zeile.live.punkt] }}
                  />
                  <span
                    className="font-medium"
                    style={{ color: zeile.live.punkt === "late" ? "var(--live-late-text)" : "var(--color-ink)" }}
                  >
                    {zeile.live.label}
                  </span>
                  <span className="truncate text-muted">· {zeile.live.zusatz}</span>
                </p>
              </div>
              <div className="relative h-14 rounded-md bg-ground" style={{ width: ZEITSTRAHL_BREITE_PX }}>
                {jetztProzent !== null ? (
                  <div className="absolute inset-y-0 w-px bg-now" style={{ left: px(jetztProzent) }} />
                ) : null}
                {fahrten
                  .filter((f) => f.vehicleId === zeile.id || (!f.vehicleId && f.vorschlagVehicleId === zeile.id))
                  .map((fahrt) => (
                    <button
                      key={fahrt.id}
                      type="button"
                      onClick={() => echteFahrtOeffnen(fahrt)}
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
                    </button>
                  ))}
                {(simulierteFahrten ?? [])
                  .filter((f) => f.vehicleId === zeile.id)
                  .map((simulierteFahrt) => (
                    <button
                      key={simulierteFahrt.id}
                      type="button"
                      onClick={() => beispielFahrtOeffnen(simulierteFahrt, zeile.plate)}
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
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Legende />
      {offeneFahrt ? <LiveFahrtDetails fahrt={offeneFahrt} onClose={() => setOffeneFahrt(null)} /> : null}
    </div>
  );
}
