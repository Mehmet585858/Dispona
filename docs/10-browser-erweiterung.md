# 10 – Browser-Erweiterung „DMRZ-Übernahme“

> **Zurückgestellt (Entscheidung 26.10.2026):** Der Pilot läuft mit eigener Disposition und eigener Fahrer-App, DMRZ bleibt außen vor. Dieses Dokument bewahrt die Idee für später, falls Kunden weiter in DMRZ disponieren wollen. Claude Code baut nichts davon ohne ausdrücklichen Auftrag.

## Ziel

Die KI erfasst Fahrten am Telefon. Disponiert wird weiterhin in der **DMRZ-Fahrtenplanung**, die Fahrer nutzen die DMRZ-App. Die Erweiterung ist die Brücke und arbeitet in drei Bausteinen:

| Baustein | Was er tut |
| --- | --- |
| **A – Übernahme** | füllt das DMRZ-Formular „Neue Fahrt“ mit den Daten der KI |
| **B – Plan-Leser + Vorschlag** | liest den DMRZ-Tagesplan, berechnet das passende Fahrzeug und wählt es im Formular vor |
| **C – Automodus** | speichert eindeutige Fahrten selbst in DMRZ, z. B. nachts auf einem Büro-Rechner, der durchläuft |

### Ablauf mit Disponent (Standard, A + B)

1. Der Disponent hat in DMRZ die Tagesplanung offen; die Erweiterung liest sie (Baustein B).
2. Eine neue Fahrt von der KI erscheint im Seitenfenster – mit Fahrzeugvorschlag („AC-MK 204 · frei ab 9:20 · Anfahrt 9 Min · pünktlich“).
3. Klick **„In DMRZ übernehmen“** → Formular wird gefüllt, Fahrzeug vorausgewählt, fehlende Felder gelb.
4. Disponent prüft und **speichert**, dann „Übertragen ✓“.

### Ablauf ohne Disponent (Automodus, C)

1. Ein Rechner im Büro läuft durch, Chrome ist offen und in DMRZ angemeldet, die Erweiterung ist auf „Automodus“.
2. Neue Fahrt von der KI → Plan neu lesen → Vorschlag berechnen.
3. **Nur wenn alle Sicherheitsbedingungen erfüllt sind** (siehe unten): Formular füllen, Fahrzeug wählen, **speichern**, Erfolg prüfen, Status `UEBERTRAGEN` mit Vermerk „automatisch“.
4. Sonst bleibt die Fahrt liegen und erscheint morgens oben unter „Bitte prüfen“ mit Grund.

Ziel: aus 3–5 Minuten Abtippen werden etwa 20 Sekunden; nachts gehen keine Fahrten verloren.

## Harte Regeln

- **Keine DMRZ-Zugangsdaten** bei uns und in der Erweiterung: Sie arbeitet nur in der bereits angemeldeten Sitzung. Kein automatisches Einloggen.
- **Speichern nur im Automodus** und nur unter den Sicherheitsbedingungen. Löschen oder Stornieren in DMRZ macht die Erweiterung **nie** – das bleibt beim Menschen.
- **Der DMRZ-Tagesplan bleibt im Browser.** Die Vorschlagsberechnung läuft in der Erweiterung. An unseren Server gehen nur: Status „übertragen“, DMRZ-Fahrtnummer, gewähltes Fahrzeug (Kennzeichen) und technische Meldungen ohne Personendaten. An den Routing-Dienst gehen nur Koordinaten und Uhrzeiten, keine Namen.
- Läuft nur auf den DMRZ-Adressen, die beim Pilotkunden festgestellt werden (`host_permissions` so eng wie möglich), und auf unserer App-Adresse.
- **Automodus ist ausgeschaltet, bis der Inhaber ihn aktiviert** und dabei bestätigt, dass er DMRZ über den automatischen Betrieb informiert hat bzw. dessen Einverständnis vorliegt (`TenantSettings.autoModeConsentAt`, mit Name und Datum im AuditLog).

## Baustein B – Plan-Leser und Vorschlag

- Liest beim Öffnen und vor jeder Berechnung die DMRZ-Tagesplanung (Seite/Ansicht aus `docs/dmrz-formular/`): je Fahrzeug Kennzeichen, Ausstattung, Schicht/Verfügbarkeit, zugewiesene Fahrten mit Abholzeit, Zielort und (falls angezeigt) Endzeit; Live-Positionen, falls DMRZ sie anzeigt.
- Welche dieser Angaben DMRZ tatsächlich anzeigt, wird in Phase 3 festgestellt. Fehlt etwas (z. B. Ausstattung), wird es einmalig in unserer App je Fahrzeug hinterlegt (`Vehicle`), zugeordnet über das Kennzeichen.
- Lese-Zuordnung wie beim Formular als Konfiguration (`FieldMapping` mit `target: "DMRZ_TAGESPLAN"`), mit eigenem „Plan-Check“.
- Berechnung nach `docs/05-disposition.md` (harte Regeln, Einfügen in den Plan, Bewertung), als TypeScript-Modul, das in Web-App und Erweiterung gleich verwendet wird (`src/core/disposition/` → von der Erweiterung importiert).
- Ergebnis: bis zu 3 Vorschläge mit Begründung, bester vorausgewählt.

