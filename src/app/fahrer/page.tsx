import { SignOutButton } from "@/components/SignOutButton";
import { Card } from "@/components/ui/Card";
import { getServerSession } from "@/lib/session";

export default async function FahrerPage() {
  const session = await getServerSession();

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <h1 className="mb-2 text-2xl font-semibold text-ink">Guten Tag, {session?.user.name}</h1>
        <p className="mb-6 text-ink-soft">
          Ihre Fahrten für heute erscheinen hier – die Fahrer-App entsteht in Phase 5.
        </p>
        <SignOutButton />
      </Card>
    </main>
  );
}
