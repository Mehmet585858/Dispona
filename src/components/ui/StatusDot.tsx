// docs/DESIGN-GUIDE.md Abschnitt 2 "Live-Status": Punkt 8px + Text, nie nur Farbe allein.
const FARBE: Record<string, string> = {
  frei: "#b4bcc6",
  faehrt_zum_fahrgast: "#c8a15a",
  fahrgast_im_auto: "#5873a8",
  fahrgast_am_ziel: "#5e8c6a",
  verspaetet: "#d97706",
  pause: "#b4bcc6",
};

export type LiveStatus = keyof typeof FARBE;

export function StatusDot({ status, children }: { status: LiveStatus; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: FARBE[status] }}
      />
      {children}
    </span>
  );
}