## Baustein C – Automodus

**Sicherheitsbedingungen – alle müssen erfüllt sein, sonst nicht speichern:**

1. Alle Pflichtfelder der Zuordnung gefunden und gefüllt, keine gelben Felder.
2. Fahrt hat keine Probleme (Adresse sicher, Fahrgast eindeutig, kein „Transportschein unklar“ bei genehmigungspflichtigen Fahrten nach Einstellung, keine Doppelbuchung).
3. Plan wurde vor höchstens 2 Minuten gelesen, Plan-Check grün.
4. Bester Vorschlag ist eindeutig: pünktlich und mindestens X Punkte besser als der zweitbeste (Einstellung, Standard 5).
5. Fahrt liegt im Zeitfenster des Automodus (Einstellung, z. B. 18:00–07:00 und Wochenende) und nicht weiter als N Tage in der Zukunft (Standard 3).
6. Nach dem Speichern erkennt die Erweiterung die Erfolgsmeldung von DMRZ (Text/Element aus Phase 3). Keine Erfolgsmeldung → Status `PROBLEM`, sofortige Meldung, kein zweiter Versuch (keine Doppelanlage).

**Wächter (damit nachts nichts unbemerkt liegen bleibt):**

- Die Erweiterung meldet sich jede Minute beim Server („Herzschlag“: läuft, DMRZ angemeldet ja/nein, Plan-Check ok).
- Kein Herzschlag seit 5 Minuten, DMRZ abgemeldet oder Plan-Check rot → SMS/E-Mail an die eingetragene Notfallnummer des Inhabers. Die KI nimmt trotzdem weiter Anrufe an; Fahrten sammeln sich für den Morgen.
- Läuft die DMRZ-Sitzung nachts ab, loggt sich die Erweiterung **nicht** selbst ein → Meldung. Wie lange eine DMRZ-Sitzung hält, wird in Phase 3 geklärt.
- Morgens: Übersicht „Heute Nacht“ – automatisch übertragen (n), liegen geblieben (n, mit Gründen).

**Technische Hinweise für den Automodus:**

- Herzschlag und Abfrage neuer Fahrten über `chrome.alarms` (der Hintergrund-Teil einer Manifest-V3-Erweiterung schläft sonst ein).
- Chrome bremst Zeitgeber in Hintergrund-Tabs stark. Der DMRZ-Tab wird deshalb als eigenes Fenster im Vordergrund gehalten; Verhalten bei Bildschirmsperre und über eine ganze Nacht im Pilot testen (Testplan unten).
- Neue Fahrten werden nacheinander verarbeitet (Warteschlange), nie zwei Formulare gleichzeitig.

**Empfehlung für den Büro-Rechner:** Energiesparen, Ruhezustand und automatische Updates nachts aus, eigenes Chrome-Profil nur für DMRZ und die Erweiterung, Rechner per Bildschirmsperre gesichert, USV optional.

## Technik

| Baustein | Wahl |
| --- | --- |
| Typ | Chrome-/Edge-Erweiterung, Manifest V3 |
| Ordner | `extension/` im selben Repository |
| Bau | Vite + TypeScript, eigenes `npm run build:extension` |
| Oberfläche | Seitenfenster (`chrome.sidePanel`), gleiche Gestaltung wie `docs/06-oberflaeche.md` |
| Anmeldung | Einmalige Kopplung: in unserer App unter Einstellungen „Browser koppeln“ → 6-stelliger Code → in der Erweiterung eingeben. Ergebnis: Gerätetoken (90 Tage, widerrufbar), gespeichert in `chrome.storage.local` |
| Daten | `GET /api/ext/rides?status=ERFASST`, `POST /api/ext/rides/:id/transferred`, `GET /api/ext/mapping` |
| Verteilung im Pilot | „Entpackt laden“ oder nicht gelistet im Chrome Web Store; später Richtlinien-Verteilung |

## Feld-Zuordnung (Mapping)

Das DMRZ-Formular kennen wir noch nicht. Deshalb steckt die Zuordnung **nicht fest im Code**, sondern in einer Konfiguration, die der Server pro Mandant liefert (versioniert):

