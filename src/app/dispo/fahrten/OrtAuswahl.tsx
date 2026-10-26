"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { ortAusAdresseAnlegen, ortSuchen } from "./actions";

type Ort = { id: string; label: string; street: string; city: string };
type GeocodeTreffer = { label: string; position: { lat: number; lng: number }; sicher: boolean };

export function OrtAuswahl({
  titel,
  orte,
  wert,
  onChange,
}: {
  titel: string;
  orte: Ort[];
  wert: string;
  onChange: (placeId: string) => void;
}) {
  const [neueAdresseOffen, setNeueAdresseOffen] = useState(false);
  const [suchtext, setSuchtext] = useState("");
  const [sucht, setSucht] = useState(false);
  const [treffer, setTreffer] = useState<GeocodeTreffer[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);

  async function suchen() {
    setSucht(true);
    setFehler(null);
    try {
      const ergebnis = await ortSuchen(suchtext);
      if (ergebnis.length === 0) {
        setFehler("Nichts gefunden. Bitte Adresse prüfen oder genauer eingeben.");
      }
      setTreffer(ergebnis);
    } finally {
      setSucht(false);
    }
  }

  async function uebernehmen(treffer: GeocodeTreffer) {
    const teile = treffer.label.split(",").map((t) => t.trim());
    const neuerOrt = await ortAusAdresseAnlegen({
      label: teile[0] || treffer.label,
      street: teile[0] || treffer.label,
      zip: "",
      city: teile[1] || "",
      lat: treffer.position.lat,
      lng: treffer.position.lng,
    });
    onChange(neuerOrt.id);
    setNeueAdresseOffen(false);
    setTreffer([]);
    setSuchtext("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink">{titel}</label>
      {!neueAdresseOffen ? (
        <>
          <select
            value={wert}
            onChange={(event) => onChange(event.target.value)}
            className="h-11 rounded-xl border border-line-strong bg-surface px-3 text-base text-ink"
          >
            <option value="">– bitte wählen –</option>
            {orte.map((ort) => (
              <option key={ort.id} value={ort.id}>
                {ort.label} ({ort.city})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setNeueAdresseOffen(true)}
            className="self-start text-sm font-medium text-accent hover:underline"
          >
            Neue Adresse eingeben
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <TextField
              label="Adresse"
              value={suchtext}
              onChange={(event) => setSuchtext(event.target.value)}
              placeholder="Straße, Hausnummer, Ort"
            />
            <Button type="button" variant="secondary" onClick={suchen} disabled={sucht || !suchtext.trim()}>
              {sucht ? "…" : "Suchen"}
            </Button>
          </div>
          {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : null}
          <div className="flex flex-col gap-1">
            {treffer.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => uebernehmen(t)}
                className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-accent"
              >
                <span>{t.label}</span>
                <span className={t.sicher ? "text-accent" : "text-warn-ink"}>
                  {t.sicher ? "sicher" : "unsicher"}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setNeueAdresseOffen(false)}
            className="self-start text-sm font-medium text-muted hover:text-ink"
          >
            Bestehenden Ort wählen
          </button>
        </div>
      )}
    </div>
  );
}
