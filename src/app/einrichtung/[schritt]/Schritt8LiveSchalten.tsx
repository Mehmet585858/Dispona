"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { liveSchalten, type AiZeitplanModus } from "./actions";

const OPTIONEN: { wert: AiZeitplanModus; label: string; hinweis: string }[] = [
  { wert: "AUS", label: "Noch nicht", hinweis: "Die KI nimmt noch keine Anrufe an." },
  {
    wert: "NACHTS_WOCHENENDE",
    label: "Nur nachts und am Wochenende",
    hinweis: "Empfehlung zum Start, z. B. zusätzlich bei Nichtmelden tagsüber.",
  },
  { wert: "IMMER", label: "Rund um die Uhr", hinweis: "Die KI nimmt jeden weitergeleiteten Anruf an." },
];

export function Schritt8LiveSchalten({ aktuellerModus }: { aktuellerModus: AiZeitplanModus }) {
  const router = useRouter();
  const [modus, setModus] = useState<AiZeitplanModus>(aktuellerModus);
  const [speichert, setSpeichert] = useState(false);

  async function uebernehmen() {
    setSpeichert(true);
    try {
      await liveSchalten(modus);
      router.push("/dispo");
      router.refresh();
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Live schalten</h1>
        <p className="text-sm text-muted">Wann soll die KI Anrufe annehmen?</p>
      </div>

      <Card className="flex flex-col gap-2">
        {OPTIONEN.map((option) => (
          <label
            key={option.wert}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
              modus === option.wert ? "border-accent bg-accent-soft" : "border-line"
            }`}
          >
            <input
              type="radio"
              name="modus"
              checked={modus === option.wert}
              onChange={() => setModus(option.wert)}
              className="mt-1 h-5 w-5"
            />
            <span>
              <span className="block font-medium text-ink">{option.label}</span>
              <span className="block text-sm text-muted">{option.hinweis}</span>
            </span>
          </label>
        ))}
      </Card>

      <div>
        <Button type="button" onClick={uebernehmen} disabled={speichert}>
          {speichert ? "Einen Moment …" : "Übernehmen und Einrichtung abschließen"}
        </Button>
      </div>
    </div>
  );
}
