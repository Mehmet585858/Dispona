import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "quiet" | "danger";

const base =
  "inline-flex min-h-11 items-center justify-center rounded-[10px] px-5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

// docs/DESIGN-GUIDE.md 5.1: Primär = Hauptaktion (höchstens eine je Bereich), Sekundär =
// Nebenaktion, Leise = Navigation/Abbrechen, Gefahr = zerstörende Aktion (immer mit Rückfrage).
const variants: Record<Variant, string> = {
  primary: "bg-accent text-surface hover:bg-accent/90",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-accent-soft",
  quiet: "bg-transparent text-ink-soft hover:bg-accent-soft",
  danger: "bg-transparent text-danger-ink hover:bg-danger-bg",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
