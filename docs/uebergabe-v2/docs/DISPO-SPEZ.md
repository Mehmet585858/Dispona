# Dispona – Produkt- und Oberflächen-Spezifikation

Version 2 · 28.10.2026 · ersetzt Version 1 vom 27.10.2026
Referenz-Design: `design/dashboard-referenz.html` (im Browser öffnen, mit Lite/Pro umschaltbar)
Technik im Hintergrund: `docs/BACKEND.md` · Gestaltung: `docs/DESIGN-GUIDE.md`

> **Was sich gegenüber V1 geändert hat**
> - Produktname **Dispona**, Logo in Comfortaa mit grünem Punkt im „o“ (`brand/`).
> - **Dispona plant selbst:** In Pro wird jede erkannte Fahrt sofort beim nächstbesten Fahrzeug eingeplant. Es gibt keinen „Auto zuweisen“-Knopf mehr. Der Disponent kann **Umplanen** oder **Rückgängig** machen.
> - Zwei Pakete: **Lite** und **Pro** (Abschnitt 2).
> - „Nicht zugewiesen“ heißt jetzt **„Braucht Sie“** und enthält nur Fälle, die Dispona nicht allein lösen kann.
> - Neu: **Fahrtenbuch-Download** (Pro), **mehrere Anrufe gleichzeitig**, **Kunden-Login** mit getrennten Mandanten.

---

## 1. Worum es geht

Dispona ist eine Software für **Krankenfahrdienste**.

1. **Dispona am Telefon:** Eine Sprach-KI nimmt Anrufe unter der bestehenden Nummer des Fahrdienstes an, 24/7 und auch mehrere gleichzeitig. Sie erfasst Patient, Transportart, Abholung, Ziel, Zeit und Hin- oder Rückfahrt.
2. **Auto-Dispo (nur Pro):** Dispona plant die Fahrt sofort beim nächstbesten passenden Fahrzeug ein und schickt sie in die Fahrer-App.
3. **Dashboard:** Der Fahrdienst sieht alles live, greift nur ein, wenn nötig, und lädt am Monatsende das Fahrtenbuch für die Abrechnung herunter.

Ziel: Ein Disponent arbeitet ohne Schulung damit. Wenig Farben, klare Zustände.
DMRZ ist in V1 **nicht** angebunden.

---

## 2. Pakete und Preise (steuern, was der Kunde sieht)

| Funktion | Lite | Pro |
|---|:-:|:-:|
| Dispona am Telefon, 24/7, eigene Nummer, parallele Anrufe | ✓ | ✓ |
| Fahrtdaten im Gespräch erfasst | ✓ | ✓ |
| Dashboard: Liste aller Fahrtanfragen | ✓ | ✓ |
| Weiterleitung an einen Menschen bei Bedarf | ✓ | ✓ |
| Fahrzeugvorschlag | – | ✓ |
| **Automatische Einplanung beim nächstbesten Wagen** | – | ✓ |
| **Fahrer-App** mit Live-Status | – | ✓ |
| Zeitstrahl, Wochenansicht, Serienfahrten | – | ✓ |
| Buchungsformular für die Webseite des Fahrdienstes | – | ✓ |
| **Fahrtenbuch zum Herunterladen** (Abrechnung) | – | ✓ |
| Support | E-Mail | Telefon + E-Mail |

**Preise** (zzgl. MwSt.): Einrichtung einmalig **249 €**. Danach pro Anruf, den Dispona annimmt: **Lite 1,95 €**, **Pro 2,49 €**. Keine Grundgebühr, Wechsel jederzeit.

Technisch: Jeder Mandant hat `paket: 'LITE' | 'PRO'`. Pro-Funktionen werden im Backend gesperrt (nicht nur ausgeblendet). Wie Anrufe gezählt werden, steht in `BACKEND.md` Abschnitt 8.

