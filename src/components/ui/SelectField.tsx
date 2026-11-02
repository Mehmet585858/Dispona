import { type ReactNode, type SelectHTMLAttributes, useId } from "react";

/**
 * Auswahlfeld mit Beschriftung darüber (docs/DESIGN-GUIDE.md 5.7, ergänzt 02.11.2026): 44 px hoch,
 * Radius 10, Fokus-Ring. `fehler` erscheint direkt darunter in Rot (Formularfehler), `hint` grau.
 */
export function SelectField({
  label,
  hint,
  fehler,
  id,
  children,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; fehler?: string; children: ReactNode }) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-semibold text-ink-soft">
        {label}
      </label>
      <select
        id={selectId}
        className={`min-h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:opacity-60 ${className}`}
        {...props}
      >
        {children}
      </select>
      {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}
