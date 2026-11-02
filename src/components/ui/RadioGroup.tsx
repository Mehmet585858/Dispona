import { type ReactNode } from "react";

/**
 * Auswahl einer Möglichkeit aus wenigen (docs/DESIGN-GUIDE.md 5.7, ergänzt 02.11.2026): echte
 * Radio-Knöpfe in umrandeten Zeilen, die gewählte Zeile in Schiefergrau hervorgehoben. Darunter
 * optional ein Hinweis (z. B. „4 Tage. Bisherige Schichten werden ersetzt.“).
 */
export function RadioGroup<T extends string>({
  legende,
  name,
  wert,
  optionen,
  onChange,
  hinweis,
}: {
  legende: string;
  name: string;
  wert: T;
  optionen: { wert: T; label: ReactNode }[];
  onChange: (wert: T) => void;
  hinweis?: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-ink-soft">{legende}</legend>
      {optionen.map((option) => (
        <label
          key={option.wert}
          className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm font-medium text-ink ${
            wert === option.wert ? "border-accent bg-accent-soft" : "border-line"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.wert}
            checked={wert === option.wert}
            onChange={() => onChange(option.wert)}
            className="h-[18px] w-[18px] flex-none accent-[var(--color-accent)]"
          />
          {option.label}
        </label>
      ))}
      {hinweis ? <p className="text-sm text-muted">{hinweis}</p> : null}
    </fieldset>
  );
}
