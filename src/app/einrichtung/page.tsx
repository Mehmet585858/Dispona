import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { Card } from "@/components/ui/Card";
import { getServerSession } from "@/lib/session";

const bereiche = [
  { href: "/dispo/fahrzeuge", label: "Fahrzeuge" },
  { href: "/dispo/fahrer", label: "Fahrer & Schichten" },
  { href: "/dispo/fahrgaeste", label: "Fahrgäste" },
  { href: "/dispo/orte", label: "Orte" },
];

export default async function EinrichtungPage() {
  const session = await getServerSession();

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <h1 className="mb-2 text-2xl font-semibold text-ink">Willkommen bei Fahrdienst-KI</h1>
        <p className="mb-6 text-ink-soft">
          Angemeldet als {session?.user.name} ({session?.user.email}). Der geführte
          Einrichtungsassistent mit den 8 Schritten entsteht in Phase 9. Bis dahin können Sie die
          schon fertigen Bereiche direkt ausprobieren:
        </p>
        <div className="mb-6 flex flex-col gap-2">
          {bereiche.map((bereich) => (
            <Link
              key={bereich.href}
              href={bereich.href}
              className="flex min-h-11 items-center justify-center rounded-xl border border-line-strong bg-surface px-5 text-base font-medium text-ink hover:bg-accent-soft"
            >
              {bereich.label}
            </Link>
          ))}
        </div>
        <SignOutButton />
      </Card>
    </main>
  );
}
