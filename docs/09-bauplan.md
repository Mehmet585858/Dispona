# 09 – Bauplan für Claude Code (Pilot mit eigener App)

Arbeite die Phasen der Reihe nach ab. Kopiere den Auftrag einer Phase (der Text im grauen Kasten) in Claude Code. Starte jede Phase mit einer neuen Sitzung (`/clear`).

Jede Phase endet erst, wenn **„So prüfst du“** klappt und `npm run lint`, `npm run typecheck`, `npm test` grün sind.

| Phase | Ergebnis | Externe Kosten |
| --- | --- | --- |
| 0 | Projekt angelegt, läuft lokal | keine |
| 1 | Datenbank, Anmeldung, Mandanten, Beispieldaten | keine |
| 2 | Stammdaten: Fahrzeuge, Fahrer, Schichten, Fahrgäste, Orte | keine |
| 3 | Fahrten erfassen und Disponenten-Startseite | Routing: kostenloser Plan reicht |
| 4 | Fahrzeugvorschlag (Disposition) | keine |
| 5 | Fahrer-App mit Push, Status und GPS | SMS-Dienst (Rückfall) |
| 6 | KI am Telefon | Voice-Anbieter + Telefonnummer |
| 7 | Automodus und Alarme | keine |
| 8 | Serienfahrten und Plan für morgen | keine |
| 9 | Einrichtungsassistent | keine |
| 10 | Abrechnungs-Export und Auswertung | keine |
| 11 | Datenschutz-Härtung | keine |
| 12 | Auf EU-Server veröffentlichen, Pilot starten | Server, Datenbank, Domain |

Nebenbei, ohne Claude Code: beim Pilot-Fahrdienst Fahrzeuge, Ausstattung, Fahrer, Schichtmuster und typische Ziele (Praxen, Kliniken, Dialyse) als Liste sammeln – das wird in Phase 2 der Import.

---

## Phase 0 – Projekt anlegen

```
Lies CLAUDE.md und alle Dateien in docs/ (docs/10-browser-erweiterung.md ist zurückgestellt, nur zur Info).
Fasse mir danach in 5 Sätzen zusammen, was wir bauen.
Lege dann das Projekt an: Next.js (App Router, TypeScript strict), Tailwind CSS, ESLint, Prettier,
Vitest, Playwright, Prisma. Lege die Ordnerstruktur aus CLAUDE.md an (leere Ordner mit kurzer README),
die npm-Befehle aus CLAUDE.md, eine .env.example mit Erklärung jeder Variable (docs/02-architektur.md)
und .gitignore (inkl. .env). Richte Git ein und mache den ersten Commit.
Erkläre mir, wie ich eine lokale PostgreSQL-Datenbank bekomme (einfachster Weg für einen Nicht-Entwickler)
und hilf mir Schritt für Schritt dabei.
```

**So prüfst du:** `npm run dev` starten, http://localhost:3000 zeigt eine Startseite „Fahrdienst-KI“.

---

## Phase 1 – Datenbank, Anmeldung, Mandanten

```
Setze das Datenmodell aus docs/03-datenmodell.md als prisma/schema.prisma um und erstelle die erste Migration.
Baue src/lib/db.ts mit withTenant() (Prisma Client Extension, filtert jede Abfrage nach tenantId)
und src/lib/crypto.ts (AES-256-GCM mit ENCRYPTION_KEY).
Baue die Anmeldung mit Auth.js: Büro (ADMIN, DISPONENT) per E-Mail-Einmal-Code; Fahrer (FAHRER) per
Einmal-Link, der später per SMS kommt. Im Entwicklungsmodus Codes und Links im Terminal ausgeben.
Schreibe npm run seed: Firma "Muster Krankenfahrten" (Baesweiler, mit Betriebshof), 1 Admin, 2 Disponenten,
5 Fahrzeuge (sitzend, Rollstuhl, Tragestuhl, liegend), 4 Fahrer mit Schichten heute und morgen, 10 Fahrgäste,
10 bekannte Orte in der Region Aachen (Praxen, Kliniken, Dialyse), 10 Fahrten heute.
Schreibe Tests: withTenant zeigt Daten von Mandant A nie Mandant B; Verschlüsselung hin und zurück.
Nach der Anmeldung: ADMIN ohne fertige Einrichtung → /einrichtung, Büro sonst → /dispo, FAHRER → /fahrer.
```

**So prüfst du:** Als Admin und als Fahrer aus dem Seed anmelden – du landest jeweils auf der richtigen (noch leeren) Seite.

---

## Phase 2 – Stammdaten

