import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/SignOutButton";
import { Logo } from "@/components/ui/Logo";
import { getServerSession } from "@/lib/session";

const navigation = [
  { href: "/dispo", label: "Dashboard" },
  { href: "/dispo/fahrzeuge", label: "Fahrzeuge" },
  { href: "/dispo/fahrgaeste", label: "Fahrgäste" },
  { href: "/dispo/orte", label: "Orte" },
  { href: "/dispo/anrufe", label: "Anrufe" },
  { href: "/dispo/auswertung", label: "Auswertung" },
  { href: "/dispo/einstellungen", label: "Einstellungen" },
];

export default async function DispoLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex flex-wrap items-center gap-1">
            <Link href="/dispo" className="mr-4 flex items-center">
              <Logo className="h-6 text-ink" />
            </Link>
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-accent-soft hover:text-accent"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">{session?.user.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</div>
    </div>
  );
}