```json
{
  "version": 1,
  "formMatch": { "urlContains": "<aus Pilot>", "headingText": "<aus Pilot>" },
  "fields": [
    { "key": "passenger.lastName",  "find": { "label": "Nachname" },  "type": "text" },
    { "key": "passenger.birthDate", "find": { "label": "Geburtsdatum" }, "type": "date", "format": "DD.MM.YYYY" },
    { "key": "pickupAt.date",       "find": { "label": "Datum" },     "type": "date", "format": "DD.MM.YYYY" },
    { "key": "pickupAt.time",       "find": { "label": "Abholzeit" }, "type": "time", "format": "HH:mm" },
    { "key": "transportType",       "find": { "label": "Beförderungsart" }, "type": "select",
      "values": { "SITZEND": "<Text in DMRZ>", "ROLLSTUHL": "<…>", "TRAGESTUHL": "<…>", "LIEGEND": "<…>" } }
  ]
}
```

- Felder bevorzugt **über die sichtbare Beschriftung** finden (robuster als technische Selektoren); technischer Selektor nur als Ersatz (`"selector"`).
- Werte so setzen, dass die DMRZ-Web-App sie erkennt: Wert setzen, dann `input`- und `change`-Ereignisse auslösen; Auswahllisten über den angezeigten Text wählen; Suchfelder (z. B. Fahrgast-Suche) tippen, auf Vorschläge warten, passenden Eintrag wählen – kein Treffer → Hinweis „Fahrgast in DMRZ neu anlegen“.
- **Formular-Check:** Knopf im Seitenfenster prüft, ob alle zugeordneten Felder gefunden werden. Fehlt etwas (z. B. weil DMRZ die Oberfläche geändert hat), klare Meldung an den Disponenten und automatische Meldung an uns (nur Feldname, keine Inhalte).

## Das DMRZ-Formular erfassen (Termin beim Pilotkunden)

Claude Code kann das DMRZ-Formular nicht selbst öffnen. Beim Pilotkunden einmalig sammeln, mit Testdaten statt echter Fahrgäste:

**Formular „Neue Fahrt“**

1. Screenshots: leer, ausgefüllt, jede Auswahlliste aufgeklappt, Fahrgast-Suche mit Vorschlägen, Fahrzeugauswahl, Serienfahrt-Bereich, **Erfolgsmeldung nach dem Speichern**.
2. Die Adresse (URL) der Seite.
3. Den HTML-Aufbau: Rechtsklick auf das Formular → „Untersuchen“ → Element des Formulars → „Kopieren → outerHTML“ → Textdatei `formular.html`. Vorher prüfen, dass keine echten Personendaten darin stehen.

**Tagesplanung (für den Plan-Leser)**

4. Screenshots der Tagesplanung mit mehreren Fahrzeugen und Fahrten, der Detailansicht einer Fahrt und – falls vorhanden – der Live-Karte.
5. Adresse und HTML-Aufbau der Tagesplanung (`tagesplan.html`), ebenfalls ohne echte Personendaten – am besten an einem Testtag oder mit geschwärzten Namen.
6. Fragen an den Disponenten: Wo sieht man, wann ein Fahrzeug frei wird? Wo steht die Ausstattung (Rollstuhl, Tragestuhl)? Hat die Fahrtenplanung einen Datei-Import?

**Sitzung und Rechner**

7. Wie lange bleibt man in DMRZ angemeldet, wenn der Rechner durchläuft? (Einmal über Nacht testen.)
8. Welcher Rechner kann nachts laufen (Windows/Mac, Chrome oder Edge)?

Ablage in `docs/dmrz-formular/` (Screenshots, `url.txt`, `formular.html`, `tagesplan.html`, `notizen.md`).

Daraus baut Claude Code die Zuordnungen und **Nachbildungen** von Formular und Tagesplan (`extension/test/fake-dmrz-formular.html`, `extension/test/fake-dmrz-tagesplan.html`) für automatische Tests.

## Tests

- Playwright lädt die Erweiterung gegen die Nachbildungen:
  - Übernahme: alle Felder korrekt, Pflichtfeld fehlt → gelb; im Standardmodus wird Speichern **nie** geklickt.
  - Plan-Leser: liest alle Fahrzeuge und Fahrten der Nachbildung korrekt.
  - Automodus: speichert nur, wenn alle Sicherheitsbedingungen erfüllt sind; jede einzelne verletzte Bedingung (je ein Test) → kein Speichern, Fahrt „Bitte prüfen“; fehlende Erfolgsmeldung → `PROBLEM`, kein zweiter Versuch; Automodus ohne Freigabe nicht aktivierbar.
- Einheitentests für Datum-/Zeitformate, Beförderungsart-Zuordnung, Formular- und Plan-Check, Disposition (`docs/05-disposition.md`).
- Abnahme beim Pilotkunden: (1) 10 Testfahrten mit Disponent, (2) eine Testnacht im Automodus mit Testfahrten und anschließendem Abgleich, erst danach echter Nachtbetrieb.

## Kennzahlen

Pro übertragener Fahrt speichern: Zeit von „Übernehmen“ bis „Übertragen ✓“ und Anzahl der Felder, die der Disponent nachträglich ändern musste (meldet er per Knopf „Musste korrigieren: …“). Daraus entstehen die Zahlen für das Gespräch mit DMRZ.
