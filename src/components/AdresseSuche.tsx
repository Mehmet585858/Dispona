"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

export type AdressTreffer = { label: string; street: string; zip: string; city: string; lat: number; lng: number; sicher: boolean };

/** Adresssuche mit Geocoding (für Firmen-/Betriebshofadresse, Einsatzgebiet-Mittelpunkt) – ohne einen Ort/Place anzulegen. */
export function AdresseSuche({
  label,
  onAuswahl,
  suchen,
}: {
  label: string;
  onAuswahl: (treffer: AdressTreffer) => void;
  suchen: (text: string) => Promise<AdressTreffer[]>;
}) {
  const [suchtext, setSuchtext] = useState("");
  const [sucht, setSucht] = useState(false);
  const [treffer, setTreffer] = useState<AdressTreffer[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);

  async function ausfuehren() {
    setSucht(true);
    setFehler(null);
    try {
      const ergebnis = await suchen(suchtext);
      if (ergebnis.length === 0) setFehler("Nichts gefunden. Bitte Adresse genauer eingeben.");
      setTreffer(ergebnis);
    } finally {
      setSucht(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <TextField
          label={label}
          value={suchtext}
          onChange={(event) => setSuchtext(event.target.value)}
          placeholder="Straße, Hausnummer, Ort"
        />
        <Button type="button" variant="secondary" onClick={ausfuehren} disabled={sucht || !suchtext.trim()}>
          {sucht ? "…" : "Suchen"}
        </Button>
      </div>
      {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : null}
      {treffer.length > 0 ? (
        <div className="flex flex-col gap-1">
          {treffer.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => {
                onAuswahl(t);
                setTreffer([]);
                setSuchtext(t.label);
              }}
              className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-accent"
            >
              <span>{t.label}</span>
              <span className={t.sicher ? "text-accent" : "text-warn-ink"}>{t.sicher ? "sicher" : "unsicher"}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
