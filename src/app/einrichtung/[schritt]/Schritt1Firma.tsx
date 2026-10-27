"use client";

import { useState } from "react";
import { AdresseSuche, type AdressTreffer } from "@/components/AdresseSuche";
import { EinsatzgebietKarte } from "@/components/EinsatzgebietKarte";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { NumberField } from "@/components/ui/NumberField";
import { TextField } from "@/components/ui/TextField";
import { adresseSuchen, firmaSpeichern, type FirmaEingabe } from "./actions";

export function Schritt1Firma({ initial }: { initial: FirmaEingabe }) {
  const [werte, setWerte] = useState<FirmaEingabe>(initial);
  const [speichert, setSpeichert] = useState(false);
  const [erfolg, setErfolg] = useState<string | null>(null);

  function betriebshofUebernehmen(t: AdressTreffer) {
    setWerte({ ...werte, depotAddress: { street: t.street, zip: t.zip, city: t.city, lat: t.lat, lng: t.lng } });
  }

  function einsatzgebietUebernehmen(t: AdressTreffer) {
    setWerte({ ...werte, serviceAreaCenter: { lat: t.lat, lng: t.lng } });
  }

  async function speichern() {
    setSpeichert(true);
    setErfolg(null);
    try {
      await firmaSpeichern(werte);
      setErfolg("Gespeichert.");
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Wie heißt Ihr Fahrdienst?</h1>
        <p className="text-sm text-muted">Diese Angaben sehen nur Sie und Ihr Team.</p>
      </div>

      <Card className="flex flex-col gap-4">
        <TextField label="Name des Fahrdienstes" value={werte.name} onChange={(e) => setWerte({ ...werte, name: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Straße, Hausnummer" value={werte.street ?? ""} onChange={(e) => setWerte({ ...werte, street: e.target.value })} />
          <TextField label="PLZ" value={werte.zip ?? ""} onChange={(e) => setWerte({ ...werte, zip: e.target.value })} />
          <TextField label="Ort" value={werte.city ?? ""} onChange={(e) => setWerte({ ...werte, city: e.target.value })} />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Betriebshof</h2>
          <p className="text-sm text-muted">Von hier starten Fahrzeuge ohne vorherige Fahrt.</p>
        </div>
        <AdresseSuche label="Adresse suchen" suchen={adresseSuchen} onAuswahl={betriebshofUebernehmen} />
        {werte.depotAddress ? (
          <p className="text-sm text-accent">
            Gewählt: {werte.depotAddress.street}, {werte.depotAddress.zip} {werte.depotAddress.city}
          </p>
        ) : null}
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Einsatzgebiet</h2>
          <p className="text-sm text-muted">Mittelpunkt auf der Karte ziehen, Radius daneben eintragen.</p>
        </div>
        <EinsatzgebietKarte
          zentrum={werte.serviceAreaCenter}
          radiusKm={werte.serviceAreaKm}
          onZentrumVerschieben={(z) => setWerte({ ...werte, serviceAreaCenter: z })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <AdresseSuche label="Mittelpunkt suchen (Stadt oder Adresse)" suchen={adresseSuchen} onAuswahl={einsatzgebietUebernehmen} />
          <NumberField label="Radius (km)" value={werte.serviceAreaKm} onChange={(wert) => setWerte({ ...werte, serviceAreaKm: wert })} />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">Öffnungszeiten</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Von"
            type="time"
            value={werte.oeffnungszeitVon}
            onChange={(e) => setWerte({ ...werte, oeffnungszeitVon: e.target.value })}
          />
          <TextField
            label="Bis"
            type="time"
            value={werte.oeffnungszeitBis}
            onChange={(e) => setWerte({ ...werte, oeffnungszeitBis: e.target.value })}
          />
        </div>
        <p className="text-xs text-muted">Gilt Montag bis Freitag, Voreinstellung 07:00–18:00.</p>
      </Card>

      {erfolg ? <p className="text-sm text-accent">{erfolg}</p> : null}
      <div>
        <Button type="button" onClick={speichern} disabled={speichert || !werte.name.trim()}>
          {speichert ? "Speichert …" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}