> **Offen, bitte mit Mehmet klären, bevor gebaut wird:**
> - Lite: Darf der Disponent einer Anfrage ein eigenes Fahrzeug zuordnen, oder nur „Übernommen“ markieren? (Referenz: nur markieren.)
> - Welche Anrufe werden berechnet (Mindestdauer, Verwählte, Spam)? Kosten Webseiten-Buchungen etwas?
> - Format des Fahrtenbuchs (Excel/CSV + PDF angenommen) und welche Spalten die Abrechnungsstelle braucht.

---

## 3. Oberfläche

Grundaufbau wie `design/dashboard-referenz.html`. Die gelbe „Referenz-Mockup“-Leiste gehört **nicht** zum Produkt.

### 3.1 Kopfzeile
Logo `brand/dispona-logo.svg` (Höhe 28–31 px) · Datumsumschalter (‹ Datum › Heute) · Suche (Strg+K) · Live-Pille „Dispona · N Anrufe laufen“ bzw. „Dispona bereit“ · **Fahrtenbuch** (nur Pro) · Primärknopf **+ Neue Fahrt**.

### 3.2 Kennzahlen
- **Pro:** Fahrten heute (+ erledigt) · Gerade unterwegs · Von Dispona eingeplant · **Braucht Sie** (Warnstil) · Anrufe heute (+ max. gleichzeitig).
- **Lite:** Anrufe heute · Neue Fahrtanfragen · **Noch nicht übernommen** (Warnstil) · Nachts/Wochenende.

Alle Werte live berechnen, nie fest eintragen.

### 3.3 Zeitstrahl (Pro)
- Zeilen = Fahrzeuge, Spalten = Zeit (sichtbar 08–16, scrollbar 00–24). Rote **Jetzt-Linie**, minütlich aktualisiert.
- **Fahrzeugspalte (230 px):**
  - Zeile 1: Kennzeichen fett und rechts daneben das **Fahrer-Etikett** (nur Nachnamen, „Albers · Brandt“).
  - Zeile 2: **Live-Status** mit Punkt, Text und grauem Zusatz:
    - Fährt zum Fahrgast · „K. Vogt, 13:30“
    - Fahrgast im Auto · „Ankunft 13:41“
    - Fahrgast am Ziel · „seit 13:20“
    - Frei · Standort
    - verspätet: wie „Fährt zum Fahrgast“, Text orange, Zusatz „+12 Min.“
  - Tooltip: Kennzeichen · Fahrzeugtyp · volle Namen.
- **Fahrt-Chip:** ein Button, Position = Startzeit, Breite = Dauer. Zeile 1 Startzeit (Mono), Zeile 2 Kurzname. **Kein Text zur Transportart**, die steckt in der Farbe. Etiketten „+12“ (verspätet) oder „neu“ (eben von Dispona eingeplant).
- Die Zeile eines eben eingeplanten Fahrzeugs ist leicht hinterlegt (`--hl`).
- **Legende unter dem Plan:** Transportart (4 Farben) und Zustand (5 Stile). Rechts „Klick auf eine Fahrt zeigt alle Details.“

### 3.4 Anfragenliste (Lite)
Tabelle: Eingang (Uhrzeit, „läuft“-Pille bei aktivem Anruf) · Fahrgast (Farbquadrat der Transportart, Name, Art) · Von → Nach · Gewünscht · Status (Knopf **Übernehmen** oder Pille „Übernommen“). Fußzeile: Legende und der Hinweis „Fahrzeugvorschlag, Einplanung und Fahrer-App gibt es mit Dispona Pro.“

