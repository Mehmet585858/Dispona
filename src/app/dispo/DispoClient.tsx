"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { KpiTile } from "@/components/ui/KpiTile";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { Tile } from "@/components/ui/Tile";
import { TransportBadge } from "@/components/ui/TransportBadge";
import { VorschlagAktion, type VorschlagOption } from "@/components/VorschlagAktion";
import {
  DOC_STATUS,
  DOC_STATUS_LABEL,
  TRANSPORT_TYPE_LABEL,
  TRANSPORT_TYPES,
  type FahrtEingabe,
} from "@/core/rides/validation";
import { WOCHENTAGE, WOCHENTAG_LABEL, type Wochentag } from "@/core/shifts/rrule";
import { berlinerMitternacht, datumIso, montagVerschieben, tagVerschieben, wochenStart } from "@/core/shifts/week";
import { anrufTranskriptLaden } from "./anrufe/actions";
import { FahrgastAuswahl } from "./fahrten/FahrgastAuswahl";
import { OrtAuswahl } from "./fahrten/OrtAuswahl";
import { TripModal } from "./fahrten/TripModal";
import { fahrtAnlegen, serieAnlegen } from "./fahrten/actions";
import { Zeitstrahl, type FahrerZeile, type FahrtMini, type FahrzeugZeile } from "./fahrten/Zeitstrahl";

const AKTUALISIERUNG_MS = 10_000;

const Karte = dynamic(() => import("@/components/Karte").then((m) => m.Karte), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 w-full items-center justify-center rounded-2xl bg-ground text-sm text-muted">
      Karte lädt …
    </div>
  ),
});

type Fahrt = FahrtMini & { fahrerName: string | null };
type Ort = { id: string; label: string; street: string; city: string };
type Fahrzeug = { id: string; plate: string };
type KartenDaten = {
  fahrzeuge: { id: string; plate: string; position: { lat: number; lng: number } | null }[];
  serviceArea: { center: { lat: number; lng: number }; radiusKm: number; depot: { lat: number; lng: number } | null };
};
type BrauchtSieEintrag = { rideId: string; grund: string; beste: VorschlagOption | null };
type LiveAnruf = {
  id: string;
  startedAt: Date;
  fromNumber: string | null;
  fahrt: {
    id: string;
    pickupAt: Date;
    transportType: (typeof TRANSPORT_TYPES)[number];
    passenger: { firstName: string; lastName: string };
    pickupPlace: { label: string };
    dropoffPlace: { label: string };
    vehicle: { plate: string } | null;
  } | null;
};

const LEER: FahrtEingabe = {
  passengerId: "",
  pickupPlaceId: "",
  dropoffPlaceId: "",
  datum: datumIso(new Date()),
  abholzeit: "09:00",
  terminzeit: "",
  rueckfahrt: false,
  rueckfahrtzeit: "",
  transportType: "SITZEND",
  companion: false,
  assistanceNotes: "",
  prescription: "UNKLAR",
  approval: "NICHT_NOETIG",
};

