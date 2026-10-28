# Design-Guide „Gedämpft“ – für alle Bereiche der Fahrdienst-Software

Dieser Guide macht aus dem Dispo-Dashboard (Farbe 1 · Gedämpft) ein System, das für **jeden** Bereich gilt: Disposition, Patienten, Fahrzeuge und Fahrer, Dienstplan, Serienfahrten, Abrechnung, Einstellungen, Fahrer-App.
Claude Code soll ihn bei **jeder** neuen Seite zuerst lesen. Am besten wird er in `CLAUDE.md` verlinkt (siehe Abschnitt 12).

---

## 0. Marke

- **Name:** Dispona (immer mit großem D im Text; das Logo selbst ist klein geschrieben: „dispona“).
- **Logo:** Wortmarke in **Comfortaa Bold**, in Pfade umgewandelt. Das „o“ trägt einen **grünen Live-Punkt `#5E8C6A`**, das Erkennungszeichen der Marke. Dateien in `public/brand/`, Regeln in `docs/uebergabe-v2/brand/LOGO-ANLEITUNG.md`. React-Komponenten: `src/components/ui/Logo.tsx` (`Logo`, `LogoZeichen`).
- Comfortaa **nur im Logo**. Die Oberfläche bleibt in IBM Plex Sans.
- App-Icon: das „o“ mit Punkt, weiß auf Schiefergrau `#334155`.
- Tonalität: ruhig, klar, freundlich-sachlich. Dispona spricht wie eine erfahrene Kollegin in der Zentrale.

---

## 1. Grundsätze

1. **Ruhe zuerst.** Die Oberfläche ist grau und weiß. Farbe trägt immer eine Bedeutung, nie Dekoration.
2. **Eine Farbe = eine Bedeutung, überall gleich.**
   - 4 gedämpfte Farben: **nur** für die Transportart.
   - Orange: **nur** für „braucht Aufmerksamkeit“ (verspätet, fehlt, offen, Konflikt).
   - Schiefergrau `#334155`: Aktionen (Primärknöpfe, Auswahl, Fortschritt).
   - Rot: **nur** für zerstörende Aktionen (Stornieren, Löschen).
3. **Der wichtigste nächste Schritt ist sofort klickbar.** Jede Seite hat höchstens **einen** Primärknopf pro Bereich.
4. **Die Software denkt mit.** Wo das System etwas vorschlagen kann (Fahrzeug, Zeit, Kostenträger), zeigt es den Vorschlag mit Begründung („frei ab 15:00 · 2 km entfernt“). Der Mensch bestätigt mit einem Klick.
5. **Nichts geht verloren.** Wichtige Aktionen lassen sich rückgängig machen. Zerstörende Aktionen fragen vorher nach.
6. **Klartext statt Abkürzungen** in Statustexten. Abkürzungen nur, wo die Branche sie selbst nutzt (KTW, BTW, LMW).

---

## 2. Farben (Design-Tokens)

Als CSS-Variablen anlegen und **nie** Hex-Werte direkt in Komponenten schreiben.

```css
:root {
  /* Flächen */
  --bg: #F5F6F8;   --surf: #FFFFFF;   --surf2: #FAFAFB;   --seg: #F1F3F5;
  /* Linien */
  --line: #E3E6EA; --line2: #EEF0F3; --grid: #F2F3F5;
  /* Text */
  --ink: #1F2933;  --ink2: #3E4A56;  --mute: #5F6B77;
  /* Etiketten */
  --chip-bg: #EEF1F4; --chip-fg: #3E4A56;
  /* Aktion */
  --acc: #334155;  --acc-fg: #FFFFFF;  --acc-hover: #1E293B;
  /* Aufmerksamkeit (orange) */
  --warn-bg: #FBF3EA; --warn-bd: #EED3B4; --warn-fg: #8A4B12;
  --late-ring: #D97706; --late-badge: #F3D9B8; --late-badge-fg: #5C2E05;
  --now: #C2410C;
  /* Erfolg (sparsam) */
  --ok-bg: #EEF3EF; --ok-fg: #2F4A36; --ok-dot: #5E8C6A;
  /* Gefahr */
  --danger: #B42318;
  /* Hervorhebung, Overlay */
  --hl: #F7F7FA; --overlay: rgba(31,41,51,.4);
}
```

### Transportart (fachliche Farbe – überall identisch)

