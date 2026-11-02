"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { NumberField } from "@/components/ui/NumberField";
import { scalamobilAnzahlSpeichern } from "./actions";
import { EINSTELLUNGEN_TEXTE as T } from "./texte";

/** Betrieb: Anzahl der Scalamobile (Schichtplan, 02.11.2026). Nur Admins können sie ändern. */
export function BetriebEinstellungen({ anfangsAnzahl, istAdmin }: { anfangsAnzahl: number; istAdmin: boolean }) {
  const [anzahl, setAnzahl] = useState(anfangsAnzahl);
  const [speichert, setSpeichert] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);

  async function speichern() {
    setSpeichert(true);
    setMeldung(null);
    try {
      const ergebnis = await scalamobilAnzahlSpeichern(anzahl);
      setMeldung(ergebnis.ok ? { text: T.gespeichert, fehler: false } : { text: ergebnis.fehler, fehler: true });
    } catch {
      setMeldung({ text: T.fehler, fehler: true });
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">{T.betriebTitel}</h2>
        <p className="text-sm text-muted">
          {T.scalamobilHinweis}
          {!istAdmin ? ` ${T.nurAdmin}` : ""}
        </p>
      </div>
      {istAdmin ? (
        <NumberField label={T.scalamobilAnzahl} value={anzahl} min={0} max={20} onChange={setAnzahl} />
      ) : (
        <p className="text-sm text-ink">
          {T.scalamobilAnzahl}: <span className="font-semibold tabular-nums">{anzahl}</span>
        </p>
      )}
      {meldung ? (
        <p role="status" className={`text-sm ${meldung.fehler ? "text-danger-ink" : "text-accent"}`}>
          {meldung.text}
        </p>
      ) : null}
      {istAdmin ? (
        <div>
          <Button type="button" onClick={speichern} disabled={speichert}>
            {speichert ? T.speichert : T.speichern}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
