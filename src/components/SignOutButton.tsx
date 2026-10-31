"use client";

import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";
import { geraeteDatenLoeschen } from "@/app/fahrer/geraeteDaten";

export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={async () => {
        // Lokale Daten (Tages-Cache, Offline-Warteschlange) vor UND nach dem Abmelden löschen –
        // vorher, damit nichts bleibt, falls signOut fehlschlägt; nachher gegen Einträge, die
        // währenddessen noch geschrieben wurden (Prüfbericht S2-012).
        await geraeteDatenLoeschen();
        await authClient.signOut();
        await geraeteDatenLoeschen();
        // Volles Neuladen statt Client-Navigation, damit kein alter Formular-Zustand
        // (z. B. ein zuvor eingetippter Code) auf der Anmeldeseite hängen bleibt.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/anmeldung";
      }}
    >
      Abmelden
    </Button>
  );
}
