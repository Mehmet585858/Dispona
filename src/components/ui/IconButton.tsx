import { type ButtonHTMLAttributes } from "react";

/**
 * Quadratischer Symbol-Knopf (docs/DESIGN-GUIDE.md 5.1 „Icon“, ergänzt 02.11.2026), z. B. ‹ › zum
 * Blättern. `aria-label` ist Pflicht, weil das Symbol allein nichts sagt.
 */
export function IconButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string }) {
  return (
    <button
      type="button"
      className={`flex h-10 w-10 flex-none items-center justify-center rounded-[10px] border border-line bg-surface text-lg text-ink hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
