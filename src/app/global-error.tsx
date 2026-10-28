"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Fängt Fehler ab, die irgendwo in der App auftreten und sonst nirgends behandelt werden –
 * meldet sie an Sentry (siehe src/sentry.server.config.ts) und zeigt eine einfache Seite statt
 * eines weißen Bildschirms. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="de">
      <body className="flex min-h-screen items-center justify-center bg-ground p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-ink">Etwas ist schiefgelaufen</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Der Fehler wurde automatisch gemeldet. Bitte die Seite neu laden oder es gleich noch einmal
            versuchen.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Seite neu laden
          </button>
        </div>
      </body>
    </html>
  );
}
