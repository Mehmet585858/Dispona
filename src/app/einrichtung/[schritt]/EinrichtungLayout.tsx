"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { EINRICHTUNG_SCHRITTE, LETZTER_SCHRITT } from "@/core/einrichtung/schritte";
import { authClient } from "@/lib/auth-client";
import { schrittAbschliessen } from "./actions";

export function EinrichtungLayout({
  schritt,
  erledigtBis,
  firmenname,
  children,
}: {
  schritt: number;
  /** Höchster bereits erreichter Schritt (Tenant.setupStep) – erlaubt direktes Springen dorthin. */
  erledigtBis: number;
  firmenname: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [wechselt, setWechselt] = useState(false);

  async function weiter() {
    setWechselt(true);
    try {
      await schrittAbschliessen(schritt);
      if (schritt >= LETZTER_SCHRITT) {
        router.push("/dispo");
        router.refresh();
      } else {
        router.push(`/einrichtung/${schritt + 1}`);
      }
    } finally {
      setWechselt(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-4">
        <span className="flex items-center gap-3">
          <Logo className="h-6 text-ink" />
          <span className="text-lg font-semibold text-ink">Einrichtung</span>
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{firmenname}</span>
          <button
            type="button"
            onClick={() => authClient.signOut().then(() => router.push("/anmeldung"))}
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Abmelden
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 lg:flex-row">
        <aside className="shrink-0 lg:w-64">
          <ProgressSteps
            schritte={EINRICHTUNG_SCHRITTE}
            aktuell={schritt}
            erledigtBis={erledigtBis}
            onSchrittWaehlen={(nummer) => router.push(`/einrichtung/${nummer}`)}
          />
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <footer className="sticky bottom-0 flex items-center justify-between border-t border-line bg-surface px-6 py-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(`/einrichtung/${schritt - 1}`)}
          disabled={schritt <= 1}
        >
          Zurück
        </Button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={weiter} disabled={wechselt} className="text-sm font-medium text-muted hover:text-ink">
            Später erledigen
          </button>
          <Button type="button" onClick={weiter} disabled={wechselt}>
            {wechselt
              ? "Einen Moment …"
              : schritt >= LETZTER_SCHRITT
                ? "Fertig"
                : `Weiter: ${EINRICHTUNG_SCHRITTE[schritt]?.titel ?? ""}`}
          </Button>
        </div>
      </footer>
    </div>
  );
}
