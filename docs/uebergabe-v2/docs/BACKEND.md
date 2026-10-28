# Dispona – Was im Hintergrund laufen muss

Version 1 · 28.10.2026 · gehört zu `DISPO-SPEZ.md`

Dieses Dokument beschreibt alles, was der Kunde **nicht** sieht, ohne das Dispona aber nicht funktioniert: Telefonie, Sprach-KI, automatische Einplanung, Fahrer-App, Echtzeit, Abrechnung, Hintergrund-Jobs, Sicherheit und Betrieb.
Konkrete Anbieter sind **Vorschläge**. Claude Code soll die Auswahl vor dem Bau mit Mehmet abstimmen (Abschnitt 14).

---

## 1. Gesamtbild

```
 Anrufer (Klinik, Heim, Angehörige)
        │  ruft die gewohnte Nummer des Fahrdienstes an
        ▼
 Telefonanlage/Anbieter des Fahrdienstes ── Rufumleitung ──►  Dispona-Rufnummer (Telefonie-Anbieter, SIP)
                                                                    │  Audio-Stream, je Anruf eigener Kanal
                                                                    ▼
                                                     ┌──────── Sprach-Agent ────────┐
                                                     │ Spracherkennung → KI-Modell → Sprachausgabe │
                                                     │ Werkzeuge: Patient suchen, Fahrt anlegen,   │
                                                     │ Verfügbarkeit prüfen, an Menschen weiterleiten │
                                                     └──────────────┬───────────────┘
                                                                    │ Ereignisse (Transkript, erkannte Felder)
                                                                    ▼
   Fahrer-App  ◄── Push/Echtzeit ──  API + Datenbank (Mandanten getrennt)  ── Echtzeit ──►  Dashboard (Kunden-Login)
   (Status, GPS) ──────────────────►        │                     ▲
                                             ▼                     │
                                    Auto-Dispo-Dienst      Hintergrund-Jobs (Serien, Verspätung,
                                    (nächstbester Wagen)   Abrechnung, Löschfristen, Backups)
                                             │
                                             ▼
                                    Routen-/Fahrzeit-Dienst, Geocoding
```

---

## 2. Telefonie

**Ziel:** Der Fahrdienst behält seine Nummer. Anrufe kommen über eine **Rufumleitung** bei Dispona an.

- Pro Mandant mindestens **eine Dispona-Rufnummer** (deutsche Ortsnetz-Nummer), eingekauft beim Telefonie-Anbieter. Der Fahrdienst richtet bei seinem Anbieter die Umleitung darauf ein. Die Einrichtung (249 €) beinhaltet die Hilfe dabei.
- **Umleitungs-Modi** (Einstellung pro Mandant): immer · nur außerhalb der Bürozeiten · bei besetzt · bei Nichtannahme nach X Sekunden.
- **Parallele Anrufe:** Jeder Anruf ist ein eigener Kanal mit eigener Agent-Sitzung. Die Kanal-Obergrenze pro Nummer beim Anbieter hoch genug einstellen (z. B. 5–10). Bei Überlauf erst Warteschleife mit Ansage, dann Weiterleitung an die Notfallnummer des Fahrdienstes.
- **Anruferkennung:** Die Nummer des Anrufers wird mitgeliefert und für die Patientensuche genutzt („Pflegeheim St. Anna ruft an“).
- **Weiterleitung an einen Menschen:** Auf Wunsch des Anrufers, bei Notfällen oder wenn Dispona nicht weiterkommt, wird live an die hinterlegte Nummer übergeben. Dort kommt eine Kurz-Zusammenfassung an (Ansage oder SMS).
- **Notfall-Rückfall:** Ist der Sprach-Agent nicht erreichbar, leitet die Telefonie **automatisch** an die Fahrdienst-Nummer weiter. Kein Anruf darf ins Leere laufen.
- **Kein Rettungsdienst:** Erkennt Dispona einen Notfall („bewusstlos“, „Atemnot“), sagt es sofort „Bitte wählen Sie die 112“ und leitet zusätzlich an einen Menschen weiter.

