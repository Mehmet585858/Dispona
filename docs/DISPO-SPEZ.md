# Dispo-Dashboard Krankenfahrten – Übergabe an Claude Code

Version 1 · 27.10.2026 · Design: „A1 · Farbe 1 – Gedämpft“
Referenz-Design liegt bei: `A1-Farbe-1-gedaempft.dc.html` (HTML-Mockup mit allen Farben, Abständen und Texten; die Logik im `<script>`-Block zeigt das gewünschte Verhalten).

---

## 1. Worum es geht

Disponenten eines Krankenfahrdienstes planen ihre Fahrten auf **einem Bildschirm**:

- **Zeitstrahl** pro Fahrzeug (Zeilen) über den Tag (Spalten, 08–16 Uhr sichtbar, scrollbar).
- **KI-Telefon**: Eine Sprach-KI nimmt Anrufe an, erkennt Patient, Transportart, Abholung, Ziel, Zeit und schlägt das beste Fahrzeug vor. Der Vorschlag erscheint live im Zeitstrahl (gestrichelt). Mit **„Auto zuweisen“** wird er zur festen Fahrt.
- **Fahrer-App** (eigene App, wird separat gebaut) meldet den Live-Status je Fahrzeug: *Fährt zum Fahrgast → Fahrgast im Auto → Fahrgast am Ziel*.
- **Klick auf eine Fahrt** öffnet ein Detail-Fenster.

Ziel: so einfach, dass ein Disponent ohne Schulung loslegt. Wenig Farben, klare Zustände.
DMRZ ist vorerst **nicht** angebunden. Alles läuft über die eigene Software.

---

## 2. Aufbau des Bildschirms

```
┌ Kopfzeile ───────────────────────────────────────────────────────────────┐
│ [D] Dispo   [‹ Di, 27.10.2026 › Heute]   [Suche……………]  ● KI-Telefon · 1 Anruf läuft   [+ Neue Fahrt] │
├ Kennzahlen ──────────────────────────────────────────────────────────────┤
│ Fahrten heute 64 · 38 erledigt │ Gerade unterwegs 9 │ Nicht zugewiesen 3 (orange) │ Anrufe heute 23 · 19 automatisch │
├──────────────────────────────────────────────────────┬──────────────────┤
│ ZEITSTRAHL                                            │ SEITENPANEL      │
│ Kopf: „10 Fahrzeuge · 08–16 Uhr“ … Tageszahlen        │ ┌ Anruf läuft ┐  │
│ Stunden-Skala 08:00 … 16:00                           │ │ Verlauf      │  │
│ ┌ Fahrzeugspalte 230px ┐┌ Spur mit Fahrt-Chips ─────┐ │ │ erkannte     │  │
│ │ LMW 106 [Albers·Brandt]││ [08:15 H. Grote] [09:45…] │ │ │ Daten        │  │
│ │ ● Fahrgast im Auto · Ankunft 13:41                 │ │ │ [Auto zuweisen] [Selbst übernehmen] │
│ └────────────────────┘└───────────────────────────┘ │ └──────────────┘  │
│ … weitere Fahrzeuge                     │ rote Jetzt-Linie │ ┌ Nicht zugewiesen ┐ │
│ Legende: Transportart (4 Farben) · Zustand (5 Stile)  │ │ je Fahrt: Zeit, Name, Vorschlag, [Auto zuweisen] │
└──────────────────────────────────────────────────────┴──────────────────┘
Detail-Fenster (Modal) liegt bei Klick über allem.
```

**Responsiv:** Zeitstrahl `flex: 999 1 640px`, Seitenpanel `flex: 1 1 340px; max-width: 420px`, beide in einer `flex-wrap`-Zeile. Unter ca. 1000 px rutscht das Panel unter den Zeitstrahl. Der Zeitstrahl hat `min-width: 900px` im Inneren und scrollt waagerecht in seinem eigenen Kasten. Die Seite selbst scrollt nie waagerecht.

---

