import { SignOutButton } from "@/components/SignOutButton";
import { Card } from "@/components/ui/Card";
import { getServerSession } from "@/lib/session";

export default async function DispoPage() {
  const session = await getServerSession();

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <h1 className="mb-2 text-2xl font-semibold text-ink">Disponenten-Startseite</h1>
        <p className="mb-6 text-ink-soft">
          Angemeldet als {session?.user.name} ({session?.user.email}). Fahrten, Karte und Tagesplan
          entstehen in den nächsten Phasen.
        </p>
        <SignOutButton />
      </Card>
    </main>
  );
}