### 3.5 Seitenpanel „Anruf läuft“
- Kopf: grüner Punkt, „Anruf läuft“, Dauer (live). Bei mehreren gleichzeitigen Anrufen gibt es pro Anruf eine Karte, die neueste oben. Ab 3 Anrufen werden die älteren zu einer Zeile eingeklappt.
- Anrufer: Nummer maskiert und erkannte Einrichtung.
- Live-Transkript als Sprechblasen (Anrufer links, Dispona rechts).
- Erkannte Felder: Patient · Transport · Abholung · Ziel · Zeit · **Eingeplant bei** (Pro) bzw. **Planung: durch Sie** (Lite). Noch fehlende Felder erscheinen grau als „…“.
- **Ergebnis-Zeile (Pro):** Haken + „Automatisch eingeplant bei LMW 106 · Fahrer benachrichtigt“, Knöpfe **Umplanen** und **Rückgängig**, darunter die Begründung („frei ab 15:00 · 2 km Anfahrt · darf Liegend fahren“).
  - *Rückgängig:* Die Fahrt verliert ihr Fahrzeug, der Fahrer bekommt eine Absage, die Fahrt landet in „Braucht Sie“.
  - *Umplanen:* Auswahl der nächstbesten Alternativen, der alte und der neue Fahrer werden benachrichtigt.
- **Ergebnis-Zeile (Lite):** „Fahrt erfasst · liegt in Ihrer Liste“.

### 3.6 „Braucht Sie“ (Pro)
Hier landen nur Fahrten, die Dispona **nicht** allein einplanen konnte. Jede Fahrt zeigt den Grund in Warnfarbe, z. B. „Kein Rollstuhl-Fahrzeug frei zwischen 15:30 und 16:30“, „Einplanung rückgängig gemacht“, „Anrufer wollte einen Menschen“ oder „Adresse unklar“. Knopf **Fahrzeug wählen**.

### 3.7 Neue Fahrt (manuell)
Formular: Fahrgast (Suche mit Vorschlag aus früheren Fahrten), Transportart (4 große Knöpfe in Transportfarbe), Abholung, Ziel, Datum/Zeit, Hin/Rück, Rückfahrt gleich mit anlegen, Serie (Wochentage, bis Datum), Kostenträger, Transportschein-Status, Hinweise, Kontakt.
- Pro: Beim Speichern plant Dispona automatisch ein, genau wie bei einem Anruf.
- Lite: Die Fahrt landet in der Liste.

### 3.8 Detail-Fenster (Klick auf Fahrt)
- Etiketten: Transportart (gefüllt), Status, Hin/Rück. Titel = voller Name, darunter die Zeit in Mono.
- Raster: Abholung · Ziel · Fahrzeug · Besatzung · Kostenträger · Transportschein (fehlt/offen in Warnfarbe). Bei automatisch eingeplanten Fahrten zusätzlich „Von Dispona eingeplant, weil …“.
- Ablauf-Balken: Geplant → Fährt zum Fahrgast → Fahrgast im Auto → Fahrgast am Ziel.
- Hinweise, Kontakt mit „Anrufen“, Link zur **Gesprächsaufzeichnung bzw. zum Transkript** des Anrufs (falls vorhanden).
- Fuß: Bearbeiten · Fahrzeug ändern · Rückfahrt anlegen · rechts **Stornieren** (fragt im Knopf selbst nach, kein Browser-Dialog).
- Schließen mit ×, Esc oder Klick daneben. Der Fokus bleibt im Fenster gefangen.

### 3.9 Fahrtenbuch (Pro)
Knopf in der Kopfzeile öffnet: Zeitraum (Vormonat vorausgewählt), Fahrzeug(e), Format (Excel/CSV, PDF), Knopf **Herunterladen**.
Spalten mindestens: Datum, Uhrzeit Start/Ende, Fahrgast, Transportart, Hin/Rück, Abholadresse, Zieladresse, km (aus Fahrer-App bzw. Routenberechnung), Fahrzeug, Fahrer, Kostenträger, Transportschein-Status, Status, Fahrt-ID.

### 3.10 Später (nicht V1)
Wochenansicht, große Suche mit Freitext („morgen Liege frei“), Drag & Drop im Zeitstrahl, Kartenansicht, Klinik-Portal. Entwürfe dazu liegen auf der Design-Fläche (A5).

---

## 4. Farben und Stile

### 4.1 Transportart = Farbe (gehört zur Fahrt, nicht zum Fahrzeug)

