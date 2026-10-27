/** Kennzahl-Kachel (docs/DESIGN-GUIDE.md 5.3). Höchstens 4–5 je Seite, Warnstil nur bei Handlungsbedarf. */
export function KpiTile({
  label,
  wert,
  zusatz,
  warnstil,
}: {
  label: string;
  wert: number | string;
  zusatz?: string;
  warnstil?: boolean;
}) {
  return (
    <div className={`rounded-[14px] border border-line p-4 ${warnstil ? "bg-warn-bg" : "bg-surface"}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${warnstil ? "text-warn-ink" : "text-ink"}`}>{wert}</p>
      {zusatz ? <p className="text-[13px] text-muted">{zusatz}</p> : null}
    </div>
  );
}
