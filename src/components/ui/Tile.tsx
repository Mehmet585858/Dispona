"use client";

type Props = {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: string;
};

/** Auswahlkachel, z. B. für Beförderungsart oder Fahrzeug-Ausstattung. */
export function Tile({ label, active, onClick, icon }: Props) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-line bg-surface text-ink-soft hover:border-line-strong"
      }`}
    >
      {icon ? <span aria-hidden className="text-xl">{icon}</span> : null}
      {label}
    </button>
  );
}