## 3. Bausteine im Detail

### 3.1 Kopfzeile
- Logo (32×32, Radius 8, Akzentfarbe) + „Dispo“.
- Datumsumschalter: ‹ / Datum / › / „Heute“ in einer grauen Gruppe.
- Suchfeld (Höhe 44): Platzhalter „Patient, Fahrzeug oder Telefonnummer suchen …“. Suche ist in V1 nur ein Feld. Die ausgebaute Suche kommt später (siehe Abschnitt 10).
- Status-Pille KI-Telefon: Punkt + „KI-Telefon · 1 Anruf läuft“ bzw. „KI-Telefon bereit“.
- Primärknopf „+ Neue Fahrt“.

### 3.2 Kennzahlen (4 Kacheln)
Fahrten heute (+ erledigt) · Gerade unterwegs · **Nicht zugewiesen** (Warnstil, orange) · Anrufe heute (+ davon automatisch).
Alle Werte live aus den Daten berechnen, nichts fest eintragen.

### 3.3 Zeitstrahl
- **Skala:** sichtbarer Bereich 08:00–16:00 (konfigurierbar, Standard 06–20 mit Scroll). Stundenlinien als dezente Gitterlinien.
- **Jetzt-Linie:** 2 px senkrecht über alle Zeilen, Farbe `now`. Läuft minütlich mit.
- **Fahrzeugspalte (230 px), zwei Zeilen:**
  1. **Kennzeichen** fett + direkt rechts daneben **Fahrer-Etikett** (11 px, halbfett, graue Pille, Radius 6). Inhalt sind nur die Nachnamen, bei zwei Personen „Albers · Brandt“. Zu lange Inhalte werden mit … gekürzt.
  2. **Live-Status:** farbiger Punkt (8 px) + Statustext halbfett + Zusatz in Grau.
     - Fährt zum Fahrgast · „K. Vogt, 13:30“ (Fahrgast + Abholzeit)
     - Fährt zum Fahrgast (verspätet) · „+12 Min.“, Text in Warnfarbe
     - Fahrgast im Auto · „Ankunft 13:41“
     - Fahrgast am Ziel · „seit 13:20“
     - Frei · Standort, z. B. „in Baesweiler“
  - Tooltip auf der Spalte: Kennzeichen · Fahrzeugtyp · volle Namen der Besatzung.
- **Zeilenhöhe** 58 px. Die Zeile des vom Anruf vorgeschlagenen Fahrzeugs wird leicht hinterlegt (`hl`).
- **Fahrt-Chip:** absolut positioniert. `left = (Start − SkalaStart) / Skalenlänge`, `width = Dauer / Skalenlänge` (minus kleiner Abstand). Höhe 44, Radius 8, Innenabstand 3/6 px.
  - Zeile 1: Startzeit in Monospace 11 px. Bei Verspätung rechts ein Etikett „+12“.
  - Zeile 2: Name kurz („H. Grote“), halbfett, mit … gekürzt.
  - **Kein Text für die Transportart.** Sie steckt in der Farbe (siehe 4.1).
  - Ist ein echter `<button>` mit `aria-label` „08:15–09:15 H. Grote · Liegend · Erledigt“. Klick öffnet das Detail-Fenster.
- **Legende unter dem Plan:** eine Zeile mit „Transportart“ (4 Farbfelder: Liegend, Tragestuhl, Rollstuhl, Sitzend) und „Zustand“ (erledigt, geplant, unterwegs, verspätet, aus Anruf). Rechts steht „Klick auf eine Fahrt zeigt alle Details.“