| Art | `main` | `solid` | `tint` | `faint` | `ink` |
|---|---|---|---|---|---|
| Liegend | `#8B7FB8` | `#5B4F8F` | `#ECE9F5` | `#F7F6FB` | `#3D3466` |
| Tragestuhl | `#6D97A3` | `#3E6C78` | `#E4EEF1` | `#F4F8F9` | `#24434B` |
| Rollstuhl | `#7D96C2` | `#4A6597` | `#E7ECF5` | `#F5F7FB` | `#263C5E` |
| Sitzend | `#8CA894` | `#4E7559` | `#E8F0EA` | `#F5F9F6` | `#2F4A36` |

So kommt die Transportart in anderen Bereichen vor:
- **Listen und Tabellen:** Quadrat 10×10 in `solid` vor dem Namen (Tooltip mit der Art). Kein farbiger Zeilenhintergrund.
- **Detail-Seiten:** Etikett gefüllt in `solid`, weiße Schrift, mit ausgeschriebenem Text.
- **Kalender und Zeitstrahl:** ganzer Chip in der Farbe; der Zustand ergibt sich aus Füllung und Rahmen (siehe 5.4).
- **Fahrer-App:** großes Etikett in `solid` mit Text. Unterwegs gibt es keine Legende, deshalb steht dort immer der Text dabei.

### Live-Status (Fahrzeug und Fahrt)

| Status | Punkt | Text |
|---|---|---|
| Frei | `#B4BCC6` | Frei |
| Fährt zum Fahrgast | `#C8A15A` | Fährt zum Fahrgast |
| Fahrgast im Auto | `#5873A8` | Fahrgast im Auto |
| Fahrgast am Ziel | `#5E8C6A` | Fahrgast am Ziel |
| Verspätet | `#D97706` | Fährt zum Fahrgast + „+12 Min.“ in `--warn-fg` |
| Pause / außer Dienst | `#B4BCC6` | Pause / Außer Dienst |

Status = Punkt 8 px + Text. **Nie nur Farbe ohne Text.**

---

## 3. Schrift

- **IBM Plex Sans** 400/500/600/700 für alles, **IBM Plex Mono** 500 für Uhrzeiten, Kennzeichen in Tabellen und Beträge.
- Größen-Skala (px): 11 Etikett · 12 Beschriftung/Meta · **14 Grundtext** · 15–16 Kartentitel · 22 Seiten-/Modaltitel · 24 Kennzahl · 28 große Seitentitel (selten).
- Gewichte: 400 Text, 600 Namen und Werte, 700 Titel und Zahlen.
- Deutsche Formate: `27.10.2026`, `13:41`, `1.234,50 €`, `78 %`.

---

## 4. Abstände, Radien, Schatten

- Raster 4 px. Häufig genutzt: 4 · 6 · 8 · 10 · 12 · 16 · 24.
- Seitenränder 24 px (mobil 16 px). Abstand zwischen Karten 12–16 px.
- Radien: Pillen 999 · Karten 12–16 · Knöpfe und Eingaben 10 · Chips 8 · kleine Etiketten 4–6.
- Schatten nur für Ebenen, die schweben (Modal, Dropdown, Anruf-Karte). Karten haben stattdessen einen 1-px-Rahmen in `--line`.

---

## 5. Bausteine

### 5.1 Knöpfe
| Art | Aussehen | Wann |
|---|---|---|
| Primär | `--acc` gefüllt, weiße Schrift, Höhe 44, Radius 10, 600 | eine Hauptaktion je Bereich („+ Neue Fahrt“, „Auto zuweisen“, „Speichern“) |
| Sekundär | weiß, Rahmen `--line`, Schrift `--ink` | Nebenaktionen („Bearbeiten“, „Selbst übernehmen“) |
| Leise | transparent, Schrift `--ink2` | Navigation, „Heute“, „Abbrechen“ |
| Gefahr | transparent, Schrift `--danger`, 600 | „Stornieren“, „Löschen“, immer rechts außen und mit Rückfrage |
| Icon | 36–40 quadratisch, Rahmen `--line`, mit `aria-label` | ×, ‹ ›, Einstellungen |

Mindesthöhe 44 px für Hauptaktionen (Fahrer-App 52 px), 34–36 px in dichten Listen.

### 5.2 Etiketten und Pillen
- **Info-Etikett** (z. B. Fahrer neben dem Kennzeichen): 11 px, 600, `--chip-bg`/`--chip-fg`, Radius 6, Padding 2/6.
- **Status-Pille:** 12 px, 700, Radius 999. Neutral `--chip-*`, Achtung `--warn-*`, Erfolg `--ok-*`.
- **Zähler-Badge:** Pille mit Zahl, z. B. „3“ im Warnstil neben „Nicht zugewiesen“.