function uhrzeit(datum: Date): string {
  return new Date(datum).toLocaleTimeString("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function minutenSeit(datum: Date): number {
  return Math.max(0, Math.round((Date.now() - new Date(datum).getTime()) / 60_000));
}

function BrauchtSieKarte({
  eintraege,
  fahrten,
  fahrzeuge,
  onOeffnen,
}: {
  eintraege: BrauchtSieEintrag[];
  fahrten: Fahrt[];
  fahrzeuge: Fahrzeug[];
  onOeffnen: (id: string) => void;
}) {
  const router = useRouter();
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">Hinweis</h2>
        {eintraege.length > 0 ? <Chip ton="warn">{eintraege.length}</Chip> : null}
      </div>
      <p className="text-sm text-muted">Dispona plant alles automatisch. Hier landet nur, was es nicht allein lösen kann.</p>
      {eintraege.length === 0 ? (
        <p className="text-sm text-muted">Gerade nichts offen.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {eintraege.map((eintrag) => {
            const fahrt = fahrten.find((f) => f.id === eintrag.rideId);
            if (!fahrt) return null;
            return (
              <div key={eintrag.rideId} className="flex flex-wrap items-center gap-2 rounded-xl border border-warn-bd bg-surface p-2.5">
                <span className="font-mono text-xs text-muted">{uhrzeit(fahrt.pickupAt)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <TransportBadge art={fahrt.transportType} />
                    <span className="font-medium text-ink">
                      {fahrt.passenger.firstName} {fahrt.passenger.lastName}
                    </span>
                  </div>
                  <p className="truncate text-xs text-warn-ink">{eintrag.grund}</p>
                </div>
                {!fahrt.vehicle ? (
                  <VorschlagAktion
                    rideId={eintrag.rideId}
                    beste={eintrag.beste}
                    fahrzeuge={fahrzeuge}
                    onErledigt={() => router.refresh()}
                  />
                ) : (
                  <Button type="button" variant="secondary" onClick={() => onOeffnen(eintrag.rideId)}>
                    Ansehen
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function AnrufKarte({ anruf }: { anruf: LiveAnruf }) {
  const [transkript, setTranskript] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let abgebrochen = false;
    anrufTranskriptLaden(anruf.id)
      .then((text) => {
        if (!abgebrochen) setTranskript(text);
      })
      .catch(() => {
        if (!abgebrochen) setTranskript(null);
      });
    return () => {
      abgebrochen = true;
    };
  }, [anruf.id]);

  return (
    <Card className="flex flex-col gap-3 border-line-strong">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        <b className="text-ink">Anruf läuft</b>
        <span className="ml-auto font-mono text-sm text-muted">seit {minutenSeit(anruf.startedAt)} Min.</span>
      </div>
      {anruf.fromNumber ? <p className="text-sm text-muted">{anruf.fromNumber}</p> : null}

      <div>
        <p className="mb-1 text-xs font-medium text-muted">Transkript</p>
        <div className="max-h-40 overflow-y-auto rounded-xl bg-surface2 p-3">
          {transkript === undefined ? (
            <p className="text-sm text-muted">Lädt …</p>
          ) : transkript ? (
            <p className="whitespace-pre-wrap text-sm text-ink-soft">{transkript}</p>
          ) : (
            <p className="text-sm text-muted">
              Noch kein Transkript verfügbar – erscheint hier, sobald Dispona Gesprächsabschnitte erkannt hat.
            </p>
          )}
        </div>
      </div>

      {anruf.fahrt ? (
        <div className="grid grid-cols-2 gap-2 border-t border-line pt-2.5 text-sm">
          <div>
            <p className="text-xs text-muted">Fahrgast</p>
            <p className="text-ink">
              {anruf.fahrt.passenger.firstName} {anruf.fahrt.passenger.lastName}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Transport</p>
            <p className="text-ink">{TRANSPORT_TYPE_LABEL[anruf.fahrt.transportType]}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Abholung</p>
            <p className="text-ink">{anruf.fahrt.pickupPlace.label}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Ziel</p>
            <p className="text-ink">{anruf.fahrt.dropoffPlace.label}</p>
          </div>
          {anruf.fahrt.vehicle ? (
            <div className="col-span-2">
              <p className="text-xs text-muted">Eingeplant bei</p>
              <p className="font-medium text-ink">{anruf.fahrt.vehicle.plate}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">Details erscheinen hier, sobald Dispona sie aus dem Gespräch erkannt hat.</p>
      )}
    </Card>
  );
}

export function DispoClient({
  paket,
  kennzahlen,
  brauchtSie,
  liveAnrufe,
  fahrten,
  fahrer,
  fahrzeugZeilen,
  karte,
  orte,
  fahrzeuge,
  datum,
  ansicht,
}: {
  paket: "LITE" | "PRO";
  kennzahlen: { fahrtenHeute: number; unterwegs: number; vonDisponaEingeplant: number; brauchtSie: number; anrufeHeute: number };
  brauchtSie: BrauchtSieEintrag[];
  liveAnrufe: LiveAnruf[];
  fahrten: Fahrt[];
  fahrer: FahrerZeile[];
  fahrzeugZeilen: FahrzeugZeile[];
  karte: KartenDaten | null;
  orte: Ort[];
  fahrzeuge: Fahrzeug[];
  datum: string;
  ansicht: "tag" | "woche";
}) {
  const router = useRouter();
  const [suche, setSuche] = useState("");
  const [neueFahrtOffen, setNeueFahrtOffen] = useState(false);
  const [offeneFahrtId, setOffeneFahrtId] = useState<string | null>(null);
  const [fahrgast, setFahrgast] = useState<{ id: string; name: string } | null>(null);
  const [eingabe, setEingabe] = useState<FahrtEingabe>(LEER);
  const [serieModus, setSerieModus] = useState(false);
  const [serieWochentage, setSerieWochentage] = useState<Wochentag[]>([]);
  const [serieBis, setSerieBis] = useState("");
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState<string | null>(null);

  useEffect(() => {
    const intervallId = setInterval(() => router.refresh(), AKTUALISIERUNG_MS);
    return () => clearInterval(intervallId);
  }, [router]);

  function wechselDatum(neuesDatum: string) {
    router.push(`/dispo?datum=${neuesDatum}`);
  }
  function tagWechseln(richtung: -1 | 1) {
    wechselDatum(tagVerschieben(datum, richtung));
  }
  function ansichtWechseln(neueAnsicht: "tag" | "woche") {
    router.push(`/dispo?datum=${datum}&ansicht=${neueAnsicht}`);
  }
  function wocheWechseln(richtung: -1 | 1) {
    const montag = datumIso(wochenStart(berlinerMitternacht(datum)));
    router.push(`/dispo?datum=${montagVerschieben(montag, richtung)}&ansicht=woche`);
  }

  const wochenStartIso = datumIso(wochenStart(berlinerMitternacht(datum)));
  const wochenEndeIso = (() => {
    const ende = new Date(berlinerMitternacht(wochenStartIso));
    ende.setDate(ende.getDate() + 6);
    return datumIso(ende);
  })();

  function formularSchliessen() {
    setNeueFahrtOffen(false);
    setEingabe(LEER);
    setFahrgast(null);
    setSerieModus(false);
    setSerieWochentage([]);
    setSerieBis("");
    setFehler(null);
  }

  async function speichern() {
    if (!fahrgast) {
      setFehler("Bitte zuerst einen Fahrgast wählen.");
      return;
    }
    if (serieModus && (serieWochentage.length === 0 || !serieBis)) {
      setFehler("Bitte Wochentage und ein Enddatum der Serie angeben.");
      return;
    }
    setSpeichert(true);
    setFehler(null);
    setErfolg(null);
    try {
      if (serieModus) {
        const ergebnis = await serieAnlegen({
          passengerId: fahrgast.id,
          pickupPlaceId: eingabe.pickupPlaceId,
          dropoffPlaceId: eingabe.dropoffPlaceId,
          wochentage: serieWochentage,
          abholzeit: eingabe.abholzeit,
          terminzeit: eingabe.terminzeit,
          rueckfahrt: eingabe.rueckfahrt,
          rueckfahrtzeit: eingabe.rueckfahrtzeit,
          bis: serieBis,
          transportType: eingabe.transportType,
          companion: eingabe.companion,
          assistanceNotes: eingabe.assistanceNotes,
          prescription: eingabe.prescription,
          approval: eingabe.approval,
        });
        const hinweise = [`Serie angelegt, ${ergebnis.erzeugteFahrten.length} Fahrten erzeugt.`];
        if (ergebnis.feiertagsHinweise.length > 0) {
          hinweise.push(
            `Feiertage im Zeitraum: ${ergebnis.feiertagsHinweise.map((f) => `${f.datum} (${f.name})`).join(", ")}.`,
          );
        }
        if (ergebnis.genehmigungsWarnung) hinweise.push(ergebnis.genehmigungsWarnung);
        setErfolg(hinweise.join(" "));
      } else {
        const { probleme } = await fahrtAnlegen({ ...eingabe, passengerId: fahrgast.id });
        setErfolg(probleme.length > 0 ? `Fahrt angelegt, aber mit Hinweis: ${probleme.join(", ")}` : "Fahrt angelegt.");
      }
      formularSchliessen();
      router.refresh();
    } catch {
      setFehler("Konnte nicht gespeichert werden. Bitte Angaben prüfen.");
    } finally {
      setSpeichert(false);
    }
  }

  const offeneFahrt = fahrten.find((f) => f.id === offeneFahrtId) ?? null;
  const offenerGrund = offeneFahrtId ? brauchtSie.find((b) => b.rideId === offeneFahrtId)?.grund : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3">
        <div className="flex gap-1.5 rounded-xl border border-line-strong p-1">
          <button
            type="button"
            onClick={() => ansichtWechseln("tag")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${ansicht === "tag" ? "bg-accent text-surface" : "text-ink-soft"}`}
          >
            Tag
          </button>
          <button
            type="button"
            onClick={() => ansichtWechseln("woche")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${ansicht === "woche" ? "bg-accent text-surface" : "text-ink-soft"}`}
          >
            Woche
          </button>
        </div>

        {ansicht === "tag" ? (
          <div className="flex items-center gap-1 rounded-xl bg-ground p-1">
            <button type="button" onClick={() => tagWechseln(-1)} aria-label="Vorheriger Tag" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-surface">
              ‹
            </button>
            <span className="px-2 text-sm font-semibold text-ink">
              {berlinerMitternacht(datum).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}
            </span>
            <button type="button" onClick={() => tagWechseln(1)} aria-label="Nächster Tag" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-surface">
              ›
            </button>
            {datum !== datumIso(new Date()) ? (
              <button type="button" onClick={() => wechselDatum(datumIso(new Date()))} className="ml-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-accent hover:bg-surface">
                Heute
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => wocheWechseln(-1)}>
              ‹ Vorherige Woche
            </Button>
            <span className="whitespace-nowrap text-sm font-medium text-ink">
              {berlinerMitternacht(wochenStartIso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
              {" – "}
              {berlinerMitternacht(wochenEndeIso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
            <Button type="button" variant="secondary" onClick={() => wocheWechseln(1)}>
              Nächste Woche ›
            </Button>
          </div>
        )}

        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-line px-3 py-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="text-muted">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={suche}
            onChange={(event) => setSuche(event.target.value)}
            placeholder="Patient, Fahrzeug oder Telefonnummer suchen …"
            aria-label="Suche"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
        </label>

        {liveAnrufe.length > 0 ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-2 text-sm font-semibold text-accent">
            <span className="h-2 w-2 rounded-full bg-accent" />
            Dispona · {liveAnrufe.length} {liveAnrufe.length === 1 ? "Anruf läuft" : "Anrufe laufen"}
          </span>
        ) : null}

        {paket === "PRO" ? (
          <a href="/dispo/auswertung" className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-line-strong bg-surface px-5 text-base font-semibold text-ink hover:bg-accent-soft">
            Fahrtenbuch
          </a>
        ) : null}
        <Button type="button" onClick={() => setNeueFahrtOffen(true)}>
          + Neue Fahrt
        </Button>
      </div>

      {erfolg ? <p className="text-sm text-accent">{erfolg}</p> : null}

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-1 basis-[640px] flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <KpiTile
              label="Fahrten heute"
              wert={kennzahlen.fahrtenHeute}
              zusatz={`· ${fahrten.filter((f) => f.status === "ERLEDIGT").length} erledigt`}
            />
            {paket === "PRO" ? <KpiTile label="Gerade unterwegs" wert={kennzahlen.unterwegs} /> : null}
            {paket === "PRO" ? <KpiTile label="Von Dispona eingeplant" wert={kennzahlen.vonDisponaEingeplant} zusatz="heute" /> : null}
            <KpiTile label="Braucht Sie" wert={kennzahlen.brauchtSie} warnstil={kennzahlen.brauchtSie > 0} />
            <KpiTile label="Anrufe heute" wert={kennzahlen.anrufeHeute} />
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
            {fahrten.length === 0 && (ansicht === "tag" ? fahrzeugZeilen.length === 0 : fahrer.length === 0) ? (
              <div>
                <p className="text-sm text-muted">{ansicht === "woche" ? "Keine Fahrten in dieser Woche." : "Keine Fahrten an diesem Tag."}</p>
                <Link href="/dispo/fahrer" className="mt-2 inline-block text-sm text-accent hover:underline">
                  Schichten verwalten, Fahrer einladen →
                </Link>
              </div>
            ) : (
              <Zeitstrahl
                fahrten={fahrten}
                fahrer={fahrer}
                fahrzeugZeilen={fahrzeugZeilen}
                suchbegriff={suche}
                datum={datum}
                ansicht={ansicht}
                onFahrtKlick={setOffeneFahrtId}
              />
            )}
          </div>
        </div>

        <div className="flex w-full flex-none flex-col gap-4 md:w-[380px]">
          {paket === "PRO" ? (
            <>
              {liveAnrufe.map((anruf) => (
                <AnrufKarte key={anruf.id} anruf={anruf} />
              ))}
              <BrauchtSieKarte eintraege={brauchtSie} fahrten={fahrten} fahrzeuge={fahrzeuge} onOeffnen={setOffeneFahrtId} />
            </>
          ) : (
            <Card>
              <p className="text-sm text-muted">
                Mit Dispona Lite erfasst Dispona Fahrtanfragen, plant sie aber nicht selbst ein. Die Übersicht dafür
                folgt – bis dahin sehen Sie neue Fahrten hier im Zeitstrahl ohne Fahrzeug.
              </p>
            </Card>
          )}
        </div>
      </div>

      {karte ? (
        <div className="flex flex-col gap-1">
          <Karte
            zentrum={karte.serviceArea.center}
            radiusKm={karte.serviceArea.radiusKm}
            depot={karte.serviceArea.depot}
            fahrzeuge={karte.fahrzeuge}
          />
          <p className="text-xs text-muted">Live-Standort aus der Fahrer-App, aktualisiert alle 10 Sekunden.</p>
        </div>
      ) : null}

      {neueFahrtOffen ? (
        <Modal titel={serieModus ? "Neue Serienfahrt" : "Neue Fahrt"} onClose={formularSchliessen} breit>
          <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto p-5">
            <h2 className="text-lg font-semibold text-ink">{serieModus ? "Neue Serienfahrt" : "Neue Fahrt"}</h2>
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={serieModus}
                onChange={(event) => setSerieModus(event.target.checked)}
                className="h-5 w-5 rounded border-line-strong"
              />
              Serie (wiederkehrend, z. B. Dialyse)
            </label>

            <FahrgastAuswahl wert={fahrgast} onChange={setFahrgast} />

            <div className="grid gap-4 sm:grid-cols-2">
              <OrtAuswahl
                titel="Abholadresse"
                orte={orte}
                wert={eingabe.pickupPlaceId}
                onChange={(id) => setEingabe({ ...eingabe, pickupPlaceId: id })}
              />
              <OrtAuswahl
                titel="Zieladresse"
                orte={orte}
                wert={eingabe.dropoffPlaceId}
                onChange={(id) => setEingabe({ ...eingabe, dropoffPlaceId: id })}
              />
            </div>

            {serieModus ? (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="mb-1.5 text-sm font-medium text-ink">Wochentage</p>
                  <div className="flex flex-wrap gap-2">
                    {WOCHENTAGE.map((tag) => (
                      <Tile
                        key={tag}
                        label={WOCHENTAG_LABEL[tag]}
                        active={serieWochentage.includes(tag)}
                        onClick={() =>
                          setSerieWochentage((bisher) =>
                            bisher.includes(tag) ? bisher.filter((t) => t !== tag) : [...bisher, tag],
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField
                    label="Abholzeit"
                    type="time"
                    value={eingabe.abholzeit}
                    onChange={(event) => setEingabe({ ...eingabe, abholzeit: event.target.value })}
                  />
                  <TextField
                    label="Termin am Ziel (optional)"
                    type="time"
                    value={eingabe.terminzeit}
                    onChange={(event) => setEingabe({ ...eingabe, terminzeit: event.target.value })}
                  />
                  <TextField label="Serie bis" type="date" value={serieBis} onChange={(event) => setSerieBis(event.target.value)} />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  label="Datum"
                  type="date"
                  value={eingabe.datum}
                  onChange={(event) => setEingabe({ ...eingabe, datum: event.target.value })}
                />
                <TextField
                  label="Abholzeit"
                  type="time"
                  value={eingabe.abholzeit}
                  onChange={(event) => setEingabe({ ...eingabe, abholzeit: event.target.value })}
                />
                <TextField
                  label="Termin am Ziel (optional)"
                  type="time"
                  value={eingabe.terminzeit}
                  onChange={(event) => setEingabe({ ...eingabe, terminzeit: event.target.value })}
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  checked={eingabe.rueckfahrt}
                  onChange={(event) => setEingabe({ ...eingabe, rueckfahrt: event.target.checked })}
                  className="h-5 w-5 rounded border-line-strong"
                />
                Rückfahrt nötig
              </label>
              {eingabe.rueckfahrt ? (
                <TextField
                  label="Rückfahrtzeit"
                  type="time"
                  value={eingabe.rueckfahrtzeit}
                  onChange={(event) => setEingabe({ ...eingabe, rueckfahrtzeit: event.target.value })}
                />
              ) : null}
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Beförderungsart</p>
              <div className="flex flex-wrap gap-2">
                {TRANSPORT_TYPES.map((typ) => (
                  <Tile
                    key={typ}
                    label={TRANSPORT_TYPE_LABEL[typ]}
                    active={eingabe.transportType === typ}
                    onClick={() => setEingabe({ ...eingabe, transportType: typ })}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">Transportschein vorhanden?</p>
                <div className="flex flex-wrap gap-2">
                  {DOC_STATUS.map((status) => (
                    <Tile
                      key={status}
                      label={DOC_STATUS_LABEL[status]}
                      active={eingabe.prescription === status}
                      onClick={() => setEingabe({ ...eingabe, prescription: status })}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">Genehmigung der Kasse?</p>
                <div className="flex flex-wrap gap-2">
                  {DOC_STATUS.map((status) => (
                    <Tile
                      key={status}
                      label={DOC_STATUS_LABEL[status]}
                      active={eingabe.approval === status}
                      onClick={() => setEingabe({ ...eingabe, approval: status })}
                    />
                  ))}
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={eingabe.companion}
                onChange={(event) => setEingabe({ ...eingabe, companion: event.target.checked })}
                className="h-5 w-5 rounded border-line-strong"
              />
              Begleitperson
            </label>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">Besonderheiten</label>
              <textarea
                value={eingabe.assistanceNotes}
                onChange={(event) => setEingabe({ ...eingabe, assistanceNotes: event.target.value })}
                rows={2}
                placeholder="z. B. Hilfe bis zur Wohnung, 3. OG ohne Aufzug"
                className="rounded-xl border border-line-strong bg-surface p-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </div>

            {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : null}

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={speichern}
                disabled={
                  speichert ||
                  !fahrgast ||
                  !eingabe.pickupPlaceId ||
                  !eingabe.dropoffPlaceId ||
                  (serieModus && (serieWochentage.length === 0 || !serieBis))
                }
              >
                {speichert ? "Speichert …" : serieModus ? "Serie anlegen" : "Fahrt anlegen"}
              </Button>
              <Button type="button" variant="secondary" onClick={formularSchliessen}>
                Abbrechen
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {offeneFahrt ? (
        <TripModal fahrt={offeneFahrt} grund={offenerGrund} fahrzeuge={fahrzeuge} onClose={() => setOffeneFahrtId(null)} />
      ) : null}
    </div>
  );
}
