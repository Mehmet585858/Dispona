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
        {/* Kein flex-wrap mehr: bei mittleren Breiten (~591-800px, z. B. kleineres Laptop-Fenster
         * oder Tablet quer) brach die Navigation sonst unschön über zwei Zeilen um, mit der
         * letzten Reihe allein hängend. Stattdessen scrollt der Link-Block jetzt horizontal,
         * während Name/Abmelden rechts immer sichtbar fix stehen bleiben - bei voller
         * Desktop-Breite unverändert einzeilig, ohne jeden Scrollbedarf. */}
        <div className="flex w-full items-center justify-between gap-3 px-6 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            <Link href="/dispo" className="mr-4 flex flex-none items-center">
              <Logo className="h-6 text-ink" />
            </Link>
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex-none rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-accent-soft hover:text-accent"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-none items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{session?.user.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="w-full flex-1 px-6 py-8">{children}</div>
    </div>
  );
}
