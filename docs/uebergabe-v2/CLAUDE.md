# Dispona – Projektregeln für Claude Code

Dispona ist eine Software für **Krankenfahrdienste**: Eine Sprach-KI („Dispona“) nimmt Anrufe an, erfasst Fahrten und plant sie im Paket Pro automatisch beim nächstbesten Fahrzeug ein. Dazu gibt es ein Dashboard mit Kunden-Login, eine Fahrer-App und eine Abrechnung pro Anruf.
Ansprechpartner und Entscheider: **Mehmet**.

## Immer zuerst lesen
1. `docs/DISPO-SPEZ.md`: was gebaut wird (Pakete, Oberfläche, Datenmodell, Regeln, Akzeptanzkriterien)
2. `docs/BACKEND.md`: was im Hintergrund läuft (Telefonie, Sprach-Agent, Auto-Dispo, Fahrer-App, Abrechnung, Jobs, Datenschutz, Reihenfolge)
3. `docs/DESIGN-GUIDE.md`: wie es aussieht (vor jeder Oberflächen-Arbeit)
4. `design/dashboard-referenz.html`: klickbare Referenz im Browser öffnen (oben Lite/Pro umschalten)

## Regeln
- Oberfläche auf **Deutsch**, Begriffe exakt wie in DESIGN-GUIDE Abschnitt 8. Die Assistentin heißt in Texten „Dispona“, nicht „KI“.
- Farben nur aus den Tokens. **Farbe = Transportart, Füllung = Zustand, Orange = braucht Aufmerksamkeit.**
- **Mandantentrennung** ist Pflicht: Jede Tabelle hat `mandant_id`, Row-Level-Security in der Datenbank, Tests dafür.
- **Paket-Sperren im Backend** (Lite/Pro), nicht nur in der Oberfläche.
- **Gesundheitsdaten:** keine Patientendaten in Logs, Fehlerberichten oder Analyse-Tools. Nur EU-Dienste. KI-Anbieter ohne Training auf unseren Daten.
- **Kein Anruf darf verloren gehen:** Bei jedem Ausfall greift die Weiterleitung an einen Menschen.
- Doppelbuchungen verhindern: Einplanung nur in einer Transaktion mit Sperre (mehrere Anrufe gleichzeitig!).
- Neue Seiten nur aus den Komponenten in DESIGN-GUIDE Abschnitt 10. Fehlt eine, zuerst die Komponente bauen und im Guide ergänzen.
- **Vor Technik-Entscheidungen** aus BACKEND.md Abschnitt 14 (Telefonie, Sprach-Agent, Hosting, Routen, App-Art) Mehmet fragen und die Kosten pro Anruf gegenrechnen.
- Immer mit Seed-Daten und **Simulator** entwickeln (Testanrufe, Fahrer-Status), damit alles ohne echte Anrufe vorführbar ist.
- Am Ende jeder Aufgabe: die betroffenen Akzeptanzkriterien (DISPO-SPEZ Abschnitt 7) und die UI-Checkliste (DESIGN-GUIDE Abschnitt 11) durchgehen und das Ergebnis nennen.

## Offene Entscheidungen (nicht raten, nachfragen)
- Lite: nur „Übernommen“ markieren oder auch eigenes Fahrzeug zuordnen?
- Welche Anrufe sind abrechenbar (Mindestdauer, Spam, Verwählte)? Kosten Webformular-Buchungen etwas?
- Fahrtenbuch: Format und Spalten für die Abrechnungsstelle.
- Löschfristen für Aufnahmen und Transkripte.
