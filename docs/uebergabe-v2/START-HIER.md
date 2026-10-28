# Dispona – Übergabe an Claude Code

Stand 28.10.2026

## Was in diesem Paket ist

```
CLAUDE.md                      → Projektregeln, liest Claude Code automatisch
START-HIER.md                  → diese Datei
docs/
  DISPO-SPEZ.md                → Was gebaut wird: Pakete Lite/Pro, Oberfläche, Datenmodell, Einplan-Regeln, Abnahme
  BACKEND.md                   → Was im Hintergrund läuft: Telefonie, Sprach-Agent, Auto-Dispo, Fahrer-App,
                                 Echtzeit, Abrechnung, Jobs, Kunden-Login, Datenschutz, Reihenfolge
  DESIGN-GUIDE.md              → Wie alles aussieht, auch für alle weiteren Bereiche
design/
  dashboard-referenz.html      → Das Dashboard als klickbare Referenz (im Browser öffnen; oben Lite/Pro umschalten,
                                 auf Fahrten klicken, „Umplanen“/„Rückgängig“ testen)
brand/                         → Logo (SVG/PNG), App-Icons, Favicons, LOGO-ANLEITUNG.md
website/                       → Die fertige Verkaufs-Webseite (index.html + Symbole + LIESMICH.txt)
```

## So startest du

1. Neuen Projektordner anlegen und **den Inhalt dieses Pakets hineinkopieren** (CLAUDE.md ins Hauptverzeichnis).
2. Claude Code in diesem Ordner starten.
3. Diesen Prompt einfügen:

> Lies `CLAUDE.md`, `docs/DISPO-SPEZ.md`, `docs/BACKEND.md` und `docs/DESIGN-GUIDE.md` vollständig und öffne `design/dashboard-referenz.html` als visuelle Referenz.
>
> 1. Stell mir zuerst die Fragen aus BACKEND.md Abschnitt 14 und die offenen Punkte aus CLAUDE.md. Mach mir zu Telefonie, Sprach-Agent und Hosting je einen konkreten Vorschlag mit geschätzten **Kosten pro Anruf** (Annahme: 2 Min. Gesprächsdauer), damit ich die Marge bei 1,95 € und 2,49 € sehe.
> 2. Nach meinen Antworten: Erstelle einen Bauplan entlang der Meilensteine in BACKEND.md Abschnitt 15.
> 3. Beginne mit Meilenstein 1 (Login, Mandanten, Rollen, Stammdaten, Dashboard mit Seed-Daten und Simulator). Das Dashboard muss aussehen und sich verhalten wie die Referenz, nur mit echter Datenbank.
>
> Arbeite in kleinen Schritten, zeig mir nach jedem Meilenstein, was läuft, und prüfe die passenden Akzeptanzkriterien.

## Wenn Claude Code schon ein Dashboard gebaut hat

Gib diesen Prompt statt des obigen:

> Vergleiche das vorhandene Dashboard mit `design/dashboard-referenz.html` und `docs/DISPO-SPEZ.md` (Version 2). Liste alle Abweichungen auf, besonders bei: automatische Einplanung statt „Auto zuweisen“, Pakete Lite/Pro mit Sperren im Backend, „Braucht Sie“, Fahrtenbuch, Mandantentrennung. Schlag eine Reihenfolge zum Angleichen vor und warte auf mein OK.

## Wichtig vor dem Livegang (nicht Aufgabe von Claude Code)

- Impressum, Datenschutzerklärung, AGB, AV-Vertrag, Datenschutz-Folgenabschätzung: mit Anwalt bzw. Datenschutzberater
- Ansagetext am Telefon (KI-Offenlegung und Hinweis auf Verarbeitung) prüfen lassen
- Marke „Dispona“ beim DPMA prüfen bzw. anmelden, Domain sichern
- Echte Ergebnisse aus dem Pilot (Zitat, Zahl, Hörprobe) für die Webseite sammeln
