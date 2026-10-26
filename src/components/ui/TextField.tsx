import { type InputHTMLAttributes, useId } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function TextField({ label, hint, id, className = "", ...props }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        className={`min-h-11 rounded-xl border border-line-strong bg-surface px-4 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft ${className}`}
        {...props}
      />
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}