### 3.4 Seitenpanel – Anruf läuft
- Rahmen 1,5 px, Radius 16.
- Kopf: grüner Punkt, „Anruf läuft“, Gesprächsdauer rechts (mm:ss, live).
- Anrufer: Nummer teilweise maskiert + erkannter Name der Einrichtung.
- Gesprächsverlauf als Sprechblasen: Anrufer links, KI rechts. Live-Transkript, neueste unten, max. ca. 6 Blasen, dann scrollen.
- Erkannte Daten (2 Spalten): Patient · Transport · Abholung · Ziel · Zeit · **Bester Wagen**. Noch nicht erkannte Felder erscheinen als „…“ in Grau.
- Hinweis „Im Zeitstrahl gestrichelt eingezeichnet.“
- Knöpfe: **„Auto zuweisen“** (Primär) und „Selbst übernehmen“ (Sekundär: Disponent übernimmt das Gespräch oder die Planung manuell).
- Nach „Auto zuweisen“ werden die Knöpfe durch eine Erfolgszeile ersetzt: Haken + „An LMW 106 zugewiesen · Fahrer benachrichtigt“ + Knopf „Rückgängig“ (30 Sek. oder bis zur nächsten Aktion).
- Ohne laufenden Anruf: Das Panel zeigt „KI-Telefon bereit“ + Tageszahlen (oder klappt auf eine schmale Zeile zusammen).

### 3.5 Seitenpanel – Nicht zugewiesen
- Zähler-Badge im Warnstil.
- Je Fahrt: Startzeit (Monospace), **farbiges Quadrat 10×10 in der Transportart-Farbe** + Name, darunter „Rollstuhl · bester Wagen BTW 115 · 4 km entfernt“, rechts Knopf „Auto zuweisen“.

### 3.6 Detail-Fenster (Modal)
Öffnet bei Klick auf einen Chip. Schließt mit ×, Klick auf den Hintergrund oder Esc.
- Kopf: Etikett **Transportart** (gefüllt in der dunklen Farbe der Art, weiße Schrift) · Etikett **Status** (grau) · „Hinfahrt/Rückfahrt“. Darunter der volle Name (22 px) und „heute 12:54–14:06“ in Monospace.
- Raster mit 2 Spalten: Abholung · Ziel · Fahrzeug (Kennzeichen · Typ) · Besatzung (volle Namen) · Kostenträger · Transportschein („liegt vor“ normal, „fehlt“ bzw. „noch offen“ in Warnfarbe).
- **Ablauf**: 4 Segmente *Geplant → Fährt zum Fahrgast → Fahrgast im Auto → Fahrgast am Ziel*. Erledigte Schritte sind in Akzentfarbe, der aktuelle Schritt in der Statusfarbe (verspätet: Warnfarbe) mit fetter Beschriftung, kommende grau.
- Hinweise-Kasten: Freitext (z. B. „Sauerstoff mitführen, 2 l/min.“) + Kontakt (maskierte Nummer) + Knopf „Anrufen“.
- Fußzeile: [Auto zuweisen] nur bei Vorschlägen aus dem Anruf · Bearbeiten · Fahrzeug ändern · Rückfahrt anlegen · rechts „Stornieren“ (rote Schrift, mit Bestätigung).

---

## 4. Farbregeln

### 4.1 Transportart → Farbe (das einzige „bunte“ Merkmal)

| Art | Hauptfarbe `main` | dunkel `solid` (Füllung „unterwegs“, Text weiß) | hell `tint` | sehr hell `faint` | Schrift `ink` |
|---|---|---|---|---|---|
| Liegend | `#8B7FB8` | `#5B4F8F` | `#ECE9F5` | `#F7F6FB` | `#3D3466` |
| Tragestuhl | `#6D97A3` | `#3E6C78` | `#E4EEF1` | `#F4F8F9` | `#24434B` |
| Rollstuhl | `#7D96C2` | `#4A6597` | `#E7ECF5` | `#F5F7FB` | `#263C5E` |
| Sitzend | `#8CA894` | `#4E7559` | `#E8F0EA` | `#F5F9F6` | `#2F4A36` |

Die Transportart gehört zur **Fahrt**, nicht zum Fahrzeug. Ein Rollstuhl-BTW kann auch eine sitzende Fahrt fahren, und der Chip ist dann grün.

