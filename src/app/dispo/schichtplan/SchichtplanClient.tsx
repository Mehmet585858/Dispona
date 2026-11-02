"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Hinweisbox } from "@/components/ui/Hinweisbox";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import type { Aenderung } from "@/core/shifts/schichtplan";
import { tagLabel } from "@/core/shifts/schichtplan";
import type { BetroffeneFahrtAnzeige, SchichtplanErgebnis } from "@/core/shifts/schichtplanSpeichern";
import { kalenderwocheIso, montagVonIso, tagKurzIso, tagVerschieben } from "@/core/shifts/week";
import { aenderungenZuruecknehmen, schichtenSpeichern, schichtplanLaden, wocheKopieren } from "./actions";
import { ladeBereich, monatVerschieben, personenMap, type Daten } from "./anzeige";
import { HeuteKarte } from "./HeuteKarte";
import { Monatskalender } from "./Monatskalender";
import { SchichtEditor, type SpeichernAnfrage } from "./SchichtEditor";
import { Wochenplan } from "./Wochenplan";
import { SCHICHTPLAN_UI as T } from "./texte";

type ToastZustand = { text: string; vorher?: Aenderung[] } | null;
type EditorZustand = {
  vehicleId: string;
  tagIso: string;
  fehler: string | null;
  hinweis: { fahrten: BetroffeneFahrtAnzeige[]; anfrage: SpeichernAnfrage } | null;
  speichert: boolean;
} | null;
type KopierZiel = "NAECHSTE_WOCHE" | "BIS_MONATSENDE";

/** Zusätze für die Erfolgsmeldung: übersprungene Tage und Fahrten, die neu geplant werden müssen. */
function zusaetze(ergebnis: Extract<SchichtplanErgebnis, { ok: true }>): string {
  const teile: string[] = [];
  if (ergebnis.uebersprungen.length > 0) teile.push(T.uebersprungen(ergebnis.uebersprungen.length));
  if (ergebnis.freigegeben > 0) teile.push(T.fahrtenFreigegeben(ergebnis.freigegeben));
  return teile.length > 0 ? ` · ${teile.join(" · ")}` : "";
}