| Art | main | solid (Füllung „unterwegs“, weiße Schrift) | tint | faint | ink |
|---|---|---|---|---|---|
| Liegend | `#8B7FB8` | `#5B4F8F` | `#ECE9F5` | `#F7F6FB` | `#3D3466` |
| Tragestuhl | `#6D97A3` | `#3E6C78` | `#E4EEF1` | `#F4F8F9` | `#24434B` |
| Rollstuhl | `#7D96C2` | `#4A6597` | `#E7ECF5` | `#F5F7FB` | `#263C5E` |
| Sitzend | `#8CA894` | `#4E7559` | `#E8F0EA` | `#F5F9F6` | `#2F4A36` |

### 4.2 Zustand = Füllung

| Zustand | Hintergrund | Rahmen | Schrift | Extra |
|---|---|---|---|---|
| erledigt | faint | 1px tint | ink | – |
| geplant | tint | 1,5px main | ink | – |
| unterwegs | solid | – | weiß | – |
| verspätet | solid | – | weiß | Ring 2px `#D97706`, Etikett „+12“ |
| **neu von Dispona** | tint | 1,5px main | ink | Ring 3px grün `rgba(94,140,106,.45)`, Etikett „neu“ (verschwindet nach 10 Min. oder beim Öffnen) |

### 4.3 Live-Status-Punkte
Fährt zum Fahrgast `#C8A15A` · Fahrgast im Auto `#5873A8` · Fahrgast am Ziel `#5E8C6A` · Frei `#B4BCC6` · verspätet `#D97706` (Text `#9A4A0A`).

Alle weiteren Tokens stehen im `:root` von `design/dashboard-referenz.html` und in `DESIGN-GUIDE.md`. **Orange nur für „braucht Aufmerksamkeit“.**

---

## 5. Datenmodell (Vorschlag)

```ts
type Paket = 'LITE' | 'PRO';
type Transportart = 'LIEGEND' | 'TRAGESTUHL' | 'ROLLSTUHL' | 'SITZEND';
type FahrtStatus = 'ANFRAGE' | 'GEPLANT' | 'ANFAHRT' | 'FAHRGAST_IM_AUTO' | 'AM_ZIEL' | 'ABGESCHLOSSEN' | 'STORNIERT';
type FahrzeugLive = 'FREI' | 'ANFAHRT' | 'FAHRGAST_IM_AUTO' | 'AM_ZIEL' | 'PAUSE' | 'AUSSER_DIENST';

interface Mandant {            // = ein Fahrdienst (Kunde)
  id: string; name: string; paket: Paket;
  telefonnummern: string[];    // die eigenen Nummern, die zu Dispona umgeleitet werden
  betriebszeiten?: Wochenplan; // wann Dispona annimmt (immer / außerhalb / bei besetzt)
  einstellungen: { pufferMin: number; autoEinplanung: boolean; pruefFaelle?: string[]; begruessung: string; stimme?: string; weiterleitungAn?: string };
}
interface Benutzer { id; mandantId; name; email; rolle: 'INHABER' | 'DISPONENT' | 'FAHRER'; }
interface Fahrzeug { id; mandantId; kennzeichen: string; typ: 'LIEGEWAGEN'|'TRAGESTUHL'|'ROLLSTUHL'|'TAXI';
  erlaubteArten: Transportart[]; aktiv: boolean;
  live?: { status: FahrzeugLive; seit: Date; position?: GeoPoint; verspaetungMin?: number } }
interface Schicht { id; fahrzeugId; fahrerIds: string[]; start: Date; ende: Date }   // wer fährt wann welches Fahrzeug
interface Patient { id; mandantId; vorname; nachname; telefon?; standardAdresse?; kostentraeger?; hinweise? }
interface Fahrt {
  id; mandantId; patientId; art: Transportart; richtung: 'HIN'|'RUECK';
  abholung: Adresse; ziel: Adresse; start: Date; ende: Date;   // ende = berechnet aus Fahrzeit + Ladezeit
  fahrzeugId?: string; status: FahrtStatus; verspaetungMin?: number;
  quelle: 'TELEFON'|'MANUELL'|'WEBFORMULAR'|'SERIE'; anrufId?: string; serieId?: string;
  eingeplantVon?: 'DISPONA'|'MENSCH'; einplanGrund?: string; brauchtSieGrund?: string;
  kostentraeger?; transportschein: 'LIEGT_VOR'|'FEHLT'|'OFFEN'; hinweise?; kontakt?;
  kmGefahren?: number; zeitstempel: { angefahren?; fahrgastIm?; amZiel? };
}
interface Anruf {
  id; mandantId; von: string; an: string; start: Date; ende?: Date; dauerSek?: number;
  status: 'LAEUFT'|'BEENDET'|'WEITERGELEITET'|'ABGEBROCHEN';
  transkript: { sprecher: 'ANRUFER'|'DISPONA'; text: string; zeit: Date }[];
  erkannt: Partial<Fahrt> & { patientName?: string };
  ergebnis?: 'FAHRT_ANGELEGT'|'AUSKUNFT'|'WEITERGELEITET'|'KEIN_ANLIEGEN';
  abrechenbar: boolean;
}
interface AuditEintrag { id; mandantId; wer: 'DISPONA'|string; was: string; fahrtId?; zeit: Date }
```

