import { type ReactNode } from "react";

/**
 * Kasten für Hinweise und Fehler (docs/DESIGN-GUIDE.md 5.9, ergänzt 02.11.2026). „warn“ =
 * Orange, braucht Aufmerksamkeit (z. B. „3 Fahrten liegen in dieser Schicht“); „fehler“ = Rot,
 * nur für Formularfehler. Fehler werden per role="alert" sofort angesagt.
 */
export function Hinweisbox({ ton, titel, children }: { ton: "warn" | "fehler"; titel?: string; children: ReactNode }) {
  const stil = ton === "warn" ? "border-warn-bd bg-warn-bg text-warn-ink" : "border-danger-bd bg-danger-bg text-danger-ink";
  return (
    <div role={ton === "fehler" ? "alert" : "status"} className={`flex flex-col gap-2 rounded-[10px] border px-3 py-2.5 text-sm ${stil}`}>
      {titel ? <p className="font-semibold">{titel}</p> : null}
      {children}
    </div>
  );
}