### 4.2 Fahrtzustand → Stil (gleiche Farbe, andere Füllung)

| Zustand | Hintergrund | Rahmen | Schrift | Extra |
|---|---|---|---|---|
| erledigt | `faint` | 1px `tint` | `ink` | – |
| geplant | `tint` | 1,5px `main` | `ink` | – |
| unterwegs (Fahrt läuft) | `solid` | 1px `solid` | weiß | – |
| verspätet | `solid` | 1px `solid` | weiß | Ring `0 0 0 2px #D97706` + Etikett „+12“ |
| Vorschlag aus Anruf | weiß | **2px gestrichelt** `solid` | `ink` | Fahrzeugzeile mit `hl` hinterlegt |

### 4.3 Fahrzeug-Livestatus → Punkt

| Status | Punkt |
|---|---|
| Fährt zum Fahrgast | `#C8A15A` |
| Fahrgast im Auto | `#5873A8` |
| Fahrgast am Ziel | `#5E8C6A` |
| Frei | `#B4BCC6` |
| verspätet (fährt zum Fahrgast) | `#D97706`, Text `#9A4A0A` |

### 4.4 Oberfläche (Design-Tokens „Gedämpft“)

```css
:root {
  --bg: #F5F6F8;        /* Seitenhintergrund */
  --surf: #FFFFFF;      /* Karten, Kopfzeile */
  --surf2: #FAFAFB;     /* Tabellenkopf, Legende, Modal-Fuß */
  --line: #E3E6EA;      /* Rahmen */
  --line2: #EEF0F3;     /* feine Trennlinien */
  --grid: #F2F3F5;      /* Stundenlinien */
  --ink: #1F2933;       /* Haupttext */
  --ink2: #3E4A56;      /* Nebentext */
  --mute: #5F6B77;      /* Beschriftungen (AA-Kontrast auf Weiß) */
  --chip-bg: #EEF1F4;  --chip-fg: #3E4A56;   /* Fahrer-Etikett, Status-Etikett */
  --seg: #F1F3F5;       /* Datums-Gruppe */
  --acc: #334155;  --acc-fg: #FFFFFF;        /* Primärknöpfe, Logo, erledigte Ablauf-Schritte */
  --now: #C2410C;       /* Jetzt-Linie */
  --warn-bg: #FBF3EA; --warn-bd: #EED3B4; --warn-fg: #8A4B12;
  --late-ring: #D97706; --late-badge: #F3D9B8; --late-badge-fg: #5C2E05;
  --hl: #F7F7FA;        /* hervorgehobene Fahrzeugzeile */
  --live-bg: #EEF1F4; --live-fg: #334155; --live-dot: #5E8C6A;
  --call-bd: #CBD2DA;
  --bubble-in: #F1F3F5;  --bubble-in-fg: #1F2933;   /* Anrufer */
  --bubble-out: #E7EAF0; --bubble-out-fg: #334155;  /* KI */
  --cta: #334155; --cta-fg: #FFFFFF;
  --ok-bg: #EEF3EF; --ok-fg: #2F4A36;
  --overlay: rgba(31,41,51,.4);
  --danger: #B42318;
}
```

**Grundsatz:** Orange (`--warn-*`, `--late-*`, `--now`) ist **nur** für „braucht Aufmerksamkeit“ da. Alles andere ist grau oder eine der 4 gedämpften Transportfarben.

---

## 5. Schrift, Maße, Barrierefreiheit

- Schrift: **IBM Plex Sans** (400/500/600/700) für alles, **IBM Plex Mono** 500 für Uhrzeiten (Google Fonts).
- Grundgröße 14 px. Kleine Beschriftungen 12 px, Etiketten 11 px, Kennzahlen 24 px, Modal-Titel 22 px.
- Radien: Karten 12–16, Chips/Knöpfe 8–10, Pillen 999.
- Klickflächen mindestens 44 px hoch (Hauptknöpfe), kleine Knöpfe mindestens 34–36 px.
- Echte `<button>`, `<input>` mit `<label>`/`aria-label`. Das Modal hat `role="dialog"`, den Fokus darin gefangen, Esc schließt und der Fokus springt danach zurück auf den Chip.
- Kontrast: Text mindestens 4,5:1. Farben unterscheiden sich auch in der Helligkeit, nicht nur im Farbton.
- Zahlen und Uhrzeiten in deutschem Format (`27.10.2026`, `13:41`, `78 %`).

