"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { Hinweisbox } from "@/components/ui/Hinweisbox";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { SelectField } from "@/components/ui/SelectField";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextField } from "@/components/ui/TextField";
import { besatzungsEtiketten } from "@/core/shifts/besatzung";
import { besatzungVonPlanSchicht, tagLabel, zielTage, type GiltFuer, type PlanPerson, type SchichtEntwurf } from "@/core/shifts/schichtplan";
import { tagKurzIso, uhrzeitBerlin, WOCHENTAG_LABEL, wochentagVonIso } from "@/core/shifts/week";
import { fahrzeugTypKurz } from "@/core/vehicles/validation";
import type { BetroffeneFahrtAnzeige } from "@/core/shifts/schichtplanSpeichern";
import { MONATE, schichtenAm, zeitText, type Fahrzeug, type Person, type Schicht } from "./anzeige";
import { Etikett } from "./Wochenplan";
import { SCHICHTPLAN_UI as T } from "./texte";

export type EntwurfUi = SchichtEntwurf & { key: string; mitBeifahrer: boolean; faelltAus: boolean };

let schluesselZaehler = 0;
const neuerSchluessel = () => `e${++schluesselZaehler}`;

/** Entwürfe aus den bestehenden, noch nicht begonnenen Schichten eines Fahrzeug-Tages. */
export function entwuerfeAus(schichten: Schicht[]): EntwurfUi[] {
  return schichten
    .filter((s) => !s.startedAt)
    .map((s) => ({
      key: neuerSchluessel(),
      von: uhrzeitBerlin(new Date(s.start)),
      bis: uhrzeitBerlin(new Date(s.end)),
      fahrerId: s.driverId,
      beifahrerId: s.beifahrerId,
      scalamobil: s.scalamobil,
      mitBeifahrer: !!s.beifahrerId,
      faelltAus: s.unavailable,
    }));
}

export function leererEntwurf(von = "06:00", bis = "14:00"): EntwurfUi {
  return { key: neuerSchluessel(), von, bis, fahrerId: "", beifahrerId: null, scalamobil: false, mitBeifahrer: false, faelltAus: false };
}

export type SpeichernAnfrage = { giltFuer: GiltFuer; entwuerfe: SchichtEntwurf[]; bestaetigteFahrten?: string[]; loeschen: boolean };

/**
 * Seitenfenster zum Bearbeiten eines Fahrzeug-Tages (wie die Vorschau): Beginn, Ende, Fahrer,
 * „+ Beifahrer hinzufügen“, Scalamobil-Häkchen, „Gilt für“, Fehlermeldungen, Löschen. Liegen
 * Fahrten in wegfallender Zeit, zeigt es VOR dem Speichern den Hinweis mit Uhrzeiten und fragt hier
 * (nicht per confirm()) nach.
 */