Vorschlag: Twilio, Telnyx, Vonage oder sipgate (Trunking). Auswahlkriterien: deutsche Nummern, SIP/Media-Streaming, parallele Kanäle, Rechenzentrum in der EU, AV-Vertrag.

---

## 3. Sprach-Agent (Dispona am Telefon)

**Bausteine:** Spracherkennung (Speech-to-Text, deutsch, live) → Sprachmodell (führt das Gespräch, ruft Werkzeuge auf) → Sprachausgabe (natürliche deutsche Stimme).
Entweder eine fertige Voice-Agent-Plattform (z. B. Vapi, Retell, ElevenLabs Agents) oder eine eigene Kette (z. B. Deepgram/Azure STT + Claude/OpenAI + ElevenLabs/Azure TTS). Für den Pilot ist eine Plattform schneller. Prüfen, ob EU-Verarbeitung und ein AV-Vertrag möglich sind.

**Qualitätsziele:** Antwort innerhalb von **unter 1 Sekunde** nach Sprechpausen. Der Anrufer darf unterbrechen. Funktioniert auch mit Hintergrundgeräuschen auf Station.

**Gesprächsablauf (Leitfaden):**
1. **Begrüßung mit Offenlegung** (Pflicht): „Fahrdienst Müller, Sie sprechen mit Dispona, der digitalen Assistentin. Das Gespräch wird zur Bearbeitung Ihrer Fahrt verarbeitet. Wie kann ich helfen?“ Den Text stellt der Mandant ein, die Offenlegung bleibt immer drin.
2. Anliegen erkennen: neue Fahrt · Fahrt ändern/absagen · Auskunft („Wann kommt der Wagen?“) · sonstiges → Mensch.
3. **Pflichtfelder** erfragen, bis vollständig: Patient (Name, ggf. Geburtsdatum zur Unterscheidung) · Transportart · Abholadresse inkl. Station/Etage · Ziel · Datum/Uhrzeit · Hin-/Rückfahrt (Rückfahrt gleich mit anlegen?) · Rückrufnummer. Optional: Kostenträger, Transportschein vorhanden, Hinweise (Sauerstoff, Begleitperson).
4. **Zusammenfassen und bestätigen lassen** („Ich fasse zusammen: …. Stimmt das?“).
5. Werkzeug `fahrt_anlegen` → in **Pro** sofort Auto-Dispo (Abschnitt 4).
   - Zusage am Telefon **nur**, wenn eingeplant: „Ihre Fahrt ist bestätigt, Abholung 15:10.“
   - Sonst: „Wir melden uns zur Bestätigung.“
6. Verabschiedung.

**Werkzeuge (Function Calls) des Agents:**
- `patient_suchen(telefon, name)`
- `adresse_pruefen(text)` (Geocoding)
- `verfuegbarkeit_pruefen(art, zeit, abholung)` (Pro)
- `fahrt_anlegen(daten)`
- `fahrt_finden(patient, datum)`
- `fahrt_aendern / fahrt_stornieren`
- `status_abfragen(fahrtId)` (Pro, z. B. „Wagen ist 5 Min. entfernt“)
- `an_mensch_uebergeben(grund)`

**Live ins Dashboard:** Transkript-Schnipsel und erkannte Felder werden während des Gesprächs als Ereignisse gesendet (Abschnitt 6).

**Grenzen:** maximale Gesprächsdauer (z. B. 8 Min.), danach Übergabe. Keine medizinische Beratung. Keine Zusagen zu Kostenübernahmen.

---

## 4. Auto-Dispo-Dienst (nur Pro)

Wird ausgelöst bei: neuer Fahrt (Telefon, Formular, manuell, Serie) · Rückgängig/Umplanen · Verspätung, die Folgefahrten gefährdet · Fahrzeug fällt aus.