### 5.3 Karten und Kennzahlen
- Karte: `--surf`, Rahmen `--line`, Radius 14, Padding 16.
- **Kennzahl-Kachel:** Beschriftung 12 `--mute`, Zahl 24/700, optional Zusatz 13 `--mute` („· 38 erledigt“). Eine Kachel im Warnstil nur dann, wenn sie Handlungsbedarf zeigt.
- Höchstens 4–5 Kennzahlen pro Seite.

### 5.4 Chips im Zeitstrahl und Kalender
Gleiche Farbe (Transportart), der Zustand ergibt sich aus der Füllung:

| Zustand | Hintergrund | Rahmen | Schrift |
|---|---|---|---|
| erledigt | `faint` | 1px `tint` | `ink` |
| geplant | `tint` | 1,5px `main` | `ink` |
| läuft | `solid` | – | weiß |
| verspätet / Konflikt | `solid` | Ring 2px `--late-ring` + Etikett „+12“ | weiß |
| Vorschlag (System/KI) | weiß | 2px **gestrichelt** `solid` | `ink` |

**Gestrichelt bedeutet überall „Vorschlag, noch nicht bestätigt“.** Das gilt auch in Formularen und Listen.

### 5.5 Listen und Tabellen
- Kopfzeile `--surf2`, Text 12 `--mute`. Zeilen 48–58 px hoch, Trennlinie `--line2`.
- Erste Spalte: Hauptobjekt fett + Info-Etikett rechts daneben. Zweite Zeile darunter: Status-Punkt + Status + grauer Zusatz. Dieses Muster stammt aus der Fahrzeugspalte und gilt für Patienten, Fahrer und Fahrzeuge gleich.
- Die ganze Zeile ist klickbar und öffnet die Details (Modal oder Seitenpanel).
- Zeilen mit Handlungsbedarf bekommen ein Warn-Etikett in der Zeile, keinen farbigen Zeilenhintergrund.
- Breite Tabellen scrollen waagerecht in ihrem Kasten, nie die ganze Seite.

### 5.6 Detail-Fenster (Modal) bzw. Detail-Seite
Dieser Aufbau ist für alle Objekte gleich (Fahrt, Patient, Fahrzeug, Rechnung):
1. **Kopf:** fachliche Etiketten (Art, Status), darunter der Titel 22 px und eine Meta-Zeile (Zeit, Nummer) in Mono. Rechts der Knopf „×“.
2. **Feld-Raster mit 2 Spalten:** Beschriftung 12 `--mute` über dem Wert 14. Fehlende oder kritische Werte in `--warn-fg` („fehlt“, „noch offen“).
3. **Fortschritt** (falls es einen Ablauf gibt): Segmentbalken, erledigt `--acc`, aktuell in der Statusfarbe, offen `--line`.
4. **Hinweise-Kasten:** `--surf2`, Freitext + Kontakt + „Anrufen“.
5. **Fußzeile:** Primäraktion links, Sekundäraktionen daneben, Gefahr rechts außen.

Das Modal schließt mit ×, Esc oder Klick auf den Hintergrund. Der Fokus ist darin gefangen und springt danach zurück zum Auslöser.

### 5.7 Formulare
- Beschriftung über dem Feld (12–13, 600). Eingaben 44 hoch, Radius 10, Rahmen `--line`, Fokus-Ring 2px `--acc`.
- **Vorschläge vom System** stehen als gestrichelte Pille unter dem Feld: „Vorschlag: AOK Rheinland/Hamburg – übernehmen“.
- Fehlermeldung direkt unter dem Feld in `--danger`, in Klartext („Bitte Abholzeit angeben“).
- Pflichtfelder sparsam. Was das System selbst ermitteln kann, wird nicht abgefragt.
- Speichern unten rechts (Primär), Abbrechen daneben (Leise).

### 5.8 Panel „KI / Live-Ereignis“
Für alles, was gerade passiert (Anruf, Fahrer meldet sich, neue Online-Buchung):
- Karte mit Rahmen 1,5 px `--call-bd #CBD2DA`, Kopf mit Live-Punkt + Titel + Laufzeit.
- Inhalt: Verlauf (Sprechblasen) → erkannte Daten (Raster mit 2 Spalten) → Vorschlag → Aktionen.
- Nach der Aktion: Erfolgszeile `--ok-*` mit Haken und „Rückgängig“.

