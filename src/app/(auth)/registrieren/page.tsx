"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { authClient } from "@/lib/auth-client";
import { firmaRegistrieren } from "./actions";

export default function RegistrierenPage() {
  const router = useRouter();
  const [firmenname, setFirmenname] = useState("");
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [email, setEmail] = useState("");
  const [handynummer, setHandynummer] = useState("");
  const [ladend, setLadend] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(event: FormEvent) {
    event.preventDefault();
    setFehler(null);
    setLadend(true);
    try {
      const ergebnis = await firmaRegistrieren({ firmenname, vorname, nachname, email, handynummer });
      if (!ergebnis.ok) {
        setFehler(ergebnis.fehler);
        return;
      }
      const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
      if (error) {
        setFehler(error.message ?? "Der Code konnte nicht gesendet werden.");
        return;
      }
      router.push(`/anmeldung?email=${encodeURIComponent(email)}`);
    } finally {
      setLadend(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold text-ink">Neuen Fahrdienst anlegen</h1>
        <p className="mb-6 text-sm text-muted">
          In wenigen Minuten eingerichtet. Als Nächstes führen wir Sie Schritt für Schritt durch.
        </p>
        <form onSubmit={absenden} className="flex flex-col gap-4">
          <TextField
            label="Name Ihres Fahrdienstes"
            required
            autoFocus
            value={firmenname}
            onChange={(event) => setFirmenname(event.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Vorname" required value={vorname} onChange={(event) => setVorname(event.target.value)} />
            <TextField label="Nachname" required value={nachname} onChange={(event) => setNachname(event.target.value)} />
          </div>
          <TextField
            label="Ihre E-Mail-Adresse"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label="Ihre Handynummer"
            type="tel"
            required
            placeholder="+49 170 1234567"
            value={handynummer}
            onChange={(event) => setHandynummer(event.target.value)}
            hint="Wird zunächst als Alarm- und Weiterleitungsnummer genutzt, später änderbar."
          />
          {fehler ? <p className="text-sm text-danger-ink">{fehler}</p> : null}
          <Button type="submit" disabled={ladend}>
            {ladend ? "Einen Moment …" : "Fahrdienst anlegen"}
          </Button>
        </form>
        <Link href="/anmeldung" className="mt-4 block text-center text-sm font-medium text-accent hover:underline">
          Schon registriert? Anmelden
        </Link>
      </Card>
    </main>
  );
}
