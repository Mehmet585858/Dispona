# 06 – Oberfläche

Vorlage für das Aussehen sind die drei Bildschirm-Entwürfe (Einrichtungsassistent, Disponenten-Startseite, Fahrer-App). Screenshots in `docs/entwuerfe/`, falls abgelegt. Sie passen genau zum Pilot.

## Bedienregeln (gelten überall)

1. **Nichts installieren:** alles im Browser; Fahrer-App als PWA („Zum Home-Bildschirm“).
2. **Eine Sache pro Bildschirm.** Überschrift als Frage oder klare Aufgabe („Welche Fahrzeuge haben Sie?“).
3. **Vorausgefüllt statt leer:** sinnvolle Standardwerte, der Kunde ändert nur Abweichungen.
4. **Große Ziele:** Schaltflächen und Eingabefelder mindestens 44 px hoch, in der Fahrer-App 52–64 px.
5. **Klare Sprache:** Sie-Form (Fahrer-App: Du-Form nach Wahl des Fahrdienstes), kurze Sätze, keine IT-Begriffe.
6. **Ampel mit Text:** Farbe nie allein – immer mit Wort oder Symbol (grün „bestätigt“, gelb „wartet“, rot „Problem“).
7. **Rückgängig statt Warnfenster:** Aktionen sofort ausführen, 10 Sekunden „Rückgängig“. Nur bei Löschen nachfragen.
8. **Hilfe überall:** Hilfe-Knopf oben rechts („Hilfe – wir rufen zurück“), 1-Minuten-Video im jeweiligen Schritt.
9. **Barrierearm:** echte `<button>`, `<label>` an jedem Feld, Kontrast mindestens 4,5:1, Bedienung per Tastatur.
10. **Handy zuerst** für Fahrer-App und Bestätigen unterwegs; Disponenten-Ansicht auch auf dem Tablet.

## Gestaltung (Design-Tokens)

In `tailwind.config.ts` als Farben hinterlegen:

| Name | Wert | Verwendung |
| --- | --- | --- |
| `ground` | `#F6F7F5` | Seitenhintergrund |
| `surface` | `#FFFFFF` | Karten |
| `ink` | `#15201E` | Text |
| `ink-soft` | `#3F4B47` | Fließtext zweitrangig |
| `muted` | `#5B6763` | Hinweise, Beschriftungen |
| `line` | `#DCE1DE` | Rahmen |
| `line-strong` | `#B9C2BE` | Rahmen von Eingabefeldern |
| `accent` | `#0E6E62` | Hauptaktion, aktiver Zustand (Petrol) |
| `accent-soft` | `#E3F1EE` | Hinterlegung von Vorschlägen, aktiver Schritt |
| `warn-bg` / `warn-ink` | `#FFF4D6` / `#4A3000` | „wartet“, fehlende Unterlagen |
| `info-bg` / `info-ink` | `#E8EEF8` / `#1F4E8C` | „unterwegs“ |
| `danger-bg` / `danger-ink` | `#FDECEA` / `#A3271D` | Problem |

- Schrift: **Figtree** (Google Fonts), 400/500/600/700. Grundgröße 16 px (Fahrer-App 16–20 px).
- Ecken: Karten 16 px, Schaltflächen 10–14 px, Chips rund. Keine Verläufe.
- Zahlen in Tabellen und Uhrzeiten mit `tabular-nums`.

## Bildschirme

### Einrichtungsassistent `/einrichtung/[schritt]`

Links Fortschritt („Schritt 3 von 8“, Balken, restliche Zeit, Liste der Schritte), rechts der Schritt. Unten: „Zurück“, „Später erledigen“, „Weiter: <nächster Schritt>“. Jeder Schritt speichert sofort; `Tenant.setupStep` merkt sich den Stand.

