import { type InputHTMLAttributes, type ReactNode, useId } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  icon?: ReactNode;
};

export function TextField({ label, hint, icon, id, className = "", ...props }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted">
            {icon}
          </span>
        ) : null}
        <input
          id={inputId}
          className={`min-h-11 w-full rounded-xl border border-line-strong bg-surface px-4 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft ${icon ? "pl-11" : ""} ${className}`}
          {...props}
        />
      </div>
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}
