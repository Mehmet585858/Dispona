"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/TextField";
import { fahrgaesteSuchen } from "./actions";

type Fahrgast = { id: string; firstName: string; lastName: string };

export function FahrgastAuswahl({
  wert,
  onChange,
}: {
  wert: { id: string; name: string } | null;
  onChange: (fahrgast: { id: string; name: string } | null) => void;
}) {
  const [suchtext, setSuchtext] = useState("");
  const [treffer, setTreffer] = useState<Fahrgast[]>([]);
  const [sucht, setSucht] = useState(false);

  async function suchen(text: string) {
    setSuchtext(text);
    if (text.trim().length < 2) {
      setTreffer([]);
      return;
    }
    setSucht(true);
    try {
      const ergebnis = await fahrgaesteSuchen(text);
      setTreffer(ergebnis);
    } finally {
      setSucht(false);
    }
  }

  if (wert) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">Fahrgast</label>
        <div className="flex items-center justify-between rounded-xl border border-line-strong bg-surface px-4 py-2.5">
          <span>{wert.name}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-sm font-medium text-accent hover:underline"
          >
            Ändern
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <TextField
        label="Fahrgast (Name oder Telefonnummer)"
        value={suchtext}
        onChange={(event) => suchen(event.target.value)}
        autoFocus
      />
      {sucht ? <p className="text-sm text-muted">Suche …</p> : null}
      {treffer.length > 0 ? (
        <div className="flex flex-col gap-1">
          {treffer.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                onChange({ id: f.id, name: `${f.firstName} ${f.lastName}` });
                setTreffer([]);
              }}
              className="rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-accent"
            >
              {f.firstName} {f.lastName}
            </button>
          ))}
        </div>
      ) : null}
      {!sucht && suchtext.trim().length >= 2 && treffer.length === 0 ? (
        <p className="text-sm text-muted">
          Kein Fahrgast gefunden. Legen Sie ihn zuerst unter „Fahrgäste&quot; an.
        </p>
      ) : null}
    </div>
  );
}