export function SchichtplanClient({
  anfangsDaten,
  heuteIso,
  jetztIso,
  anfangsMontag,
  anfangsMonat,
}: {
  anfangsDaten: Daten;
  heuteIso: string;
  jetztIso: string;
  anfangsMontag: string;
  anfangsMonat: string;
}) {
  const [daten, setDaten] = useState(anfangsDaten);
  const [montag, setMontag] = useState(anfangsMontag);
  const [monat, setMonat] = useState(anfangsMonat);
  const [laedt, setLaedt] = useState(false);
  const [ladeFehler, setLadeFehler] = useState(false);
  const [jetzt, setJetzt] = useState(() => new Date(jetztIso));
  const [editor, setEditor] = useState<EditorZustand>(null);
  const [toast, setToast] = useState<ToastZustand>(null);
  const [kopieren, setKopieren] = useState<{ ziel: KopierZiel; fahrten: BetroffeneFahrtAnzeige[] } | null>(null);
  const [kopiertGerade, setKopiertGerade] = useState(false);

  const personen = useMemo(() => personenMap(daten.personal), [daten.personal]);

  // Uhrzeit im Block „Heute“ minütlich weiterschalten (nur im Browser, nach dem ersten Rendern).
  useEffect(() => {
    const id = setInterval(() => setJetzt(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const laden = useCallback(async (neuerMontag: string, neuerMonat: string) => {
    const neu = ladeBereich(neuerMontag, neuerMonat);
    setLaedt(true);
    setLadeFehler(false);
    try {
      setDaten(await schichtplanLaden(neu.vonIso, neu.bisIso));
    } catch {
      setLadeFehler(true);
    } finally {
      setLaedt(false);
    }
  }, []);

  function wocheSetzen(tagIso: string) {
    const neuerMontag = montagVonIso(tagIso);
    // Wie in der Vorschau: der Monatskalender zeigt den Monat des Donnerstags der Woche.
    const neuerMonat = tagVerschieben(neuerMontag, 3).slice(0, 7);
    setMontag(neuerMontag);
    setMonat(neuerMonat);
    void laden(neuerMontag, neuerMonat);
  }

  function monatSetzen(versatz: number) {
    const neuerMonat = monatVerschieben(monat, versatz);
    setMonat(neuerMonat);
    void laden(montag, neuerMonat);
  }

  const toastSchliessen = useCallback(() => setToast(null), []);
  const editorSchliessen = useCallback(() => setEditor(null), []);

  async function speichern(anfrage: SpeichernAnfrage) {
    if (!editor) return;
    const { vehicleId, tagIso } = editor;
    setEditor({ ...editor, speichert: true, fehler: null });
    let ergebnis: SchichtplanErgebnis;
    try {
      ergebnis = await schichtenSpeichern({
        vehicleId,
        tagIso,
        giltFuer: anfrage.giltFuer,
        entwuerfe: anfrage.entwuerfe,
        bestaetigteFahrten: anfrage.bestaetigteFahrten,
      });
    } catch {
      setEditor((e) => e && { ...e, speichert: false, fehler: T.fehlerAllgemein });
      return;
    }
    if (!ergebnis.ok) {
      if ("hinweis" in ergebnis) setEditor((e) => e && { ...e, speichert: false, hinweis: { fahrten: ergebnis.hinweis, anfrage } });
      else setEditor((e) => e && { ...e, speichert: false, hinweis: null, fehler: ergebnis.fehler });
      return;
    }
    const plate = daten.fahrzeuge.find((f) => f.id === vehicleId)?.plate ?? "";
    const tage = anfrage.giltFuer === "TAG" ? tagLabel(tagIso) : T.tage(ergebnis.vorher.length + ergebnis.uebersprungen.length);
    setEditor(null);
    setToast({
      text: (anfrage.loeschen ? T.geloescht(plate, tage) : T.gespeichert(plate, tage)) + zusaetze(ergebnis),
      vorher: ergebnis.vorher,
    });
    await laden(montag, monat);
  }

  async function wocheKopierenStarten(ziel: KopierZiel, bestaetigteFahrten?: string[]) {
    setKopiertGerade(true);
    try {
      const ergebnis = await wocheKopieren({ quellMontagIso: montag, ziel, bestaetigteFahrten });
      if (!ergebnis.ok) {
        if ("hinweis" in ergebnis) setKopieren({ ziel, fahrten: ergebnis.hinweis });
        else setToast({ text: ergebnis.fehler });
        return;
      }
      setKopieren(null);
      if (ergebnis.zielWochen === 0) {
        setToast({ text: T.letzteWoche });
        return;
      }
      const kw = kalenderwocheIso(montag);
      const text =
        ziel === "NAECHSTE_WOCHE" ? T.kopiert(kw, kalenderwocheIso(tagVerschieben(montag, 7))) : T.wiederholt(kw, ergebnis.zielWochen);
      setToast({ text: text + zusaetze(ergebnis), vorher: ergebnis.vorher });
      await laden(montag, monat);
    } catch {
      setToast({ text: T.fehlerAllgemein });
    } finally {
      setKopiertGerade(false);
    }
  }

  async function rueckgaengig(vorher: Aenderung[]) {
    setToast(null);
    try {
      const ergebnis = await aenderungenZuruecknehmen(vorher);
      if (ergebnis.ok) setToast({ text: T.rueckgaengigGemacht });
      else setToast({ text: "hinweis" in ergebnis ? T.rueckgaengigNichtMoeglich : ergebnis.fehler });
    } catch {
      setToast({ text: T.fehlerAllgemein });
    }
    await laden(montag, monat);
  }

  const sonntag = tagVerschieben(montag, 6);
  const editorFahrzeug = editor ? daten.fahrzeuge.find((f) => f.id === editor.vehicleId) : undefined;
  const aktivesPersonal = daten.personal.filter((p) => p.active);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5" aria-busy={laedt}>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{T.titel}</h1>
        <p className="text-sm text-muted">{T.untertitel}</p>
      </header>

      {ladeFehler ? (
        <Hinweisbox ton="warn" titel={T.ladeFehler}>
          <div>
            <Button type="button" variant="secondary" onClick={() => laden(montag, monat)}>
              {T.erneutVersuchen}
            </Button>
          </div>
        </Hinweisbox>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <Monatskalender
          monat={monat}
          montagIso={montag}
          heuteIso={heuteIso}
          fahrzeuge={daten.fahrzeuge}
          schichten={daten.schichten}
          onMonat={monatSetzen}
          onTag={wocheSetzen}
        />
        <HeuteKarte heuteIso={heuteIso} jetzt={jetzt} fahrzeuge={daten.fahrzeuge} schichten={daten.schichten} personal={daten.personal} />
      </div>

      <section aria-label={T.woche(kalenderwocheIso(montag))} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <IconButton aria-label={T.vorherigeWoche} onClick={() => wocheSetzen(tagVerschieben(montag, -7))}>
              ‹
            </IconButton>
            <h2 className="min-w-0 text-xl font-bold text-ink sm:min-w-[260px]">
              {T.woche(kalenderwocheIso(montag))}
              <small className="block text-[13px] font-normal text-muted">
                {T.wocheZeitraum(tagKurzIso(montag), `${tagKurzIso(sonntag)}${sonntag.slice(0, 4)}`)}
              </small>
            </h2>
            <IconButton aria-label={T.naechsteWoche} onClick={() => wocheSetzen(tagVerschieben(montag, 7))}>
              ›
            </IconButton>
            {laedt ? <span className="text-sm text-muted">{T.laedt}</span> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={kopiertGerade || laedt} onClick={() => wocheKopierenStarten("NAECHSTE_WOCHE")}>
              {T.kopierenNaechste}
            </Button>
            <Button type="button" variant="secondary" disabled={kopiertGerade || laedt} onClick={() => wocheKopierenStarten("BIS_MONATSENDE")}>
              {T.kopierenMonat}
            </Button>
          </div>
        </div>
        {daten.fahrzeuge.length === 0 ? (
          <EmptyState
            text={T.keineFahrzeuge}
            aktion={
              <Link href="/dispo/fahrzeuge" className="text-sm font-semibold text-accent hover:underline">
                {T.fahrzeugeAnlegen}
              </Link>
            }
          />
        ) : (
          <Wochenplan
            montagIso={montag}
            heuteIso={heuteIso}
            fahrzeuge={daten.fahrzeuge}
            schichten={daten.schichten}
            personen={personen}
            onZelle={(vehicleId, tagIso) => setEditor({ vehicleId, tagIso, fehler: null, hinweis: null, speichert: false })}
          />
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <section aria-label={T.regelnTitel}>
            <h3 className="text-base font-bold text-ink">{T.regelnTitel}</h3>
            <ul className="mt-2.5 flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-soft">
              <li>
                <b>Liegend</b>: {T.regelLiegend}
              </li>
              <li>
                <b>Tragestuhl über eine Treppe</b>: {T.regelTreppe}
              </li>
              <li>
                <b>Ebenerdig</b>: {T.regelEbenerdig}
              </li>
              <li>
                <b>Scalamobil</b>: {T.regelScalamobil(daten.scalamobilAnzahl)}
              </li>
            </ul>
          </section>
        </Card>
        <Card>
          <section aria-label={T.personalTitel}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-ink">{T.personalTitel}</h3>
              <Link href="/dispo/fahrer" className="text-sm font-semibold text-accent hover:underline">
                {T.personalVerwalten}
              </Link>
            </div>
            {aktivesPersonal.length === 0 ? (
              <p className="mt-2.5 text-sm text-muted">{T.keinPersonal}</p>
            ) : (
              <div className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
                {aktivesPersonal.map((p) => (
                  <div key={p.id} className="flex flex-col gap-0.5 rounded-[10px] border border-line px-3 py-2">
                    <span className="font-semibold text-ink">{p.name}</span>
                    <span className="text-[13px] text-muted">
                      {p.istAushilfe ? T.rolleAushilfe : T.rolleFahrer}
                      {p.scalamobilEinweisung ? ` · ${T.einweisung}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </Card>
      </div>

      {editor && editorFahrzeug ? (
        <SchichtEditor
          key={`${editor.vehicleId}-${editor.tagIso}`}
          fahrzeug={editorFahrzeug}
          fahrzeuge={daten.fahrzeuge}
          tagIso={editor.tagIso}
          schichten={daten.schichten}
          personal={daten.personal}
          personen={personen}
          scalamobilAnzahl={daten.scalamobilAnzahl}
          fehler={editor.fehler}
          hinweis={editor.hinweis}
          speichert={editor.speichert}
          onSpeichern={speichern}
          onHinweisZurueck={() => setEditor((e) => e && { ...e, hinweis: null })}
          onSchliessen={editorSchliessen}
        />
      ) : null}

      {kopieren ? (
        <Modal titel={T.kopierenHinweisTitel(kopieren.fahrten.length)} onClose={() => setKopieren(null)}>
          <div className="flex flex-col gap-4 p-5">
            <h2 className="text-[22px] font-bold text-ink">{T.kopierenHinweisTitel(kopieren.fahrten.length)}</h2>
            <Hinweisbox ton="warn">
              <ul className="flex list-disc flex-col gap-1 pl-5 font-mono text-[13px]">
                {kopieren.fahrten.map((f) => (
                  <li key={f.id}>{T.hinweisFahrt(f.tag, f.uhrzeit, f.plate)}</li>
                ))}
              </ul>
              <p>{T.hinweisText}</p>
            </Hinweisbox>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={kopiertGerade}
                onClick={() => wocheKopierenStarten(kopieren.ziel, kopieren.fahrten.map((f) => f.id))}
              >
                {T.kopierenBestaetigen}
              </Button>
              <Button type="button" variant="quiet" onClick={() => setKopieren(null)}>
                {T.hinweisZurueck}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {toast ? (
        <Toast
          text={toast.text}
          aktion={toast.vorher && toast.vorher.length > 0 ? T.rueckgaengig : undefined}
          onAktion={toast.vorher ? () => rueckgaengig(toast.vorher!) : undefined}
          onSchliessen={toastSchliessen}
        />
      ) : null}
    </div>
  );
}
