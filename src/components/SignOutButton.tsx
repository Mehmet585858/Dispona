"use client";

import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={async () => {
        await authClient.signOut();
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
