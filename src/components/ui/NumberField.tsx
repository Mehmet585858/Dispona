"use client";

import { useId } from "react";

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  id?: string;
};

export function NumberField({ label, value, onChange, min = 0, max = 99, id }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  function setzen(nächsterWert: number) {
    onChange(Math.min(max, Math.max(min, nächsterWert)));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`${label} verringern`}
          onClick={() => setzen(value - 1)}
          disabled={value <= min}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-line-strong bg-surface text-xl text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(event) => setzen(Number(event.target.value) || 0)}
          className="h-11 w-16 rounded-xl border border-line-strong bg-surface text-center text-base tabular-nums text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
        <button
          type="button"
          aria-label={`${label} erhöhen`}
          onClick={() => setzen(value + 1)}
          disabled={value >= max}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-line-strong bg-surface text-xl text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
