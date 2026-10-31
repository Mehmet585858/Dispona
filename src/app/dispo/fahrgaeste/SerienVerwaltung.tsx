"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { TextField } from "@/components/ui/TextField";
import { Tile } from "@/components/ui/Tile";
import { WOCHENTAGE, type Wochentag } from "@/core/shifts/rrule";
import { serieAendernAktion, serieBeendenAktion, serienLaden, seriePausierenAktion } from "./actions";
import { FAHRGAST_TEXTE } from "./texte";

type Serie = Awaited<ReturnType<typeof serienLaden>>[number];

/**
 * Maßnahme M-22 (Prüfbericht S2-005): laufende Serien eines Fahrgasts mit "Beenden", "Pause" und
 * "Ändern". Vorher gab es keinen Weg, eine Dialyse-Serie nach Umzug, Zentrumswechsel oder Tod zu
 * stoppen – außer jeden Termin einzeln zu stornieren.
 */
export function SerienVerwaltung({ passengerId }: { passengerId: string }) {
  const [serien, setSerien] = useState<Serie[] | null>(null);
  const [ladefehler, setLadefehler] = useState(false);
  const [stand, setStand] = useState(0);

  useEffect(() => {
    let aktiv = true;
    serienLaden(passengerId)
      .then((ergebnis) => {
        if (!aktiv) return;
        setSerien(ergebnis);
        setLadefehler(false);
      })
      .catch(() => {
        if (aktiv) setLadefehler(true);
      });
    return () => {
      aktiv = false;
    };
  }, [passengerId, stand]);

  const laden = useCallback(async () => setStand((n) => n + 1), []);

  return (
    <div className="mt-6 border-t border-line pt-6">
      <h3 className="mb-3 text-base font-semibold text-ink">{FAHRGAST_TEXTE.serienTitel}</h3>
      {ladefehler ? <p className="text-sm text-danger-ink">{FAHRGAST_TEXTE.fehler("Serien nicht geladen.")}</p> : null}
      {serien === null && !ladefehler ? <p className="text-sm text-muted">…</p> : null}
      {serien?.length === 0 ? <p className="text-sm text-muted">{FAHRGAST_TEXTE.keineSerie}</p> : null}
      <div className="flex flex-col gap-4">
        {serien?.map((serie) => <SerieZeile key={serie.id} serie={serie} onGeaendert={laden} />)}
      </div>
    </div>
  );
}

function SerieZeile({ serie, onGeaendert }: { serie: Serie; onGeaendert: () => Promise<void> }) {
  const [beendenAb, setBeendenAb] = useState("");
  const [bestaetigen, setBestaetigen] = useState(false);
  const [pauseVon, setPauseVon] = useState("");
  const [pauseBis, setPauseBis] = useState("");
  const [abholzeit, setAbholzeit] = useState(serie.abholzeit);
  const [bis, setBis] = useState(serie.bis);
  const [wochentage, setWochentage] = useState<Wochentag[]>(serie.wochentage);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function ausfuehren(aktion: () => Promise<string>) {
    setLaeuft(true);
    setMeldung(null);
    try {
      setMeldung({ text: await aktion(), fehler: false });
      await onGeaendert();
    } catch (fehler) {
      setMeldung({ text: FAHRGAST_TEXTE.fehler(fehler instanceof Error ? fehler.message : "Unbekannter Fehler."), fehler: true });
    } finally {
      setLaeuft(false);
      setBestaetigen(false);
    }
  }

  function wochentagUmschalten(tag: Wochentag) {
    setWochentage((bisher) => (bisher.includes(tag) ? bisher.filter((t) => t !== tag) : [...bisher, tag]));
  }

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-ink">
        <span className="font-medium">{FAHRGAST_TEXTE.serieZeile(serie.wochentage.join(", "), serie.abholzeit, serie.bis)}</span>
        {serie.pauseVon && serie.pauseBis ? <Chip ton="warn">{FAHRGAST_TEXTE.pause(serie.pauseVon, serie.pauseBis)}</Chip> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label={FAHRGAST_TEXTE.beendenAb} type="date" value={beendenAb} onChange={(e) => setBeendenAb(e.target.value)} />
        <TextField label={FAHRGAST_TEXTE.pauseVon} type="date" value={pauseVon} onChange={(e) => setPauseVon(e.target.value)} />
        <TextField label={FAHRGAST_TEXTE.pauseBis} type="date" value={pauseBis} onChange={(e) => setPauseBis(e.target.value)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {bestaetigen ? (
          <Button
            type="button"
            variant="danger"
            disabled={laeuft}
            onClick={() => ausfuehren(async () => FAHRGAST_TEXTE.erledigt((await serieBeendenAktion(serie.id, beendenAb)).storniert))}
          >
            {FAHRGAST_TEXTE.beendenBestaetigen}
          </Button>
        ) : (
          <Button type="button" variant="danger" disabled={!beendenAb || laeuft} onClick={() => setBestaetigen(true)}>
            {FAHRGAST_TEXTE.beenden}
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          disabled={!pauseVon || !pauseBis || laeuft}
          onClick={() =>
            ausfuehren(async () => FAHRGAST_TEXTE.erledigt((await seriePausierenAktion(serie.id, pauseVon, pauseBis)).storniert))
          }
        >
          {FAHRGAST_TEXTE.pausieren}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TextField label={FAHRGAST_TEXTE.neueAbholzeit} type="time" value={abholzeit} onChange={(e) => setAbholzeit(e.target.value)} />
        <TextField label={FAHRGAST_TEXTE.neuesEnde} type="date" value={bis} onChange={(e) => setBis(e.target.value)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {WOCHENTAGE.map((tag) => (
          <Tile key={tag} label={tag} active={wochentage.includes(tag)} onClick={() => wochentagUmschalten(tag)} />
        ))}
      </div>
      <Button
        type="button"
        variant="secondary"
        className="mt-3"
        disabled={laeuft || wochentage.length === 0}
        onClick={() =>
          ausfuehren(async () => {
            const e = await serieAendernAktion(serie.id, {
              abholzeit: abholzeit !== serie.abholzeit ? abholzeit : undefined,
              bis: bis !== serie.bis ? bis : undefined,
              wochentage: wochentage.join() !== serie.wochentage.join() ? wochentage : undefined,
            });
            return FAHRGAST_TEXTE.geaendert(e.geaendert, e.storniert, e.neu);
          })
        }
      >
        {FAHRGAST_TEXTE.aendern}
      </Button>

      {meldung ? (
        <p role="status" aria-live="polite" className={`mt-3 text-sm ${meldung.fehler ? "text-danger-ink" : "text-ink-soft"}`}>
          {meldung.text}
        </p>
      ) : null}
    </div>
  );
}
