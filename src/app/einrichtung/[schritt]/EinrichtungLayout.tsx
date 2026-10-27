"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
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
        <span className="text-lg font-semibold text-ink">Fahrdienst-KI – Einrichtung</span>
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
          <p className="mb-3 text-sm font-medium text-muted">
            Schritt {schritt} von {LETZTER_SCHRITT}
          </p>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${(schritt / LETZTER_SCHRITT) * 100}%` }}
            />
          </div>
          <ol className="flex flex-col gap-1">
            {EINRICHTUNG_SCHRITTE.map((s) => {
              const erreichbar = s.nummer <= erledigtBis;
              return (
                <li key={s.nummer}>
                  <button
                    type="button"
                    disabled={!erreichbar}
                    onClick={() => router.push(`/einrichtung/${s.nummer}`)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                      s.nummer === schritt
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