### 5.9 Leere Zustände, Laden, Fehler
- **Leer:** ein Satz, was hier erscheint, plus die passende Aktion („Noch keine Serienfahrten. [+ Serie anlegen]“). Keine Illustrationen.
- **Laden:** Platzhalter-Balken in `--line2` in Form des Inhalts, keine Drehkreisel über ganzen Seiten.
- **Fehler:** Kasten im Warnstil mit Klartext und „Erneut versuchen“.
- **Live-Verbindung weg:** schmale Leiste oben im Warnstil: „Live-Daten getrennt – letzte Aktualisierung 13:41“.

---

## 6. Seitenaufbau (Vorlagen für jeden Bereich)

Alle Seiten haben dieselbe **Kopfzeile** (Logo · Bereichsnavigation · Suche · Live-Pille · Primäraktion) und darunter eines dieser Muster:

| Muster | Aufbau | Für |
|---|---|---|
| **Planung** | Kennzahlen → Zeitstrahl/Kalender (breit) + Seitenpanel (Live/Offen, max. 420 px) | Disposition, Dienstplan, Serienfahrten |
| **Liste** | Filterleiste (Pillen + Suche) → Tabelle → Klick öffnet Details | Patienten, Fahrzeuge, Fahrer, Fahrten-Archiv, Rechnungen |
| **Detail** | Kopf wie im Modal (5.6) → Reiter (Übersicht · Fahrten · Dokumente · Verlauf) → Karten | Patientenakte, Fahrzeugakte, Rechnung |
| **Formular** | eine Spalte, max. 720 px, Abschnitte als Karten | Neue Fahrt, Patient anlegen, Einstellungen |
| **Übersicht** | 4 Kennzahlen → 2–3 Karten mit „braucht dich“-Listen | Startseite, Abrechnung-Übersicht |

Responsiv: `flex-wrap`. Unter ca. 1000 px rutscht das Seitenpanel nach unten, die Navigation wird zum Menü und die Tabellen scrollen in ihrem Kasten.

**Bereichsnavigation** (Vorschlag): Disposition · Patienten · Fahrzeuge & Fahrer · Serienfahrten · Abrechnung · Einstellungen. Der aktive Bereich ist als Pille in `--chip-bg` mit Schrift `--ink` 600 hervorgehoben.

---

## 7. Übertrag auf die einzelnen Bereiche (Beispiele)

- **Patienten (Liste):** Spalte 1 mit Name + Etikett der Transportart (Quadrat) + Kostenträger als Info-Etikett. Darunter die nächste Fahrt („morgen 07:30 · Dialyse“) oder „Transportschein fehlt“ in Warnfarbe. Klick öffnet die Patientenakte.
- **Fahrzeuge & Fahrer:** dasselbe Zeilenmuster wie die Fahrzeugspalte im Dashboard: Kennzeichen + Fahrer-Etikett, darunter der Live-Status. Zusatzspalten: TÜV/Wartung (Warnung, wenn < 30 Tage), heutige Fahrten.
- **Serienfahrten:** Muster „Planung“, Wochenraster statt Tageszeitstrahl, Chips in der Transportart-Farbe. Vom System erzeugte, noch unbestätigte Termine sind **gestrichelt**.
- **Abrechnung:** Muster „Übersicht“. Kennzahlen: abrechenbar · offen · fehlende Unterlagen (Warnstil). Liste „Braucht dich“ zuerst. Beträge in Mono, rechtsbündig.
- **Einstellungen:** Muster „Formular“. Gruppen als Karten (Betrieb · Fahrzeuge · KI-Telefon · Benutzer).
- **Fahrer-App (Handy):** gleiche Tokens, größer: Grundtext 16, Knöpfe 52 px hoch, ein Primärknopf unten fixiert („Fahrgast im Auto“ → „Am Ziel“). Transportart als großes Etikett mit Text, Adresse groß, „Navigation starten“ als Sekundärknopf.

---

## 8. Sprache und Begriffe

- Deutsch, du-los und sachlich (keine Anrede). Kurze Aussagesätze.
- Feste Begriffe, überall gleich:
  - **Fahrgast**, nicht Patient, in Status- und Live-Texten. In Akten und der Abrechnung heißt es **Patient**.
  - **Transportart**: Liegend, Tragestuhl, Rollstuhl, Sitzend.
  - **Fahrtstatus**: Geplant → Fährt zum Fahrgast → Fahrgast im Auto → Fahrgast am Ziel → Abgeschlossen / Storniert.
  - Aktionen: **Auto zuweisen**, Selbst übernehmen, Fahrzeug ändern, Rückfahrt anlegen, Stornieren.
- Knöpfe beginnen mit einem Verb. Erfolgsmeldungen sagen, was passiert ist **und** was als Nächstes passiert („Fahrer benachrichtigt“).
- Telefonnummern im Überblick maskiert (`0240 4 · · · · · 12`), vollständig erst im Detail.