Ablauf (Regeln in `DISPO-SPEZ.md` Abschnitt 6):
1. Kandidaten filtern: Transportart erlaubt, Schicht aktiv, Fahrzeug aktiv.
2. Für jeden Kandidaten die **Leerfahrt-Zeit** berechnen: letzte Zieladresse bzw. GPS-Position → Abholung (Routen-Dienst, Abschnitt 5).
3. Zeitfenster prüfen, inkl. Puffer und Ladezeit (Liegend länger als Sitzend, Werte einstellbar).
4. Bester Kandidat: kürzeste Leerfahrt, bei Gleichstand weniger Fahrten heute.
5. **Reservieren in einer Datenbank-Transaktion** mit Sperre auf das Fahrzeug-Zeitfenster. Wichtig, weil mehrere Anrufe gleichzeitig dasselbe Fahrzeug wollen können. Doppelbuchungen dürfen nicht entstehen.
6. Fahrt speichern (`eingeplantVon: 'DISPONA'`, `einplanGrund`), Audit-Eintrag, Push an den Fahrer, Ereignis ans Dashboard.
7. Kein Kandidat: Die Fahrt kommt nach „Braucht Sie“ mit `brauchtSieGrund`, und die Disponenten werden benachrichtigt.

**Einstellungen pro Mandant:** Auto-Einplanung an/aus, Puffer, Ladezeiten je Transportart, Fälle, die immer ein Mensch prüft (z. B. Fahrten > 50 km, Fahrten in < 30 Min.).

---

## 5. Adressen, Routen, Fahrzeiten

- **Geocoding** (Adresse → Koordinaten) mit Plausibilitätsprüfung. Bekannte Orte (Kliniken, Heime, Praxen) als Favoriten je Mandant speichern, damit „Uniklinik, Station 3B“ sofort passt.
- **Fahrzeiten/Distanz** über einen Routen-Dienst (z. B. Google Routes/Distance Matrix, HERE, oder selbst gehostetes OSRM/Valhalla mit OSM-Daten, das spart laufende Kosten und hält Daten im Haus).
- Ergebnisse zwischenspeichern (Cache), um Kosten zu sparen.
- **km für das Fahrtenbuch:** aus der Fahrer-App (GPS-Strecke) oder ersatzweise aus der Routenberechnung.

---

## 6. Echtzeit

- Dashboard und Fahrer-App hängen per **WebSocket** (oder Supabase Realtime) am Server.
- Ereignisse: `anruf.gestartet / .transkript / .felder / .beendet` · `fahrt.angelegt / .eingeplant / .geaendert / .storniert` · `fahrzeug.status / .position` · `braucht_sie.neu`.
- Ziel: Ein Status aus der Fahrer-App ist in **unter 5 Sekunden** im Dashboard.
- Jede Verbindung ist auf den eigenen Mandanten beschränkt.

---

## 7. Fahrer-App (nur Pro)

- Am schnellsten als **PWA** (installierbare Web-App), später nativ (React Native/Expo), falls Hintergrund-GPS auf dem iPhone das erfordert.
- Login mit Fahrer-Konto, Auswahl von Fahrzeug und Schicht.
- **Liste „Meine Fahrten heute“**, neue Fahrten per **Push** (Firebase Cloud Messaging bzw. Web Push) mit Ton.
- Großer Statusknopf in Reihenfolge: **Fahre los → Fahrgast im Auto → Am Ziel** (setzt die Zeitstempel, die das Dashboard live zeigt).
- „Navigation starten“ (öffnet Google/Apple Maps), Anruf beim Kontakt, Hinweise.
- **Standort** alle 30–60 Sekunden, nur während der Schicht und mit Einwilligung des Fahrers.
- **Offline-Warteschlange:** Statusklicks ohne Netz werden gespeichert und nachgesendet.
- Verspätungserkennung: Schafft der Wagen die Abholung voraussichtlich nicht, wird er im Dashboard orange.

---

## 8. Abrechnung (Anrufe zählen, Rechnungen)

- **Jeder Anruf** wird mit Dauer und Ergebnis gespeichert. Ob er `abrechenbar` ist, entscheidet eine **Regel** (noch festzulegen, Vorschlag):
  - abrechenbar: von Dispona angenommen und Dauer ≥ 10 Sekunden
  - nicht abrechenbar: sofort aufgelegt, Spam, interne Testanrufe, Anrufe während eines Ausfalls
- **Monatslauf** (1. des Monats): Anzahl abrechenbarer Anrufe × Paketpreis (1,95 €/2,49 €), zzgl. MwSt.
  - Paketwechsel im Monat: tagesgenau mit dem jeweils gültigen Preis.
  - Einzelnachweis (Datum, Uhrzeit, Dauer, Ergebnis, Nummer maskiert) als Anhang.