export function SchichtEditor({
  fahrzeug,
  fahrzeuge,
  tagIso,
  schichten,
  personal,
  personen,
  scalamobilAnzahl,
  fehler,
  hinweis,
  speichert,
  onSpeichern,
  onHinweisZurueck,
  onSchliessen,
}: {
  fahrzeug: Fahrzeug;
  fahrzeuge: Fahrzeug[];
  tagIso: string;
  schichten: Schicht[];
  personal: Person[];
  personen: Map<string, PlanPerson>;
  scalamobilAnzahl: number;
  fehler: string | null;
  hinweis: { fahrten: BetroffeneFahrtAnzeige[]; anfrage: SpeichernAnfrage } | null;
  speichert: boolean;
  onSpeichern: (anfrage: SpeichernAnfrage) => void;
  onHinweisZurueck: () => void;
  onSchliessen: () => void;
}) {
  const bestehend = schichtenAm(schichten, fahrzeug.id, tagIso);
  const laufend = bestehend.filter((s) => s.startedAt);
  const [entwuerfe, setEntwuerfe] = useState<EntwurfUi[]>(() => {
    const vorhanden = entwuerfeAus(bestehend);
    return vorhanden.length > 0 || laufend.length > 0 ? vorhanden : [leererEntwurf()];
  });
  const [giltFuer, setGiltFuer] = useState<GiltFuer>("TAG");
  const [lokalerFehler, setLokalerFehler] = useState<string | null>(null);
  const [loeschenFrage, setLoeschenFrage] = useState(false);

  const wochentag = WOCHENTAG_LABEL[wochentagVonIso(tagIso)];
  const monat = MONATE[Number(tagIso.slice(5, 7)) - 1];
  const scalamobilMoeglich = fahrzeug.carryChair || fahrzeug.wheelchairSpots >= 1;
  const tageAnzahl = zielTage(tagIso, giltFuer).length;
  const angezeigterFehler = lokalerFehler ?? fehler;

  function aendern(key: string, teil: Partial<EntwurfUi>) {
    setLokalerFehler(null);
    setLoeschenFrage(false);
    // Eine Änderung nach dem Hinweis macht ihn ungültig – beim nächsten Speichern wird neu geprüft.
    if (hinweis) onHinweisZurueck();
    setEntwuerfe((liste) => liste.map((e) => (e.key === key ? { ...e, ...teil } : e)));
  }

  /** „fährt schon …“ in der Personenauswahl: am selben Tag auf einem anderen Fahrzeug eingeplant. */
  function belegt(personId: string): string | null {
    const andere = schichten.find(
      (s) => s.tagIso === tagIso && s.vehicleId !== fahrzeug.id && !s.unavailable && (s.driverId === personId || s.beifahrerId === personId),
    );
    if (!andere) return null;
    const z = zeitText(andere);
    return `${fahrzeuge.find((f) => f.id === andere.vehicleId)?.plate ?? ""}, ${z.von}–${z.bis}`;
  }

  function optionen(gewaehlt: string | null) {
    return personal
      .filter((p) => p.active || p.id === gewaehlt)
      .map((p) => (
        <option key={p.id} value={p.id}>
          {p.active
            ? T.optionPerson(p.name, p.istAushilfe ? T.rolleAushilfe : T.rolleFahrer, p.scalamobilEinweisung, belegt(p.id))
            : `${p.name} (${T.deaktiviert})`}
        </option>
      ));
  }

  function bereinigt(): SchichtEntwurf[] {
    return entwuerfe.map((e) => ({
      von: e.von,
      bis: e.bis,
      fahrerId: e.fahrerId,
      beifahrerId: e.mitBeifahrer ? e.beifahrerId || null : null,
      scalamobil: scalamobilMoeglich && e.scalamobil,
    }));
  }

  function speichern() {
    const ohneBeifahrer = entwuerfe.findIndex((e) => e.mitBeifahrer && !e.beifahrerId);
    if (ohneBeifahrer >= 0) {
      setLokalerFehler(entwuerfe.length > 1 ? `${T.schichtNummer(ohneBeifahrer + 1)}: ${T.beifahrerFehlt}` : T.beifahrerFehlt);
      return;
    }
    onSpeichern({ giltFuer, entwuerfe: bereinigt(), loeschen: false });
  }

  const fuss = hinweis ? (
    <>
      <Button type="button" onClick={() => onSpeichern({ ...hinweis.anfrage, bestaetigteFahrten: hinweis.fahrten.map((f) => f.id) })} disabled={speichert}>
        {speichert ? T.speichert : T.hinweisBestaetigen}
      </Button>
      <Button type="button" variant="quiet" onClick={onHinweisZurueck} disabled={speichert}>
        {T.hinweisZurueck}
      </Button>
    </>
  ) : (
    <>
      <Button type="button" onClick={speichern} disabled={speichert}>
        {speichert ? T.speichert : T.speichern}
      </Button>
      <Button type="button" variant="quiet" onClick={onSchliessen}>
        {T.abbrechen}
      </Button>
      <span className="flex-1" />
      {bestehend.length > 0 || giltFuer !== "TAG" ? (
        loeschenFrage ? (
          <Button type="button" variant="danger" onClick={() => onSpeichern({ giltFuer, entwuerfe: [], loeschen: true })} disabled={speichert}>
            {T.loeschenBestaetigen}
          </Button>
        ) : (
          <Button type="button" variant="danger" onClick={() => setLoeschenFrage(true)}>
            {T.loeschen}
          </Button>
        )
      ) : null}
    </>
  );

  return (
    <SidePanel titel={`${wochentag}, ${tagKurzIso(tagIso)}`} meta={`${fahrzeug.plate} · ${fahrzeugTypKurz(fahrzeug)}`} onClose={onSchliessen} fuss={fuss}>
      {hinweis ? (
        <Hinweisbox ton="warn" titel={T.hinweisTitel(hinweis.fahrten.length)}>
          <ul className="flex list-disc flex-col gap-1 pl-5 font-mono text-[13px]">
            {hinweis.fahrten.map((f) => (
              <li key={f.id}>{T.hinweisFahrt(f.tag, f.uhrzeit, f.plate)}</li>
            ))}
          </ul>
          <p>{T.hinweisText}</p>
        </Hinweisbox>
      ) : null}

      {laufend.map((s) => {
        const z = zeitText(s);
        return (
          <div key={s.id} className="flex flex-col gap-1 rounded-[14px] border border-line bg-surface2 p-4 text-sm">
            <b className="text-[15px] text-ink">{personen.get(s.driverId)?.name}</b>
            {s.beifahrerId ? <span className="text-ink-soft">{T.mit(personen.get(s.beifahrerId)?.name ?? "")}</span> : null}
            <span className="text-muted">{T.laufend(z.von, z.bis)}</span>
          </div>
        );
      })}

      {entwuerfe.map((e, index) => {
        const etiketten = besatzungsEtiketten(
          fahrzeug,
          besatzungVonPlanSchicht(
            { vehicleId: fahrzeug.id, driverId: e.fahrerId, beifahrerId: e.mitBeifahrer ? e.beifahrerId : null, scalamobil: e.scalamobil, start: new Date(), end: new Date() },
            personen,
          ),
        );
        return (
          <div key={e.key} className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-surface2 p-4">
            <div className="flex items-center justify-between">
              <b className="text-[15px] text-ink">{entwuerfe.length > 1 ? T.schichtNummer(index + 1) : T.schicht}</b>
              {entwuerfe.length > 1 || laufend.length > 0 ? (
                <Button type="button" variant="danger" className="min-h-9 px-2 text-sm" onClick={() => setEntwuerfe((l) => l.filter((x) => x.key !== e.key))}>
                  {T.entfernen}
                </Button>
              ) : null}
            </div>
            {e.faelltAus ? <p className="text-sm text-warn-ink">{T.faelltAusHinweis}</p> : null}
            <div className="grid grid-cols-2 gap-2.5">
              <TextField label={T.beginn} type="time" step={900} value={e.von} onChange={(ev) => aendern(e.key, { von: ev.target.value })} />
              <TextField
                label={T.ende}
                type="time"
                step={900}
                value={e.bis}
                onChange={(ev) => aendern(e.key, { bis: ev.target.value })}
                hint={e.bis && e.von && e.bis < e.von ? T.folgetag(e.bis) : undefined}
              />
            </div>
            <SelectField label={T.fahrer} value={e.fahrerId} onChange={(ev) => aendern(e.key, { fahrerId: ev.target.value, faelltAus: false })}>
              <option value="">{T.fahrerWaehlen}</option>
              {optionen(e.fahrerId)}
            </SelectField>
            {e.mitBeifahrer ? (
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <SelectField label={T.beifahrer} value={e.beifahrerId ?? ""} onChange={(ev) => aendern(e.key, { beifahrerId: ev.target.value || null })}>
                    <option value="">{T.beifahrerWaehlen}</option>
                    {optionen(e.beifahrerId)}
                  </SelectField>
                </div>
                <Button type="button" variant="quiet" className="px-2 text-sm" onClick={() => aendern(e.key, { mitBeifahrer: false, beifahrerId: null })}>
                  {T.entfernen}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => aendern(e.key, { mitBeifahrer: true })}
                className="inline-flex min-h-9 items-center gap-1.5 self-start font-semibold text-accent hover:underline"
              >
                <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-base leading-none">
                  +
                </span>
                {T.beifahrerHinzufuegen}
              </button>
            )}
            {scalamobilMoeglich ? (
              <CheckboxField
                label={T.scalamobilAnBord}
                checked={e.scalamobil}
                disabled={scalamobilAnzahl < 1 && !e.scalamobil}
                hint={scalamobilAnzahl < 1 ? T.scalamobilKeinGeraet : undefined}
                onChange={(ev) => aendern(e.key, { scalamobil: ev.target.checked })}
              />
            ) : null}
            {etiketten.map((etikett) => (
              <Etikett key={etikett.text} etikett={etikett} />
            ))}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => {
          const letzte = entwuerfe[entwuerfe.length - 1];
          const von = letzte?.bis ?? "06:00";
          const bisStunde = Math.min(23, Number(von.slice(0, 2)) + 4);
          setEntwuerfe((l) => [...l, leererEntwurf(von, `${String(bisStunde).padStart(2, "0")}:${von.slice(3, 5)}`)]);
        }}
        className="inline-flex min-h-9 items-center gap-1.5 self-start font-semibold text-accent hover:underline"
      >
        <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-base leading-none">
          +
        </span>
        {T.weitereSchicht}
      </button>

      <RadioGroup<GiltFuer>
        legende={T.giltFuer}
        name="gilt-fuer"
        wert={giltFuer}
        onChange={(wert) => {
          setGiltFuer(wert);
          setLoeschenFrage(false);
          if (hinweis) onHinweisZurueck();
        }}
        optionen={[
          { wert: "TAG", label: T.nurTag(tagLabel(tagIso)) },
          { wert: "WOCHE", label: T.wocheMoFr },
          { wert: "WOCHENTAG_MONAT", label: T.jedenWochentag(wochentag, monat) },
          { wert: "WERKTAGE_MONAT", label: T.alleWerktage(monat) },
        ]}
        hinweis={giltFuer !== "TAG" ? T.tageHinweis(tageAnzahl) : undefined}
      />

      {loeschenFrage ? <p className="text-sm font-semibold text-danger-ink">{T.loeschenFrage}</p> : null}
      {angezeigterFehler ? <Hinweisbox ton="fehler">{angezeigterFehler}</Hinweisbox> : null}
    </SidePanel>
  );
}
