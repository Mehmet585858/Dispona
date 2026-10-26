"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { authClient } from "@/lib/auth-client";
import { ermittleAnmeldeMethode } from "./actions";

type Schritt = "email" | "code-warten" | "link-gesendet";

export default function AnmeldungPage() {
  const router = useRouter();
  const [schritt, setSchritt] = useState<Schritt>("email");
  const [email, setEmail] = useState("");
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
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold text-ink">Anmelden</h1>
        <p className="mb-6 text-sm text-muted">Fahrdienst-KI – Büro und Fahrer</p>

        {schritt === "email" && (
          <form onSubmit={emailAbsenden} className="flex flex-col gap-4">
            <TextField
              label="Ihre E-Mail-Adresse"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : null}
            <Button type="submit" disabled={ladend}>
              {ladend ? "Einen Moment …" : "Weiter"}
            </Button>
          </form>
        )}

        {schritt === "code-warten" && (
          <form onSubmit={codeAbsenden} className="flex flex-col gap-4">
            <p className="text-sm text-ink-soft">
              Wir haben Ihnen einen 6-stelligen Code geschickt. Bitte hier eintragen:
            </p>
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
            <Button type="submit" disabled={ladend}>
              {ladend ? "Einen Moment …" : "Anmelden"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setSchritt("email")}>
              Andere E-Mail-Adresse
            </Button>
          </form>
        )}

        {schritt === "link-gesendet" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-soft">
              Wir haben Ihnen einen Anmelde-Link geschickt. Öffnen Sie ihn auf Ihrem Handy, um sich
              anzumelden.
            </p>
            <Button type="button" variant="secondary" onClick={() => setSchritt("email")}>
              Andere E-Mail-Adresse
            </Button>
          </div>
        )}
      </Card>
    </main>
  );
}
