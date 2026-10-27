/**
 * Nummerierte Fortschrittsanzeige für mehrstufige Abläufe (docs/DESIGN-GUIDE.md Abschnitt 10):
 * Balken + Schrittliste, bei der sich zu bereits erreichten Schritten springen lässt.
 */
export type ProgressStepsSchritt = { nummer: number; titel: string };

export function ProgressSteps({
  schritte,
  aktuell,
  erledigtBis,
  onSchrittWaehlen,
}: {
  schritte: readonly ProgressStepsSchritt[];
  aktuell: number;
  /** Höchster bereits erreichter Schritt – bis hierhin (einschließlich) ist Springen erlaubt. */
  erledigtBis: number;
  onSchrittWaehlen: (nummer: number) => void;
}) {
  const letzterSchritt = schritte[schritte.length - 1]?.nummer ?? aktuell;

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-muted">
        Schritt {aktuell} von {letzterSchritt}
      </p>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${(aktuell / letzterSchritt) * 100}%` }}
        />
      </div>
      <ol className="flex flex-col gap-1">
        {schritte.map((s) => {
          const erreichbar = s.nummer <= erledigtBis;
          return (
            <li key={s.nummer}>
              <button
                type="button"
                disabled={!erreichbar}
                onClick={() => onSchrittWaehlen(s.nummer)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                  s.nummer === aktuell
                    ? "bg-accent-soft font-medium text-accent"
                    : erreichbar
                      ? "text-ink-soft hover:bg-accent-soft"
                      : "cursor-not-allowed text-muted"
                }`}
              >
                <span className="tabular-nums">{s.nummer}.</span> {s.titel}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