---

## 6. Datenmodell (Vorschlag)

```ts
type Transportart = 'LIEGEND' | 'TRAGESTUHL' | 'ROLLSTUHL' | 'SITZEND';
type FahrtStatus  = 'GEPLANT' | 'ANFAHRT' | 'FAHRGAST_IM_AUTO' | 'AM_ZIEL' | 'ABGESCHLOSSEN' | 'STORNIERT';
type FahrzeugLive = 'FREI' | 'ANFAHRT' | 'FAHRGAST_IM_AUTO' | 'AM_ZIEL' | 'PAUSE' | 'AUSSER_DIENST';

interface Fahrzeug {
  id: string;
  kennzeichen: string;            // "LMW 106"
  typ: 'LIEGEWAGEN' | 'TRAGESTUHL' | 'ROLLSTUHL' | 'TAXI';
  erlaubteArten: Transportart[];  // z. B. BTW: ROLLSTUHL, SITZEND
  besatzung: Person[];            // 1–2 Fahrer, pro Tag aus Dienstplan
  live: { status: FahrzeugLive; seit: Date; position?: GeoPoint; verspaetungMin?: number };
}

interface Fahrt {
  id: string;
  patient: { vorname: string; nachname: string; telefon?: string };
  art: Transportart;
  richtung: 'HIN' | 'RUECK';
  abholung: Adresse; ziel: Adresse;        // inkl. Station/Etage
  start: Date; ende: Date;                 // geplante Zeiten
  fahrzeugId?: string;                     // leer = nicht zugewiesen
  status: FahrtStatus;
  verspaetungMin?: number;
  kostentraeger?: string;
  transportschein: 'LIEGT_VOR' | 'FEHLT' | 'OFFEN';
  hinweise?: string;
  kontakt?: { name: string; telefon: string };
  quelle: 'MANUELL' | 'KI_TELEFON' | 'SERIE';
  vorschlag?: { fahrzeugId: string; grund: string };   // "frei ab 15:00 · 2 km entfernt"
  serieId?: string;
}

interface Anruf {
  id: string; start: Date; status: 'LAEUFT' | 'BEENDET' | 'UEBERGEBEN';
  anruferNummer: string; anruferName?: string;
  transkript: { sprecher: 'ANRUFER' | 'KI'; text: string; zeit: Date }[];
  erkannt: Partial<Pick<Fahrt, 'patient' | 'art' | 'abholung' | 'ziel' | 'start' | 'richtung'>>;
  entwurfFahrtId?: string;   // Fahrt mit status GEPLANT + quelle KI_TELEFON, noch ohne feste Zuweisung
}
```

**Abgeleitet (nicht speichern):**
- Chip-Zustand: `ABGESCHLOSSEN/AM_ZIEL` → erledigt · `GEPLANT` → geplant · `ANFAHRT/FAHRGAST_IM_AUTO` → unterwegs · `verspaetungMin > 0` → verspätet · Anruf-Entwurf ohne feste Zuweisung → „aus Anruf“.
- Zusatztext der Fahrzeugspalte: aus der aktuellen bzw. nächsten Fahrt (Fahrgast + Zeit, Ankunft = Ende, „seit“ = live.seit).

---

## 7. Verhalten und Logik