```
Baue die Verwaltung der Stammdaten nach docs/06-oberflaeche.md (Gestaltung, Bedienregeln):
Lege zuerst die Design-Tokens in tailwind.config.ts an und baue wenige Grundbausteine (Button, Eingabefeld mit
Label, Zahlenfeld mit −/+, Auswahlkacheln, Chip, Karte, Tabelle).
Seiten: Fahrzeuge (Kennzeichen, Plätze, Ausstattung als Kacheln wie im Entwurf), Fahrer (Name, Handynummer,
Einladen), Fahrer & Schichten als Wochenplan (Schichtmuster anlegen, z. B. Mo–Fr 6–14 Uhr, Fahrer + Fahrzeug,
per Ziehen ändern), Fahrgäste (Suche, Bearbeiten, Genehmigungen), Orte (Praxen, Kliniken, Dialyse).
Import aus CSV/Excel für Fahrzeuge, Fahrer, Fahrgäste und Orte mit Spaltenzuordnung und Vorschau.
```

**So prüfst du:** Die echten Fahrzeuge und Fahrer des Pilot-Fahrdienstes per Excel-Liste importieren, eine Woche Schichten anlegen.

---

## Phase 3 – Fahrten erfassen und Disponenten-Startseite

```
Baue src/core/rides/: Fahrt anlegen mit Prüfungen (Pflichtdaten aus docs/01-produkt.md, Doppelbuchung gleicher
Fahrgast ±60 Min, Genehmigung bei Serien, Adresse im Einsatzgebiet) und status.ts mit den erlaubten
Statusübergängen aus docs/03-datenmodell.md (jede Änderung erzeugt RideStatusEvent und AuditLog). Tests dazu.
Baue src/core/passengers/: Suche nach Telefonnummer und nach Name + Geburtsdatum, unscharfe Namenssuche
("Schmidt" findet "Schmitt"). Tests dazu.
Baue den RoutingProvider (docs/02-architektur.md) mit OpenRouteService (aktuelle Doku lesen): Geocoding mit
"sicher/unsicher", Fahrzeit-Matrix, Zwischenspeicher, Notlösung Luftlinie.
Baue die Disponenten-Startseite /dispo nach docs/06-oberflaeche.md und Entwurf 2: Kopf, Kennzahlen,
"Bitte bestätigen", Karte (Leaflet + OpenStreetMap), Tagesplan, Formular "Fahrt manuell anlegen",
Seite "Fahrten" mit Liste, Filter und Bearbeiten. Vorschläge gibt es noch nicht – zeige "Fahrzeug wählen".
Aktualisierung alle 5 Sekunden, Tablet-tauglich.
```

**So prüfst du:** Eine Fahrt manuell anlegen, Fahrzeug wählen, sie erscheint im Tagesplan beim richtigen Fahrzeug.

---

## Phase 4 – Fahrzeugvorschlag

```
Baue src/core/disposition/ genau nach docs/05-disposition.md (harte Regeln, Einfügen in den Plan,
Bewertung, Begründungstext, max. 3 Vorschläge, Bestätigen) als reine Funktionen und schreibe alle dort
genannten Tests (außer Automodus, der kommt in Phase 7) mit einem Fake-RoutingProvider.
Sobald eine Fahrt ERFASST ist, wird ein Vorschlag berechnet (VORGESCHLAGEN). Auf /dispo zeigen die Karten
den Vorschlag ("Vorschlag: AC-MK 204 · Anfahrt 9 Min · pünktlich am Ziel") mit "Bestätigen"
(1 Klick, 10 Sekunden Rückgängig) und "Anderes Fahrzeug". Bestätigen setzt Fahrzeug und Fahrer aus der Schicht,
Status DISPONIERT. Entscheidung in Suggestion speichern.
```

**So prüfst du:** Neue Rollstuhlfahrt anlegen → nur Fahrzeuge mit Rollstuhlplatz und laufender Schicht werden vorgeschlagen, mit plausibler Anfahrt.

---

## Phase 5 – Fahrer-App

