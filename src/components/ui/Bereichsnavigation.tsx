"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type NavEintrag = { href: string; label: string };

/**
 * Bereichsnavigation nach docs/DESIGN-GUIDE.md Abschnitt 6: "Unter ca. 1000 px rutscht das
 * Seitenpanel nach unten, die Navigation wird zum Menü." Darunter also kein horizontales
 * Umbrechen/Scrollen der Links mehr, sondern ein echter Menü-Knopf mit Dropdown - darüber
 * unverändert eine einzeilige Leiste. Aktiver Bereich als Pille hervorgehoben (bg-accent-soft/
 * text-accent, derselbe Ton wie der aktive Schritt in ProgressSteps.tsx und das aktive Tile in
 * Tile.tsx - konsistent mit dem im Projekt bereits etablierten Aktiv-Zustand statt der im Guide
 * nur als Vorschlag genannten, im Code aber nirgends sonst verwendeten chip-bg-Farbe).
 *
 * linksKlickbar=false (Live-Demo): rendert dieselben Einträge als reinen Text ohne echte Links,
 * damit anonyme Besucher nicht auf Seiten geschickt werden, die sie sofort zum Login zurückwerfen.
 */
export function Bereichsnavigation({ items, linksKlickbar = true }: { items: NavEintrag[]; linksKlickbar?: boolean }) {
  const pathname = usePathname();
  const [offen, setOffen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Beim Wechsel der Seite (echter Link geklickt) das geöffnete Menü wieder schließen - während
  // des Renderns angepasst statt in einem Effect (React-Muster fürs Zurücksetzen von State bei
  // einer geänderten Prop, vermeidet einen zusätzlichen Render-Durchlauf).
  const [letzterPfad, setLetzterPfad] = useState(pathname);
  if (pathname !== letzterPfad) {
    setLetzterPfad(pathname);
    setOffen(false);
  }

  useEffect(() => {
    if (!offen) return;
    function aufKlickAussen(ev: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(ev.target as Node)) setOffen(false);
    }
    function aufEsc(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOffen(false);
    }
    document.addEventListener("mousedown", aufKlickAussen);
    document.addEventListener("keydown", aufEsc);
    return () => {
      document.removeEventListener("mousedown", aufKlickAussen);
      document.removeEventListener("keydown", aufEsc);
    };
  }, [offen]);

  function istAktiv(href: string): boolean {
    return href === "/dispo" ? pathname === href : pathname.startsWith(href);
  }

  function eintragKlasse(href: string): string {
    const aktiv = linksKlickbar && istAktiv(href);
    return `rounded-lg px-3 py-2 text-sm font-medium ${
      aktiv ? "bg-accent-soft font-semibold text-accent" : "text-ink-soft hover:bg-accent-soft hover:text-accent"
    }`;
  }

  return (
    <div ref={wrapperRef} className="relative flex items-center">
      {/* Ab 1024px (Guide: "ca. 1000 px") eine normale, einzeilige Leiste. */}
      <div className="hidden items-center gap-1 lg:flex">
        {items.map((item) =>
          linksKlickbar ? (
            <Link key={item.href} href={item.href} className={eintragKlasse(item.href)}>
              {item.label}
            </Link>
          ) : (
            <span key={item.href} className={eintragKlasse(item.href)}>
              {item.label}
            </span>
          ),
        )}
      </div>

      {/* Darunter ein echter Menü-Knopf statt umbrechender/scrollender Links. */}
      <button
        type="button"
        aria-label={offen ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={offen}
        onClick={() => setOffen((v) => !v)}
        className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-line text-ink-soft hover:bg-accent-soft hover:text-accent lg:hidden"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          {offen ? "✕" : "☰"}
        </span>
      </button>

      {offen ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+8px)] z-30 flex w-60 flex-col gap-1 rounded-xl border border-line bg-surface p-2 shadow-lg lg:hidden"
        >
          {items.map((item) =>
            linksKlickbar ? (
              <Link key={item.href} role="menuitem" href={item.href} className={eintragKlasse(item.href)}>
                {item.label}
              </Link>
            ) : (
              <span key={item.href} role="menuitem" className={eintragKlasse(item.href)}>
                {item.label}
              </span>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
