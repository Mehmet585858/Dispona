"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Tile } from "@/components/ui/Tile";
import {
  DOC_STATUS,
  DOC_STATUS_LABEL,
  TRANSPORT_TYPE_LABEL,
  TRANSPORT_TYPES,
  type FahrtEingabe,
} from "@/core/rides/validation";
import { WOCHENTAGE, WOCHENTAG_LABEL, type Wochentag } from "@/core/shifts/rrule";
import { berlinerMitternacht, datumIso, montagVerschieben, wochenStart } from "@/core/shifts/week";
import { FahrgastAuswahl } from "./FahrgastAuswahl";
import { OrtAuswahl } from "./OrtAuswahl";
import { fahrtAnlegen, serieAnlegen } from "./actions";
import { Zeitstrahl, type FahrerZeile, type FahrtMini } from "./Zeitstrahl";

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

export function FahrtenClient({
  fahrten,
  fahrer,
  karte,
  orte,
  fahrzeuge,
  datum,
  ansicht,
}: {
  fahrten: Fahrt[];
  fahrer: FahrerZeile[];
  karte: KartenDaten | null;
  orte: Ort[];
  fahrzeuge: Fahrzeug[];
  datum: string;
  ansicht: "tag" | "woche";
}) {
  const router = useRouter();
  const [formularOffen, setFormularOffen] = useState(false);
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
    router.push(`/dispo/fahrten?datum=${neuesDatum}`);
  }

  function ansichtWechseln(neueAnsicht: "tag" | "woche") {
    router.push(`/dispo/fahrten?datum=${datum}&ansicht=${neueAnsicht}`);
  }

  function wocheWechseln(richtung: -1 | 1) {
    const montag = datumIso(wochenStart(berlinerMitternacht(datum)));
    router.push(`/dispo/fahrten?datum=${montagVerschieben(montag, richtung)}&ansicht=woche`);
  }

  const wochenStartIso = datumIso(wochenStart(berlinerMitternacht(datum)));
  const wochenEndeIso = (() => {
    const ende = new Date(berlinerMitternacht(wochenStartIso));
    ende.setDate(ende.getDate() + 6);
    return datumIso(ende);
  })();

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
        setSerieModus(false);
        setSerieWochentage([]);
        setSerieBis("");
      } else {
        const { probleme } = await fahrtAnlegen({ ...eingabe, passengerId: fahrgast.id });
        setErfolg(
          probleme.length > 0
            ? `Fahrt angelegt, aber mit Hinweis: ${probleme.join(", ")}`
            : "Fahrt angelegt.",
        );
      }
      setEingabe(LEER);
      setFahrgast(null);
      setFormularOffen(false);
      router.refresh();
    } catch {
      setFehler("Konnte nicht gespeichert werden. Bitte Angaben prüfen.");
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Fahrplan</h1>
          <Link href="/dispo/fahrer" className="text-sm text-accent hover:underline">
            Schichten verwalten, Fahrer einladen →
          </Link>
        </div>
        <div className="flex items-end gap-3">
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
            <TextField
              label="Datum"
              type="date"
              value={datum}
              onChange={(event) => wechselDatum(event.target.value)}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => wocheWechseln(-1)}>
                ‹ Vorherige Woche
              </Button>
              <span className="whitespace-nowrap text-sm font-medium text-ink">
                {berlinerMitternacht(wochenStartIso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                {" – "}
                {berlinerMitternacht(wochenEndeIso).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>
              <Button type="button" variant="secondary" onClick={() => wocheWechseln(1)}>
                Nächste Woche ›
              </Button>
            </div>
          )}

          <Button type="button" onClick={() => setFormularOffen(!formularOffen)}>
            Fahrt manuell anlegen
          </Button>
        </div>
      </div>

      {erfolg ? <p className="text-sm text-accent">{erfolg}</p> : null}

      {formularOffen ? (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-ink">{serieModus ? "Neue Serienfahrt" : "Neue Fahrt"}</h2>
          <div className="flex flex-col gap-4">
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
                  <TextField
                    label="Serie bis"
                    type="date"
                    value={serieBis}
                    onChange={(event) => setSerieBis(event.target.value)}
                  />
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
              <Button type="button" variant="secondary" onClick={() => setFormularOffen(false)}>
                Abbrechen
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

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

      {fahrten.length === 0 && fahrer.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            {ansicht === "woche" ? "Keine Fahrten in dieser Woche." : "Keine Fahrten an diesem Tag."}
          </p>
        </Card>
      ) : (
        <Zeitstrahl fahrten={fahrten} fahrer={fahrer} fahrzeuge={fahrzeuge} datum={datum} ansicht={ansicht} />
      )}
    </div>
  );
}
