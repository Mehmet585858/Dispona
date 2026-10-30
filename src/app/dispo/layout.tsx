import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/SignOutButton";
import { Logo } from "@/components/ui/Logo";
import { Bereichsnavigation } from "@/components/ui/Bereichsnavigation";
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
        {/* docs/DESIGN-GUIDE.md Abschnitt 6: "Unter ca. 1000 px ... wird die Navigation zum Menü" -
         * Bereichsnavigation übernimmt das (Leiste ab 1024px, darunter ein echter Menü-Knopf),
         * statt wie zuvor nur horizontal zu scrollen. */}
        <div className="flex w-full items-center justify-between gap-3 px-6 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link href="/dispo" className="flex flex-none items-center">
              <Logo className="h-6 text-ink" />
            </Link>
            <Bereichsnavigation items={navigation} />
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
