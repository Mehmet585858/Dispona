"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { RUFUMLEITUNGS_ANLEITUNGEN, schleifenWarnungText, testanrufErfolgText, testanrufWarteText } from "@/core/einrichtung/texte";
import { kiNummerSpeichern, testanrufPruefen } from "./actions";

export function Schritt2Telefon({
  kiNummer,
  escalationNumber,
}: {
  kiNummer: string | null;
  escalationNumber: string;
}) {
  const [nummer, setNummer] = useState(kiNummer ?? "");
  const [gespeichert, setGespeichert] = useState(Boolean(kiNummer));
  const [speichert, setSpeichert] = useState(false);

  const [testetLaeuft, setTestetLaeuft] = useState(false);
  const [testErgebnis, setTestErgebnis] = useState<{ gefunden: boolean; anrufernummer?: string } | null>(null);
  const seitRef = useRef<string | null>(null);

  useEffect(() => {
    if (!testetLaeuft) return;
    const intervall = setInterval(async () => {
      if (!seitRef.current) return;
      const ergebnis = await testanrufPruefen(seitRef.current);
      if (ergebnis.gefunden) {
        setTestErgebnis(ergebnis);
        setTestetLaeuft(false);
      }
    }, 3000);
    return () => clearInterval(intervall);
  }, [testetLaeuft]);

  async function nummerSpeichern() {
    setSpeichert(true);
    try {
      await kiNummerSpeichern(nummer);
      setGespeichert(true);
    } finally {
      setSpeichert(false);
    }
  }

  function testStarten() {
    seitRef.current = new Date().toISOString();
    setTestErgebnis(null);
    setTestetLaeuft(true);
  }

  const schleife = gespeichert && nummer.trim() && escalationNumber.trim() === nummer.trim();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Telefon verbinden</h1>
        <p className="text-sm text-muted">
          Ihre bisherige Nummer bleibt bestehen – Sie leiten nur unbeantwortete oder besetzte Anrufe an die
          KI-Nummer weiter.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">Ihre KI-Nummer</h2>
        {gespeichert ? (
          <p className="text-2xl font-semibold tabular-nums text-accent">{nummer}</p>
        ) : (
          <p className="text-sm text-muted">
            Noch keine Nummer hinterlegt. Falls Sie schon eine von uns erhalten haben, tragen Sie sie hier ein.
          </p>
        )}
        <div className="flex items-end gap-3">
          <TextField label="KI-Nummer (E.164, z. B. +4924011112222)" value={nummer} onChange={(e) => setNummer(e.target.value)} />
          <Button type="button" variant="secondary" onClick={nummerSpeichern} disabled={speichert || !nummer.trim()}>
            {speichert ? "…" : "Übernehmen"}
          </Button>
        </div>
        {schleife ? <p className="text-sm text-danger-ink">{schleifenWarnungText()}</p> : null}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">Rufumleitung einrichten</h2>
        <div className="flex flex-col gap-4">
          {RUFUMLEITUNGS_ANLEITUNGEN.map((anleitung) => (
            <div key={anleitung.anbieter} className="rounded-xl border border-line p-3">
              <p className="mb-1.5 font-medium text-ink">{anleitung.anbieter}</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
                {anleitung.schritte.map((schritt, i) => (
                  <li key={i}>{schritt.replace("KI-NUMMER", nummer || "Ihrer KI-Nummer")}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Test: Kommt der Anruf an?</h2>
        <p className="text-sm text-muted">
          Rufen Sie jetzt Ihre normale Nummer an (z. B. mit einem zweiten Handy) und warten Sie, bis
          weitergeleitet wird.
        </p>
        <div>
          <Button type="button" onClick={testStarten} disabled={testetLaeuft}>
            {testetLaeuft ? "Wartet auf Anruf …" : "Jetzt testen"}
          </Button>
        </div>
        {testetLaeuft ? <p className="text-sm text-muted">{testanrufWarteText()}</p> : null}
        {testErgebnis?.gefunden ? (
          <p className="text-sm text-accent">{testanrufErfolgText(testErgebnis.anrufernummer ?? "unbekannt")}</p>
        ) : null}
      </Card>
    </div>
  );
}