Jede Tabelle hat `mandantId`, und jede Abfrage filtert danach (Row-Level-Security). Abgeleitete Werte wie Chip-Zustand oder Kennzahlen werden nicht gespeichert.

---

## 6. Regeln „nächstbester Wagen“ (V1)

1. Das Fahrzeug darf die Transportart fahren (`erlaubteArten`) und hat zur Zeit eine Schicht.
2. Es ist frei im Fenster: [Abholzeit − Anfahrt − Puffer, Ende + Puffer] (Puffer Standard 10 Min.).
3. Unter den passenden gewinnt die **kürzeste Leerfahrt**: von der Zieladresse der vorherigen Fahrt bzw. der aktuellen Position (Fahrer-App) zur Abholung.
4. Bei Gleichstand gewinnt das Fahrzeug mit weniger Fahrten heute.
5. Passt keines: Die Fahrt kommt nach „Braucht Sie“, mit Grund. Dispona sagt dem Anrufer „Wir melden uns zur Bestätigung“ und nie eine Zusage, die es nicht halten kann.
6. Jede Entscheidung schreibt `einplanGrund` als Klartext und einen Audit-Eintrag.

---

## 7. Akzeptanzkriterien V1

- [ ] Login pro Fahrdienst. Kein Mandant sieht Daten eines anderen (getestet).
- [ ] Ein Testanruf auf der Nummer erzeugt live ein Transkript und erkannte Felder im Dashboard.
- [ ] Zwei gleichzeitige Testanrufe werden beide angenommen und erscheinen beide.
- [ ] **Pro:** Die Fahrt wird automatisch eingeplant, der Chip erscheint mit „neu“ und der Fahrer bekommt sie in der App. Umplanen und Rückgängig funktionieren.
- [ ] **Pro:** Passt kein Fahrzeug, landet die Fahrt mit Grund in „Braucht Sie“.
- [ ] **Lite:** Die Fahrt erscheint in der Anfragenliste. Fahrzeugvorschlag, Zeitstrahl, Fahrer-App und Fahrtenbuch sind gesperrt, auch über die API.
- [ ] Fahrer-App-Status (Anfahrt, Fahrgast im Auto, am Ziel) erscheint innerhalb von 5 Sekunden im Dashboard.
- [ ] Chips: Farbe = Transportart, Füllung = Zustand, Legende korrekt.
- [ ] Detail-Fenster mit allen Feldern aus 3.8. Esc, × und Klick daneben schließen es.
- [ ] Fahrtenbuch-Download (Pro) als Excel/CSV und PDF für einen Monat.
- [ ] Anrufzähler pro Mandant und Monat stimmt mit der Telefonie-Abrechnung überein.
- [ ] Unter 1000 px rutscht das Panel unter den Plan, der Zeitstrahl scrollt in seinem Kasten. Bedienbar per Tastatur, Kontrast AA.