---

## 9. Barrierefreiheit (Pflicht)

- Kontrast für Text mindestens 4,5:1. Farben, die man unterscheiden muss, unterscheiden sich auch in der Helligkeit.
- Nie nur Farbe: Zu jedem Farbsignal gehören Text, Tooltip oder `aria-label`.
- Echte `<button>`, `<a>`, `<input>` mit Label. Alles ist per Tastatur erreichbar und der Fokus ist sichtbar.
- Modals mit `role="dialog"`, Fokusfalle und Esc.
- Live-Änderungen (neuer Anruf, Verspätung) per `aria-live="polite"` ansagen.

---

## 10. Technische Umsetzung

- Tokens als CSS-Variablen in **einer** Datei (`tokens.css`). Bei Tailwind die Tokens in `tailwind.config` abbilden.
- Transportart- und Statusfarben **nur** über Hilfsfunktionen holen, z. B. `farbeFuerArt(art)` und `chipStil(art, zustand)`, nie verstreut im Code.
- Wiederverwendbare Komponenten: `Button`, `Pill`, `InfoTag`, `StatusDot`, `KpiTile`, `Card`, `DataTable`, `Modal` (bisher `DetailModal` genannt, jetzt als allgemeines Überlagerungs-Fenster gebaut: `src/components/ui/Modal.tsx`, genutzt für Fahrt-Details und Formulare), `FieldGrid`, `ProgressSteps`, `LivePanel`, `EmptyState`, `TransportBadge`, `TripChip`.
- Neue Seiten werden **nur** aus diesen Komponenten gebaut. Fehlt etwas, wird zuerst die Komponente ergänzt und hier dokumentiert.

---

## 11. Checkliste für jede neue Seite

- [ ] Eines der 5 Seitenmuster aus Abschnitt 6 verwendet
- [ ] Höchstens ein Primärknopf pro Bereich
- [ ] Farben nur aus den Tokens; Orange nur für Handlungsbedarf
- [ ] Transportart überall gleich dargestellt (Abschnitt 2)
- [ ] Vorschläge gestrichelt und mit Begründung, bestätigen mit einem Klick
- [ ] Zeilenmuster „Name + Etikett / Status-Punkt + Status + Zusatz“ für Objekte
- [ ] Details öffnen im Modal oder auf einer Detailseite im Standardaufbau (5.6)
- [ ] Leer-, Lade- und Fehlerzustand vorhanden
- [ ] Begriffe aus Abschnitt 8
- [ ] Tastatur, Kontrast, `aria-label` geprüft
- [ ] Unter 1000 px Breite und am Handy getestet

---

## 12. Einbindung in Claude Code

In die `CLAUDE.md` des Projekts eintragen:

```md
## Design
Vor jeder UI-Arbeit `docs/DESIGN-GUIDE.md` lesen und einhalten.
Referenz-Screen: `docs/A1-Farbe-1-gedaempft.dc.html` (Dispo-Tagesansicht).
Neue Seiten nur aus den Komponenten in Abschnitt 10 bauen; fehlende Komponenten zuerst ergänzen und im Guide dokumentieren.
Am Ende jeder UI-Aufgabe die Checkliste aus Abschnitt 11 durchgehen und das Ergebnis nennen.
```

Ablage: `docs/DESIGN-GUIDE.md`, `docs/DISPO-SPEZ.md`, `docs/A1-Farbe-1-gedaempft.dc.html`.

---

**Status in diesem Projekt (Stand 27.10.2026):** Eingebunden als neuer Standard (Nutzer-Entscheidung: komplette Umstellung). Tokens in `src/app/globals.css`, Schrift in `src/app/layout.tsx` (IBM Plex Sans/Mono), Grundkomponenten in `src/components/ui/` auf den Guide umgestellt. Bestehende Seiten bekommen den neuen Look automatisch über die Tokens; Sprache (du-los/sachlich) und Seitenmuster (Abschnitt 6) werden nach und nach angepasst, nicht alle Seiten auf einmal. `ProgressSteps` ist jetzt gebaut (`src/components/ui/ProgressSteps.tsx`, genutzt vom Einrichtungsassistenten, Phase 9). `Modal` ist jetzt gebaut (`src/components/ui/Modal.tsx`, genutzt für Fahrt-Details im Dispo-Dashboard und das "Neue Fahrt"-Formular). Noch fehlende Bausteine aus Abschnitt 10 (`FieldGrid`, `LivePanel`, `TripChip`) sind weiter nicht gebaut – erst bei Bedarf ergänzen.