1. **Live-Updates** (WebSocket oder Server-Sent Events): Fahrer-App-Status, KI-Anruf-Transkript, neue Fahrten. Keine Seiten-Neuladung. Die Jetzt-Linie läuft jede Minute weiter.
2. **Anruf-Ablauf:**
   1. Ein Anruf startet: Das Panel zeigt „Anruf läuft“ und das Transkript läuft mit.
   2. Die erkannten Felder füllen sich nach und nach.
   3. Sobald Art, Zeit, Abholung und Ziel feststehen, berechnet das System den **besten Wagen** und zeichnet den Entwurf **gestrichelt** in dessen Zeile ein. Die Zeile wird hinterlegt.
   4. **Auto zuweisen**: Der Entwurf wird zur festen Fahrt (Stil „geplant“), der Fahrer bekommt eine Push-Nachricht in der App, die Erfolgszeile mit „Rückgängig“ erscheint und der Zähler „Nicht zugewiesen“ sinkt.
   5. **Selbst übernehmen**: Der Anruf wird an den Disponenten weitergeleitet (oder der Entwurf geht in „Nicht zugewiesen“).
3. **Bester Wagen** (erste einfache Regel, später verfeinern):
   1. Das Fahrzeug darf die Art fahren (`erlaubteArten`).
   2. Es ist im Zeitfenster frei, inkl. Puffer (Standard 10 Min. vor und nach der Fahrt).
   3. Unter den passenden gewinnt die kürzeste Leerfahrt vom Ende der vorherigen Fahrt zur Abholung.
   4. Bei Gleichstand gewinnt das Fahrzeug mit weniger Fahrten heute.
   5. Der Vorschlag nennt seinen Grund als Text („frei ab 15:00 · 2 km entfernt“).
4. **Nicht zugewiesen → Auto zuweisen** nutzt dieselbe Regel.
5. **Konflikte:** Überschneiden sich zwei Fahrten in einer Zeile, bekommen beide Chips den Warnring und die Kennzahl „Nicht zugewiesen“ bzw. ein Hinweis meldet es.
6. **Detail-Fenster** lädt die Fahrt per ID. Alle Aktionen werden dort ausgelöst. „Stornieren“ und „Fahrzeug ändern“ fragen vorher nach.
7. **Später, nicht in V1:** Fahrten im Zeitstrahl per Ziehen verschieben (Drag & Drop zwischen Zeilen und Zeiten, mit Prüfung von `erlaubteArten`).

---

## 8. Akzeptanzkriterien (zum Abhaken)

- [ ] Die Seite zeigt alle Fahrzeuge des Tages mit Kennzeichen, Fahrer-Etikett rechts daneben und Live-Status darunter.
- [ ] Die Chips sind nach Transportart gefärbt (4 Farben aus 4.1). Auf den Chips steht **kein** Text zur Transportart.
- [ ] Die 5 Zustände sehen aus wie in 4.2. Die Legende unter dem Plan erklärt Farben und Zustände.
- [ ] Die Jetzt-Linie steht an der richtigen Stelle und wandert mit.
- [ ] Ein Klick auf einen Chip öffnet das Detail-Fenster mit allen Feldern aus 3.6. Esc, × und ein Klick auf den Hintergrund schließen es.
- [ ] Bei einem laufenden KI-Anruf erscheinen Transkript und erkannte Daten live. Der Vorschlag ist gestrichelt im Zeitstrahl zu sehen.
- [ ] „Auto zuweisen“ macht aus dem Vorschlag eine feste Fahrt, benachrichtigt den Fahrer und lässt sich mit „Rückgängig“ zurücknehmen.
- [ ] Die Kennzahlen stimmen mit den Daten überein.
- [ ] Unter 1000 px Breite rutscht das Seitenpanel unter den Zeitstrahl. Der Zeitstrahl scrollt waagerecht in seinem Kasten.
- [ ] Alles ist per Tastatur bedienbar und der Kontrast besteht AA.

---

## 9. Technik (Vorschlag, falls noch nicht festgelegt)

