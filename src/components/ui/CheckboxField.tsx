import { type InputHTMLAttributes, type ReactNode, useId } from "react";

/**
 * Häkchen mit Beschriftung daneben (docs/DESIGN-GUIDE.md 5.7, ergänzt 02.11.2026), z. B.
 * „Scalamobil an Bord“, „Treppe“, „Einweisung Scalamobil“. Optional ein grauer Hinweis darunter.
 */
export function CheckboxField({
  label,
  hint,
  id,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode; hint?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium text-ink">
        <input id={inputId} type="checkbox" className="h-[18px] w-[18px] flex-none accent-[var(--color-accent)]" {...props} />
        <span>{label}</span>
      </label>
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}