| Schritt | Inhalt |
| --- | --- |
| 1 Firma anlegen | Name, Adresse, Betriebshof, Einsatzgebiet (Mittelpunkt + Radius auf Karte), Öffnungszeiten (Voreinstellung Mo–Fr 7–18) |
| 2 Telefon verbinden | Bestehende Nummer behalten: Rufumleitung zur KI-Nummer (bei Nichtmelden, bei Besetzt, zeitgesteuert) mit Anleitungen für Telekom, Vodafone, 1&1, Fritzbox; Prüfung „Kommt die Anrufernummer an?“ und „Keine Schleife“ |
| 3 Fahrzeuge eintragen | Liste + „Weiteres Fahrzeug“: Kennzeichen, Sitzplätze (−/+), Kacheln Sitzend/Rollstuhl/Tragestuhl/Liegend; CSV-Import als Alternative |
| 4 Fahrer einladen | Name + Handynummer → SMS mit Link; Fahrer installiert die App in 3 Schritten; Schichtplan-Vorlage (z. B. Mo–Fr 6–14 / 14–22) |
| 5 Disposition einstellen | Automodus aus / nur nachts + Wochenende / immer; „nur eindeutige Fälle“; Alarm-Handynummer des Inhabers bzw. Bereitschaft |
| 6 KI anpassen | Stimme wählen (3 Stimmen mit „Anhören“), Begrüßung (vorausgefüllt), Weiterleitungsnummer (Handy/Durchwahl, nicht die Hauptnummer) |
| 7 Testanruf | Nummer groß angezeigt, Probefahrt bestellen; die Fahrt erscheint live mit Vorschlag, Testfahrer bekommt Push |
| 8 Live schalten | Schalter „KI nimmt Anrufe an“ + Zeitplan (Empfehlung zum Start: nur nachts und am Wochenende bzw. bei Nichtmelden) |

### Disponenten-Startseite `/dispo` (Entwurf 2)

- Kopf: Logo, Menü (Heute, Fahrten, Fahrzeuge, Fahrer & Schichten, Anrufe, Einstellungen), Schalter „KI nimmt Anrufe an“, Anzeige „Automodus: aktiv bis 7:00“.
- Kennzahlen: Fahrten heute · Warten auf Sie (gelb) · Fahrzeuge unterwegs · Anrufe von der KI angenommen.
- Links „Bitte bestätigen (n)“: Karten mit Zeit, Fahrgast, Von → Nach, Beförderungsart, Hinweis bei Problem, Vorschlag (Fahrzeug, Anfahrt, Pünktlichkeit), Aktionen „Bestätigen“, „Anderes Fahrzeug“, „Anruf anhören“.
- Rechts: Karte „Fahrzeuge jetzt“ (Leaflet + OpenStreetMap, Live-GPS), darunter Tagesplan (Fahrzeug, Fahrer, Status, nächste Fahrt).
- Morgens oben: „Heute Nacht“ – automatisch disponiert, liegen geblieben mit Grund, Alarme.
- Rot oben: Fahrer hat neue Fahrt nicht bestätigt, Fahrer meldet Ausfall/Verspätung, Fahrt ohne Fahrzeug.
- Aktualisierung alle 5 Sekunden (später Server-Sent Events).
- Weitere Seiten: Fahrten (Liste, Filter, Bearbeiten, Serien), Fahrzeuge, Fahrer & Schichten (Wochenplan), Anrufe (Transkript, Zusammenfassung), Export für die Abrechnung.

### Fahrer-App `/fahrer` (Entwurf 3)

- Kopf: Begrüßung, „Heute n Fahrten“, Kennzeichen; Schicht starten/beenden, Pause.
- Große Karte „Nächste Fahrt“: Uhrzeit groß, Fahrgast, Abholen → Ziel mit Termin, Chips (Beförderungsart, Hilfe), Telefon des Fahrgastes (Anruf-Knopf), „Navigation starten“ (Google Maps / Apple Karten).
- Neue oder geänderte Fahrt: Ton + Vollbild-Hinweis mit Knopf „Gesehen“.
- Liste „Danach“.
- Unten fest ein großer Statusknopf (64 px): „Losgefahren“ → „Fahrgast an Bord“ → „Erledigt“.
- Knopf „Problem melden“: Verspätung (+10/+20/+30 Min), Fahrgast nicht da, Fahrzeug defekt, „Ich falle aus“.
- GPS alle 30 Sekunden während der Schicht (mit Einwilligung, sichtbarer Hinweis).