- **Einrichtungsgebühr** 249 € einmalig bei Freischaltung.
- Zahlungsabwicklung z. B. über **Stripe** (nutzungsbasierte Abrechnung, SEPA-Lastschrift) oder eine deutsche Rechnungssoftware mit API (z. B. lexoffice, sevDesk).
- **Kostenkontrolle für dich:** Pro Anruf die eigenen Kosten mitschreiben (Telefonie-Minuten, Sprach-KI, Routen-Aufrufe). Ein Admin-Bericht zeigt die **Marge je Anruf und Mandant**. Warnung, wenn ein Anruf mehr kostet als er einbringt.

---

## 9. Hintergrund-Jobs (zeitgesteuert)

| Job | Wann | Was |
|---|---|---|
| Serienfahrten erzeugen | täglich nachts | Fahrten aus Serien für die nächsten 14 Tage anlegen. In Pro sofort Auto-Dispo. |
| Verspätung prüfen | jede Minute | Voraussichtliche Ankunft gegen Plan. Bei Verzug Fahrzeug orange, gefährdete Folgefahrten neu prüfen. |
| „neu“-Etikett entfernen | jede Minute | Etikett nach 10 Min. löschen. |
| Fahrzeug ohne Lebenszeichen | alle 5 Min. | Kein GPS/Status seit 15 Min. in der Schicht → Hinweis im Dashboard. |
| Monatsabrechnung | 1. des Monats | Rechnungen und Einzelnachweise erzeugen und versenden. |
| Fahrtenbuch vorbereiten | 1. des Monats | Vormonat als Datei bereitlegen (Pro). |
| Löschfristen | täglich | Audioaufnahmen und Transkripte nach Frist löschen (Vorschlag: Audio 30 Tage, Transkript 90 Tage, Fahrten nach gesetzlicher Aufbewahrungsfrist). |
| Backups | täglich + laufend | Verschlüsselte Datenbank-Sicherung, Wiederherstellung monatlich testen. |
| Gesundheitscheck | jede Minute | Telefonie, Agent, API, Datenbank prüfen. Bei Fehler Alarm an dich und Rückfall-Umleitung aktivieren. |

---

## 10. Kunden-Login, Rollen, Admin

- **Kunden-Login** unter z. B. `app.dispona.de`, E-Mail + Passwort, **Zwei-Faktor** für Inhaber.
- Rollen: **Inhaber** (alles, Abrechnung, Einstellungen, Nutzer) · **Disponent** (Dashboard, Fahrten) · **Fahrer** (nur Fahrer-App, nur eigene Fahrten).
- Einladungen per E-Mail. Passwort vergessen. Sitzungen auf allen Geräten abmelden.
- **Mandantentrennung** in der Datenbank erzwingen (Row-Level-Security), nicht nur im Code.
- **Einstellungen für den Kunden:** Begrüßungstext, Bürozeiten und Umleitungs-Modus, Weiterleitungsnummer, Fahrzeuge, Fahrer und Schichten, Transportarten pro Fahrzeug, Puffer und Ladezeiten, favorisierte Adressen, Paket ansehen und wechseln, Rechnungen.
- **Admin-Bereich für dich (Dispona-Betreiber):**
  - Mandanten anlegen, Paket setzen, Nummern zuordnen
  - Nutzung und Marge je Mandant
  - Anrufe stichprobenartig anhören bzw. lesen (Qualität, nur mit vertraglicher Grundlage)
  - Störungen und Status

---

## 11. Buchungsformular für Kunden-Webseiten (Pro)

- Kleines Einbettungs-Skript bzw. iframe pro Mandant (`<script src="https://app.dispona.de/widget.js" data-mandant="…">`).
- Felder wie am Telefon, Einwilligungs-Häkchen, Spam-Schutz (z. B. Cloudflare Turnstile), Begrenzung pro IP.
- Eine Buchung erzeugt eine Fahrt mit `quelle: 'WEBFORMULAR'`. In Pro folgt die Auto-Dispo, die Bestätigung per E-Mail an den Buchenden.