- Frontend: React + TypeScript (z. B. Next.js), Styling mit CSS-Variablen aus 4.4 (oder Tailwind mit diesen Tokens).
- Backend/DB: PostgreSQL (z. B. Supabase) mit Realtime für Fahrten, Fahrzeug-Livestatus und Anrufe.
- Fahrer-App und KI-Telefon schreiben in dieselbe Datenbank bzw. über eine API mit Events.
- Für die Entwicklung: Seed-Daten wie im Mockup (10 Fahrzeuge, ca. 45 Fahrten, 1 laufender Anruf, 2 nicht zugewiesene Fahrten) und ein **Simulator**, der Status-Wechsel und einen Testanruf abspielt.

---

## 10. Bewusst später (nicht Teil von V1)

- **Wochenansicht:** Fahrzeuge × Mo–So mit Fahrtenzahl und Auslastungsbalken, „Achtung diese Woche“, Serienfahrten (Dialyse Mo/Mi/Fr).
- **Große Suche (Strg+K):** Patienten, Fahrten, Anrufe zusammen. Freitext wie „morgen Liege frei“ liefert freie Zeitfenster.
- Drag & Drop im Zeitstrahl, Kartenansicht, Abrechnung, Serienfahrten-Verwaltung.

---

## 11. Start-Prompt für Claude Code (zum Kopieren)

> Lies `DISPO-SPEZ.md` vollständig und sieh dir `A1-Farbe-1-gedaempft.dc.html` als visuelle Referenz an. Das HTML ist ein Mockup in einem eigenen Format: Übernimm Aufbau, Farben, Abstände und Texte, aber nicht die Mockup-Technik (`<x-dc>`, `sc-for`, `support.js`).
>
> Baue die **Tagesansicht des Dispo-Dashboards (V1)** wie beschrieben:
> 1. Lege das Datenmodell aus Abschnitt 6 an und erstelle Seed-Daten wie im Mockup.
> 2. Baue die Oberfläche komponentenweise: Kopfzeile, Kennzahlen, Zeitstrahl mit Fahrzeugspalte und Chips, Legende, Anruf-Panel, Nicht zugewiesen, Detail-Fenster. Nutze die Design-Tokens aus 4.4 als CSS-Variablen.
> 3. Setze die Logik aus Abschnitt 7 um, inklusive „Auto zuweisen“ mit Rückgängig und der Regel für den besten Wagen.
> 4. Baue einen kleinen Simulator für Live-Status und einen Testanruf, damit man alles ohne echte Fahrer-App und ohne echtes KI-Telefon testen kann.
> 5. Prüfe am Ende jede Zeile der Akzeptanzkriterien aus Abschnitt 8 und sag mir, was erfüllt ist und was nicht.
>
> Frag mich, bevor du Technikentscheidungen triffst, die in Abschnitt 9 nicht festgelegt sind. Halte die Oberfläche auf Deutsch.

---

**Status in diesem Projekt (Stand 27.10.2026):** Die Farben/Schrift/Bausteine aus Abschnitt 4.4 sind jetzt Teil des projektweiten Designs (`docs/DESIGN-GUIDE.md`, eingebunden). Das eigentliche Dashboard-Konzept hier (Zeilen = Fahrzeuge, KI-Telefon-Anrufpanel, „Bester Wagen”-Logik, Modal-Detailfenster) ist **noch nicht umgesetzt** und hat ein eigenes Datenmodell (`Fahrt`, `Fahrzeug`, `Anruf`, Status `GEPLANT → ANFAHRT → ...`), das vom bestehenden Fahrdienst-KI-Datenmodell (`Ride`, `Vehicle`, `RideStatus` mit `ENTWURF → ERFASST → VORGESCHLAGEN → DISPONIERT → ...`) und von der gerade gebauten Fahrplan-Seite (Zeilen = Fahrer, Zeitstrahl ohne Anrufpanel) abweicht. Vor Umsetzung klären: eigene neue Seite, oder bestehende Dispo-/Fahrplan-Seite danach umbauen – und ob das bestehende Datenmodell (`Ride`/`RideStatus`) wiederverwendet wird statt ein zweites einzuführen.
