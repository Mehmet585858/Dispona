"use client";

import { useEffect, useRef, useState } from "react";
import { gesehenBestaetigen } from "./actions";

function toneAbspielen() {
  try {
    const AudioContextKlasse = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const kontext = new AudioContextKlasse();
    const oszillator = kontext.createOscillator();
    const lautstaerke = kontext.createGain();
    oszillator.frequency.value = 880;
    lautstaerke.gain.value = 0.15;
    oszillator.connect(lautstaerke).connect(kontext.destination);
    oszillator.start();
    oszillator.stop(kontext.currentTime + 0.3);
    oszillator.onended = () => kontext.close();
  } catch {
    // Kein Ton nötig – der Vollbild-Hinweis reicht als Signal.
  }
}

/** Vollbild-Hinweis mit Ton für eine neue oder geänderte Fahrt, bis der Fahrer "Gesehen" drückt (docs/06-oberflaeche.md). */
export function GesehenUeberlagerung({
  rideId,
  uhrzeit,
  vonOrt,
  nachOrt,
  onBestaetigt,
}: {
  rideId: string;
  uhrzeit: string;
  vonOrt: string;
  nachOrt: string;
  onBestaetigt: () => void;
}) {
  const [laedt, setLaedt] = useState(false);
  const gespieltFuer = useRef<string | null>(null);

  useEffect(() => {
    if (gespieltFuer.current === rideId) return;
    gespieltFuer.current = rideId;
    toneAbspielen();
  }, [rideId]);

  async function bestaetigen() {
    setLaedt(true);
    try {
      await gesehenBestaetigen(rideId);
      onBestaetigt();
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-accent p-6 text-center text-surface">
      <p className="text-sm font-medium uppercase tracking-wide opacity-80">Neue Fahrt</p>
      <p className="text-4xl font-semibold tabular-nums">{uhrzeit}</p>
      <div className="flex flex-col gap-1 text-lg">
        <p>{vonOrt}</p>
        <p>↓</p>
        <p>{nachOrt}</p>
      </div>
      <button
        type="button"
        onClick={bestaetigen}
        disabled={laedt}
        className="mt-4 flex min-h-16 w-full max-w-xs items-center justify-center rounded-2xl bg-surface px-8 text-lg font-semibold text-accent transition-colors hover:bg-surface/90 disabled:opacity-50"
      >
        {laedt ? "…" : "Gesehen"}
      </button>
    </div>
  );
}