---

## 12. Datenschutz und Sicherheit (Gesundheitsdaten!)

Krankenfahrten sind **Gesundheitsdaten nach Art. 9 DSGVO**. Das ist kein Rechtsrat. Diese Punkte sollte ein Datenschutzberater bzw. Anwalt vor dem Start prüfen:
- **Hosting und alle Unterauftragnehmer in der EU**, am besten in Deutschland. Eine Liste aller Dienste (Telefonie, Sprach-KI, Hosting, Routen, Push, E-Mail) mit AV-Verträgen führen.
- **AV-Vertrag** mit jedem Fahrdienst (Dispona verarbeitet im Auftrag).
- **Datenschutz-Folgenabschätzung (DSFA)**, wahrscheinlich nötig wegen Gesundheitsdaten und KI.
- **Transparenz am Telefon** (KI-Offenlegung und Hinweis auf Verarbeitung/Aufzeichnung) nach EU-KI-Verordnung und DSGVO.
- Verschlüsselung bei Übertragung (TLS) und Speicherung. Aufnahmen getrennt und verschlüsselt ablegen.
- **Keine Gesundheitsdaten in Logs, Fehlerberichten oder Analyse-Tools.**
- Minimale Rechte, Audit-Log, wer was angesehen oder geändert hat.
- Löschkonzept (Abschnitt 9) und Auskunfts- und Löschanfragen bedienen können.
- Daten an KI-Anbieter nur mit vertraglicher Zusicherung, dass sie **nicht zum Training** genutzt werden.

---

## 13. Betrieb und Ausfallsicherheit

- Drei Umgebungen: **Entwicklung · Test (Staging) · Produktion**, jeweils mit eigener Telefonnummer.
- **Simulator:** spielt Testanrufe (Text oder Audio), Fahrer-Status und Verspätungen ab. Damit lässt sich ohne echte Anrufe entwickeln und vorführen.
- Fehler-Monitoring (z. B. Sentry, EU-Region) und Uptime-Alarm per SMS an dich.
- Statusseite für Kunden (optional).
- **Grundsatz:** Fällt etwas aus, gehen Anrufe **immer** an einen Menschen beim Fahrdienst durch.

---

## 14. Vor dem Bau mit Mehmet entscheiden

1. Telefonie-Anbieter und Sprach-Agent (Plattform oder eigene Kette). **Kosten pro Gesprächsminute** gegen 1,95 €/2,49 € pro Anruf rechnen.
2. Hosting/Backend (z. B. Supabase in der EU-Region, oder eigener Server bei einem deutschen Hoster mit PostgreSQL).
3. Routen-Dienst (Google vs. selbst gehostet).
4. Fahrer-App: zuerst PWA oder direkt nativ?
5. Regel, welche Anrufe abrechenbar sind (Abschnitt 8).
6. Löschfristen für Aufnahmen und Transkripte.
7. Fahrtenbuch-Format und Spalten.

---

## 15. Empfohlene Reihenfolge (Meilensteine)

1. **Grundgerüst:** Login, Mandanten, Rollen, Fahrzeuge, Fahrer, Patienten, Fahrten (manuell), Dashboard mit Seed-Daten und Simulator.
2. **Telefon:** Nummer, Rufumleitung, Sprach-Agent mit Leitfaden, Live-Transkript im Dashboard, parallele Anrufe, Weiterleitung, Notfall-Rückfall. → **Damit ist Lite fertig.**
3. **Auto-Dispo:** Routen-Dienst, Regeln, Reservierung mit Sperre, „Braucht Sie“, Umplanen/Rückgängig.
4. **Fahrer-App:** Push, Status, GPS, Offline. → **Damit ist Pro fertig.**
5. **Abrechnung:** Anrufzählung, Monatslauf, Einzelnachweis, Admin-Margenbericht.
6. **Fahrtenbuch-Export**, Serienfahrten, Buchungsformular.
7. **Härtung:** Datenschutz-Check, Löschjobs, Backups mit Wiederherstellungstest, Monitoring, Lasttest mit 10 gleichzeitigen Anrufen.
