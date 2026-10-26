# 08 – Datenschutz und Sicherheit

Das System verarbeitet Gesundheitsdaten (Art. 9 DSGVO). Diese Punkte sind Pflicht; vor dem Pilotbetrieb prüft ein Fachanwalt für IT- und Datenschutzrecht.

## Rollen und Verträge (organisatorisch, nicht Code)

- Fahrdienst = Verantwortlicher, Betreiber der Plattform = Auftragsverarbeiter → AV-Vertrag mit jedem Kunden.
- AV-Verträge mit jedem Unterauftragnehmer: Hosting, Datenbank, Voice-Anbieter, Telefonie, Routing, E-Mail/SMS.
- Datenschutz-Folgenabschätzung (DSFA) und Verzeichnis der Verarbeitungstätigkeiten.
- EU AI Act: Transparenzhinweis am Anrufbeginn (ist im System-Prompt); Einstufung rechtlich prüfen lassen.
- Fahrer: Information über GPS-Ortung während der Schicht (Beschäftigtendatenschutz); ggf. Betriebsvereinbarung, falls es einen Betriebsrat gibt. Vorlage für den Fahrdienst bereitstellen.

## Hosting

- Server, Datenbank, Backups und Datei-Speicher in der EU (z. B. Hetzner, IONOS oder ein großer Cloud-Anbieter mit Region Frankfurt).
- Beim Voice-Anbieter prüfen und dokumentieren, wo Audio und Transkripte verarbeitet werden und ob Daten zum Training genutzt werden (muss ausgeschlossen sein).

## Technische Pflichten im Code

| Thema | Umsetzung |
| --- | --- |
| Mandantentrennung | `withTenant()`, Test „A sieht nie B“ |
| Verschlüsselung | HTTPS überall; Transkripte und Adapter-Zugangsdaten mit AES-256-GCM (`src/lib/crypto.ts`) |
| Zugriff | Rollen ADMIN/DISPONENT/FAHRER; Fahrer sehen nur eigene Fahrten (heute und morgen) |
| Protokoll | `AuditLog` für Ansehen von Fahrgastdaten, Bestätigen, Ändern, Export, Einstellungen |
| Logs | keine Namen, Adressen, Transkripte – nur IDs |
| Löschfristen | Job nachts: Audio nach `audioRetentionDays`, Fahrten/Transkripte nach `dataRetentionDays` |
| Auskunft/Löschung | Admin kann alle Daten eines Fahrgastes exportieren (JSON/PDF) und löschen |
| Webhooks | Signatur prüfen, Anfragen ohne gültige Signatur ablehnen |
| Anmeldung | Büro: Einmal-Code per E-Mail, Sitzung 12 h. Fahrer: SMS-Link, Gerät bleibt 30 Tage angemeldet, Admin kann Geräte abmelden |
| Fahrer-App | Fahrer sehen nur eigene Fahrten von heute und morgen; Fahrgastdaten nach Erledigung nicht mehr in der App; Zwischenspeicher auf dem Handy nur für den Tag |
| Push und SMS | nur Uhrzeit und Ort, nie Namen oder Hinweise; Details erst in der angemeldeten App |
| GPS | nur während der Schicht, nach Einwilligung (`gpsConsentAt`), Speicherdauer begrenzt (Standard 90 Tage, dann nur noch km je Fahrt) |
| Automodus | Einstellung nur durch Admin, jede Änderung im AuditLog; Sicherheitsbedingungen vor jeder automatischen Disposition |
| Abhängigkeiten | `npm audit` in jeder Phase; keine unnötigen Pakete |
| Backups | täglich, verschlüsselt, 30 Tage, Wiederherstellung einmal testen |

## Datensparsamkeit

- Nur Pflichtdaten aus `docs/01-produkt.md` erfragen. Keine Diagnosen, keine Versichertennummer im MVP (kommt nur, wenn der Adapter sie zwingend braucht).
- GPS der Fahrer nur während der Schicht.
