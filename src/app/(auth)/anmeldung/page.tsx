"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { TextField } from "@/components/ui/TextField";
import { authClient } from "@/lib/auth-client";
import { ermittleAnmeldeMethode } from "./actions";

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PfeilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Schritt = "email" | "code-warten" | "link-gesendet";

export default function AnmeldungPage() {
  return (
    <Suspense>
      <AnmeldungInhalt />
    </Suspense>
  );
}

function AnmeldungInhalt() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vorausgefuellteEmail = searchParams.get("email") ?? "";
  // Nach /registrieren ist der Code schon unterwegs – direkt zur Eingabe springen.
  const [schritt, setSchritt] = useState<Schritt>(vorausgefuellteEmail ? "code-warten" : "email");
  const [email, setEmail] = useState(vorausgefuellteEmail);
  const [code, setCode] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [ladend, setLadend] = useState(false);

  async function emailAbsenden(event: FormEvent) {
    event.preventDefault();
    setFehler(null);
    setLadend(true);
    try {
      const ergebnis = await ermittleAnmeldeMethode(email);
      if (!ergebnis.gefunden) {
        setFehler("Diese E-Mail-Adresse ist bei uns nicht hinterlegt.");
        return;
      }
      if (ergebnis.methode === "link") {
        const { error } = await authClient.signIn.magicLink({ email, callbackURL: "/" });
        if (error) {
          setFehler(error.message ?? "Der Link konnte nicht gesendet werden.");
          return;
        }
        setSchritt("link-gesendet");
      } else {
        const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
        if (error) {
          setFehler(error.message ?? "Der Code konnte nicht gesendet werden.");
          return;
        }
        setSchritt("code-warten");
      }
    } finally {
      setLadend(false);
    }
  }

  async function codeAbsenden(event: FormEvent) {
    event.preventDefault();
    setFehler(null);
    setLadend(true);
    try {
      const { error } = await authClient.signIn.emailOtp({ email, otp: code });
      if (error) {
        setFehler("Der Code stimmt nicht oder ist abgelaufen.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLadend(false);
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-10 text-white lg:flex">
        <Logo className="h-7 text-white" />
        <div>
          <span className="mb-5 block h-0.5 w-8 bg-[#5E8C6A]" />
          <h2 className="max-w-sm text-3xl font-semibold text-white">Jede Fahrt im Blick.</h2>
          <p className="mt-3 max-w-sm text-white/60">
            Anrufe annehmen, Fahrten planen, Fahrer einteilen, alles in einer Ansicht.
          </p>
        </div>
        <p className="text-sm text-white/40">© {new Date().getFullYear()} Dispona</p>
      </div>

      <div className="flex items-center justify-center bg-ground p-6">
        <div className="w-full max-w-sm">
          <Logo className="mb-10 h-7 text-ink lg:hidden" />

          {schritt === "email" && (
            <>
              <h1 className="mb-1 text-2xl font-bold text-ink">Willkommen zurück</h1>
              <p className="mb-6 text-muted">Melden Sie sich mit Ihrer E-Mail-Adresse an.</p>
              <form onSubmit={emailAbsenden} className="flex flex-col gap-4">
                <TextField
                  label="E-Mail-Adresse"
                  type="email"
                  placeholder="name@fahrdienst.de"
                  icon={<MailIcon />}
                  required
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : null}
                <Button type="submit" disabled={ladend} className="w-full gap-2">
                  {ladend ? "Einen Moment …" : "Weiter"}
                  {ladend ? null : <PfeilIcon />}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3 text-sm text-muted">
                <span className="h-px flex-1 bg-line" />
                Neu bei Dispona?
                <span className="h-px flex-1 bg-line" />
              </div>
              <Link href="/registrieren">
                <Button type="button" variant="secondary" className="w-full">
                  Neuen Fahrdienst anlegen
                </Button>
              </Link>
            </>
          )}

          {schritt === "code-warten" && (
            <>
              <h1 className="mb-1 text-2xl font-bold text-ink">Code eingeben</h1>
              <p className="mb-6 text-muted">
                Wir haben Ihnen einen 6-stelligen Code geschickt. Bitte hier eintragen:
              </p>
              <form onSubmit={codeAbsenden} className="flex flex-col gap-4">
                <TextField
                  label="Code"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
                {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : null}
                <Button type="submit" disabled={ladend} className="w-full">
                  {ladend ? "Einen Moment …" : "Anmelden"}
                </Button>
                <Button type="button" variant="secondary" className="w-full" onClick={() => setSchritt("email")}>
                  Andere E-Mail-Adresse
                </Button>
              </form>
            </>
          )}

          {schritt === "link-gesendet" && (
            <>
              <h1 className="mb-1 text-2xl font-bold text-ink">Link gesendet</h1>
              <p className="mb-6 text-muted">
                Wir haben Ihnen einen Anmelde-Link geschickt. Öffnen Sie ihn auf Ihrem Handy, um sich
                anzumelden.
              </p>
              <Button type="button" variant="secondary" className="w-full" onClick={() => setSchritt("email")}>
                Andere E-Mail-Adresse
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