```
Baue die Fahrer-App /fahrer nach docs/06-oberflaeche.md und Entwurf 3 als PWA (Manifest, App-Symbol,
installierbar auf Android und iPhone, offline-fähig für die Fahrten des Tages, Statusmeldungen werden bei
Funkloch nachgesendet).
Einladung: Fahrer bekommt einen Link (Entwicklung: Terminal; danach per SmsProvider – frag mich vor der Wahl
des SMS-Dienstes, EU-Anbieter, Kosten). Der Link führt Schritt für Schritt durch "Zum Home-Bildschirm" und
Push erlauben (iPhone: Push nur nach Hinzufügen zum Home-Bildschirm – erkläre das im Ablauf).
Web-Push (Service Worker, VAPID) bei neuer, geänderter und stornierter Fahrt, mit Ton und Vollbild-Hinweis
"Gesehen". Ohne "Gesehen" nach driverAckMinutes: SMS an den Fahrer, danach Hinweis beim Disponenten
(core/notify, Notification-Tabelle). Push/SMS-Texte ohne Namen.
App: Schicht starten/beenden, Pause, nächste Fahrt groß, Liste "Danach", Statusknopf
Losgefahren → Fahrgast an Bord → Erledigt (RideStatusEvent mit Position), "Navigation starten",
Fahrgast anrufen, "Problem melden" (Verspätung, nicht angetroffen, Fahrzeug defekt, Ich falle aus).
GPS alle 30 Sekunden nur während der Schicht und nach Einwilligung. Gefahrene km zwischen "an Bord" und
"Erledigt" berechnen und an der Fahrt speichern. Positionen und Status erscheinen live auf /dispo.
Fahrer sehen nur eigene Fahrten von heute und morgen.
```

**So prüfst du:** Als Fahrer auf dem eigenen Handy (Android und iPhone) einladen lassen, App installieren, im Büro eine Fahrt bestätigen → Handy klingelt; Status durchklicken, im Büro ändert sich alles live.

---

## Phase 6 – KI am Telefon

```
Lies docs/04-voice-agent.md. Lies die aktuelle Vapi-Doku und schreibe deine Erkenntnisse in
docs/04a-vapi-notizen.md (Webhooks, Tools, Transfer, End-of-Call-Bericht, Signatur, EU-Datenverarbeitung,
Rufumleitung von bestehenden Nummern, Übermittlung der Anrufernummer).
Zeig mir die Notizen und sag mir, welches Konto und welche Kosten ich brauche, bevor du weitermachst.
Baue dann den VoiceProvider für Vapi und die Endpunkte /api/voice/assistant-request, /api/voice/tools,
/api/voice/events mit Signaturprüfung. Setze alle Werkzeuge aus der Tabelle um (nutzen core/rides,
core/passengers, core/disposition). Werkzeuge antworten in unter 1,5 Sekunden.
Baue zuerst npm run voice:sim (Text-Chat im Terminal mit denselben Anweisungen und Werkzeugen) und die
20 Testgespräche in tests/voice/. Erst wenn diese laufen, verbinde eine echte Testnummer.
Nach jedem Gespräch: Call speichern (Transkript verschlüsselt), 3-Zeilen-Zusammenfassung, Verknüpfung zur Fahrt,
"Anruf anhören" auf /dispo.
```

**So prüfst du:** Von der eigenen Nummer des Fahrdienstes per Rufumleitung auf die Testnummer anrufen, Probefahrt bestellen → Fahrt mit Vorschlag auf /dispo → bestätigen → Fahrer-Handy klingelt. Dann „Ich möchte einen Menschen sprechen“ und einen Notfall-Satz testen.

---

## Phase 7 – Automodus und Alarme

```
Setze den Automodus nach docs/05-disposition.md um (Einstellungen AUS / NACHTS_WOCHENENDE / IMMER,
Zeitfenster, Mindestabstand, maximale Tage, requireDocsForAuto; nur ADMIN, Änderungen ins AuditLog).
Prüfe vor jeder automatischen Disposition alle Sicherheitsbedingungen; sonst bleibt die Fahrt beim Disponenten
mit autoSkipReason. Automatisch disponiert → Push an den Fahrer, Bestätigungs-Überwachung.
Alarme per SMS/E-Mail an alertPhone/alertEmail: Fahrer bestätigt eine bald beginnende Fahrt nicht,
Fahrer meldet Ausfall, keine passende Fahrt möglich (KEIN_FAHRZEUG) in den nächsten 2 Stunden.
Neuplanung bei Ausfall oder Verspätung eines Fahrers.
Morgen-Übersicht "Heute Nacht" auf /dispo. Kopf zeigt "Automodus: aktiv bis 7:00".
Tests: je verletzter Sicherheitsbedingung ein Test, Erfolgsfall, Ausfall eines Fahrers, Alarm-Auslösung.
```

**So prüfst du:** Automodus auf „immer“ stellen, 10 Testfahrten per Testanruf anlegen: eindeutige werden sofort disponiert, die anderen landen mit Grund beim Disponenten. Einen Testfahrer nicht bestätigen lassen → Alarm kommt.

---

## Phase 8 – Serienfahrten und Plan für morgen

