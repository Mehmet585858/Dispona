# 07 – Abrechnung und Anbindung anderer Software

## Im Pilot: Export als Datei

DMRZ und andere Software sind **nicht angebunden** (Entscheidung 26.10.2026). Die Abrechnung macht der Fahrdienst weiter in seiner Software; wir liefern die Daten:

- Einstellungen → „Export für die Abrechnung“: erledigte Fahrten eines Zeitraums als CSV und Excel.
- Spalten: Fahrgast (Name, Geburtsdatum, Krankenkasse), Datum, Abholzeit, Ankunft, Abhol- und Zieladresse, Beförderungsart, gefahrene km mit Fahrgast, Fahrzeug, Fahrer, Transportschein/Genehmigung, Serie, Hinweise.
- Gefahrene km aus den GPS-Punkten zwischen „Fahrgast an Bord“ und „Erledigt“ (Fallback: Routing-Distanz).
- Ziel: so, dass der Fahrdienst die Datei leicht in seine Abrechnungssoftware übernehmen kann. Die Spaltenreihenfolge ist einstellbar (Vorlage speichern).

## Später: Adapter

Gemeinsame Schnittstelle in `src/adapters/types.ts`:

```ts
export interface FahrdienstAdapter {
  key: 'DMRZ' | 'NONE' | 'OPTADATA' | string;
  testConnection(cfg: AdapterConfig): Promise<{ ok: boolean; message: string }>;
  exportBilling?(rides: RideExport[]): Promise<{ filename: string; content: Buffer }>;
  pushRide?(ride: RideExport): Promise<{ externalId?: string }>;
  importPassengers?(cfg: AdapterConfig): Promise<PassengerImport[]>;
}
```

### DMRZ (Stand Recherche 25./26.10.2026)

- Dokumentiert: DTA-Schnittstelle für Branchensoftware (Abrechnungsdaten § 301a/§ 302 SGB V, dateibasiert/CSV); Spezifikation gibt DMRZ Softwareherstellern auf Anfrage. Import nach DMRZ-Schnittstellenbeschreibung.
- Nicht dokumentiert: API für Fahrtenplanung oder DMRZ-App.
- Naheliegender erster Adapter: **Abrechnungsdaten nach DMRZ-Spezifikation** – erst bauen, wenn die Spezifikation vorliegt. Keine geratene API, keine Automatisierung im DMRZ-Konto.
- Die Idee einer Browser-Erweiterung für DMRZ ist in `docs/10-browser-erweiterung.md` festgehalten (zurückgestellt).

### Weitere

opta data (TRARET/CareMan), TAXI-Experte, Lavid-F.I.S. – nach Bedarf der Kunden.
