import { Card } from "@/components/ui/Card";
import { SignOutButton } from "@/components/SignOutButton";
import { fahrerUebersichtLaden } from "./actions";
import { FahrerClient } from "./FahrerClient";

export default async function FahrerPage() {
  const uebersicht = await fahrerUebersichtLaden().catch(() => null);

  if (!uebersicht) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <h1 className="mb-2 text-2xl font-semibold text-ink">Kein Fahrer-Profil</h1>
          <p className="mb-6 text-ink-soft">
            Zu Ihrem Konto gehört kein Fahrer-Profil. Bitte wenden Sie sich an Ihre Disposition.
          </p>
          <SignOutButton />
        </Card>
      </main>
    );
  }

  return (
    <FahrerClient
      name={uebersicht.name}
      schichten={uebersicht.schichten}
      fahrten={uebersicht.fahrten}
      laufendeSchichtId={uebersicht.laufendeSchichtId}
      gpsConsentAt={uebersicht.gpsConsentAt}
    />
  );
}