```
Setze Serienfahrten um (RideSeries mit RFC-5545-Regel, z. B. Mo/Mi/Fr 07:15 bis Datum, mit Rückfahrt):
anlegen am Telefon und im Formular, Fahrten 14 Tage im Voraus erzeugen, Warnung, wenn die Genehmigung vor
Serienende abläuft, einzelne Termine ändern oder absagen (Feiertage NRW als Hinweis).
Baue "Plan für morgen" nach docs/05-disposition.md (Standard 18:00): Sammel-Vorschlag auf /dispo, mit einem Klick
übernehmen oder einzeln ändern; im Automodus werden eindeutige Fahrten direkt disponiert. Fahrer sehen ihre
Fahrten für morgen am Abend in der App. Tests für Serienregeln und den Tagesplan.
```

**So prüfst du:** Dialyse-Serie Mo/Mi/Fr anlegen, „Plan für morgen“ verteilt alle Fahrten ohne Überschneidungen; die Fahrer sehen sie abends in der App.

---

## Phase 9 – Einrichtungsassistent

```
Baue den Einrichtungsassistenten /einrichtung/[schritt] nach docs/06-oberflaeche.md (8 Schritte) und Entwurf 1.
Nutze die Seiten und Importe aus Phase 2 wieder. Schritt 2: Anleitungen zur Rufumleitung (Telekom, Vodafone, 1&1,
Fritzbox; bei Nichtmelden, bei Besetzt, zeitgesteuert) und ein automatischer Test, ob die Anrufernummer ankommt
und die Weiterleitungsnummer keine Schleife bildet. Schritt 7: Testanruf mit Live-Anzeige und Push an einen
Testfahrer. Jeder Schritt speichert sofort, "Später erledigen" springt weiter, setupStep merkt den Stand.
Alle Texte in texte.ts. Playwright-Test für den kompletten Durchlauf.
```

**So prüfst du:** Neue Testfirma anlegen und den Assistenten ohne Hilfe durchklicken. Ziel: unter 30 Minuten bis zum Testanruf.

---

## Phase 10 – Abrechnungs-Export und Auswertung

```
Baue den Export für die Abrechnung nach docs/07-adapter.md (CSV und Excel, Zeitraum, Spaltenvorlage speichern,
gefahrene km, exportedAt setzen, bereits exportierte markieren).
Baue /dispo/auswertung mit den Pilot-Kennzahlen aus docs/01-produkt.md (pro Woche): Anrufe, vollständig erfasst,
Vorschläge unverändert übernommen, automatisch disponiert, Pünktlichkeit, Weiterleitungen an Menschen.
```

**So prüfst du:** Export einer Woche an den Pilot-Fahrdienst geben: Kann er die Datei in seine Abrechnung übernehmen?

---

## Phase 11 – Datenschutz-Härtung

```
Prüfe das ganze Projekt gegen docs/08-datenschutz-sicherheit.md und behebe Lücken:
Mandantentrennung (Test über alle Tabellen), AuditLog vollständig, keine personenbezogenen Daten in Logs,
Push- und SMS-Texte ohne Namen, Fahrer sehen nur Eigenes, GPS nur in der Schicht, Löschfristen-Job
(Audio, GPS, Fahrten), Datenexport und Löschung eines Fahrgastes, Webhook-Signaturen, Geräte abmelden, npm audit.
Schreibe docs/11-sicherheitsbericht.md: was geprüft wurde, was geändert wurde, was offen ist
(Punkte für den Anwalt, AV-Verträge, Information der Fahrer über GPS).
```

**So prüfst du:** Den Bericht lesen; offene Punkte mit dem Anwalt klären.

---

## Phase 12 – Veröffentlichen und Pilot starten

```
Schlage mir 2 Wege vor, die App auf Servern in der EU zu betreiben (einer möglichst einfach,
einer möglichst günstig), mit monatlichen Kosten für den Pilot und was ich anlegen muss.
Warte auf meine Entscheidung. Richte dann ein: Datenbank in der EU, tägliche verschlüsselte Backups,
Umgebungsvariablen, HTTPS mit eigener Domain, Cron-Endpunkte, Fehlerüberwachung ohne personenbezogene Daten.
Schreibe docs/12-betrieb.md: Update einspielen, Backup zurückholen, neuen Kunden anlegen, was tun bei Alarm –
in einfachen Schritten.
```

**So prüfst du:** Die App ist unter deiner Domain erreichbar, Testanruf funktioniert, Fahrer bekommen Push, eine Nacht im Automodus ist sauber gelaufen.

---

## Danach

- Anbindung an Abrechnungssoftware (zuerst DMRZ nach deren Spezifikation, `docs/07-adapter.md`).
- Erinnerungsanruf/SMS am Vortag an Fahrgäste.
- Foto vom Transportschein und Unterschrift in der Fahrer-App.
- Sammelfahrten und Tourenoptimierung (OR-Tools).
- Weitere Sprachen am Telefon.
