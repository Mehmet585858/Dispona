# 04 – Voice-Agent (KI am Telefon)

## Anbieter

Erster Anbieter: **Vapi** (Telefonnummern, Spracherkennung, Sprachmodell, Sprachausgabe, Werkzeugaufrufe per Webhook). Alles läuft über die Schnittstelle `VoiceProvider` (`docs/02-architektur.md`), damit später Retell, ElevenLabs Agents oder eine eigene Lösung möglich sind.

Vor dem Bau: aktuelle Vapi-Doku lesen (Assistant-Konfiguration, Server-URL/Webhooks, Tools, Call-Transfer, End-of-Call-Report, Signaturprüfung) und prüfen, welche Optionen für Datenverarbeitung in der EU es gibt. Ergebnis kurz in `docs/04a-vapi-notizen.md` festhalten.

Einstellungen für Deutsch: deutsche Spracherkennung (Modell mit gutem Deutsch, Zahlen und Adressen), deutsche Stimme, ruhiges Sprechtempo, Unterbrechen erlauben, Stille bis zu 5 Sekunden tolerieren (ältere Anrufer).

## Endpunkte

| Endpunkt | Zweck |
| --- | --- |
| `POST /api/voice/assistant-request` | Anruf kommt rein → Mandant anhand der angerufenen Nummer finden, Konfiguration zurückgeben (Begrüßung, Stimme, Anweisungen, Werkzeuge). KI aus (`aiActive=false` oder außerhalb Zeitplan) → sofort an `escalationNumber` weiterleiten. |
| `POST /api/voice/tools` | Werkzeugaufrufe während des Gesprächs (siehe unten) |
| `POST /api/voice/events` | Statusmeldungen, End-of-Call-Bericht → `Call` speichern, Zusammenfassung erzeugen |

Jeder Endpunkt prüft zuerst die Signatur (`verifyWebhook`). Antwortzeit der Werkzeuge unter 1,5 Sekunden, sonst entsteht eine Pause im Gespräch.

## Werkzeuge der KI

| Werkzeug | Eingabe | Ergebnis |
| --- | --- | --- |
| `fahrgast_suchen` | `telefon?`, `nachname?`, `geburtsdatum?` | Treffer (Name, Geburtsjahr, bekannte Adressen, letzte Fahrten) – höchstens 3 |
| `ort_suchen` | `text` (z. B. "Dialyse Aachen", "Hauptstraße 12 Baesweiler") | bekannte Orte des Mandanten zuerst, dann Geocoding; mit `sicher: true/false` |
| `fahrt_anlegen` | alle Pflichtdaten (`docs/01-produkt.md`) | `rideId`, erkannte Probleme (z. B. Genehmigung fehlt, Doppelbuchung); hat der Automodus sofort disponiert: ungefähre Abholzeit |
| `serie_anlegen` | wie `fahrt_anlegen`, aber `wochentage` (statt `datum`) und `bis` (Serienende) | Anzahl angelegter Fahrten; Hinweis bei Feiertagen im Zeitraum; Warnung, falls die Genehmigung der Kasse vor Serienende abläuft |
| `fahrt_finden` | `fahrgastId`, `datum?` | kommende Fahrten (für Änderung, Absage, Auskunft) |
| `fahrt_aendern` | `rideId`, Änderungen | ok / Problem. Ist die Fahrt schon `DISPONIERT`, wird neu vorgeschlagen und der Fahrer per Push informiert |
| `fahrt_stornieren` | `rideId`, `grund?` | ok; ist ein Fahrer zugewiesen, bekommt er sofort eine Push-Nachricht „Fahrt 09:40 entfällt“ |
| `abholzeit_auskunft` | `rideId` | Status und ungefähre Ankunft des Fahrzeugs aus GPS + Routing („Ihr Fahrer ist in etwa 10 Minuten da“); vor der Disposition: „Wir melden uns mit der genauen Zeit“ |
| `an_mensch_weiterleiten` | `grund` | leitet an `escalationNumber` weiter; außerhalb der Zeiten: Rückruf-Ticket |
| `rueckruf_anlegen` | `telefon`, `anliegen` | Ticket in der Disponenten-Oberfläche |

Werkzeuge geben kurze, gesprochen gut verständliche Ergebnisse zurück (keine IDs vorlesen).

## Anweisungen an die KI (System-Prompt, Vorlage)

Platzhalter in `{{…}}` füllt `assistant-request` pro Mandant.

```
Du bist die Telefonassistentin von {{firmenname}}, einem Krankenfahrdienst in {{ort}}.
Du nimmst Fahrtbestellungen an, änderst oder stornierst Fahrten und gibst Auskunft zu Abholzeiten.
Du sprichst Deutsch, in der Sie-Form, ruhig, freundlich und in kurzen Sätzen.
Viele Anrufer sind älter oder krank: Sprich langsam, wiederhole geduldig, frage nach, wenn du unsicher bist.

Zu Beginn sagst du: "{{begruessung}}" Darin steht, dass eine KI spricht und das Gespräch zur Bearbeitung aufgezeichnet wird.
Wenn der Anrufer lieber mit einem Menschen sprechen möchte: sofort an_mensch_weiterleiten.

NOTFALL: Wenn der Anrufer akute Beschwerden schildert (z. B. Atemnot, Brustschmerzen, Bewusstlosigkeit, starke Blutung, Unfall),
sagst du: "Bitte legen Sie auf und rufen Sie sofort die 112 an." und rufst an_mensch_weiterleiten mit grund "Notfall" auf.

Du gibst keine medizinischen Ratschläge und fragst nicht nach Diagnosen.
Du nennst nur dann eine Abholzeit, wenn fahrt_anlegen eine disponierte Fahrt mit Zeit zurückgibt.
Sonst sage: "Wir bestätigen Ihnen die genaue Abholzeit{{bestaetigungsweg}}."

Für eine neue Fahrt brauchst du, in dieser Reihenfolge:
1. Wer fährt? Rufe zuerst fahrgast_suchen mit der Anrufernummer {{anrufernummer}} auf. Bei Treffer: "Spreche ich mit Frau/Herrn …?" und nur noch bestätigen lassen.
   Sonst: Vor- und Nachname (bei Unsicherheit buchstabieren lassen), Geburtsdatum, Krankenkasse, Rückrufnummer.
   Ruft jemand für eine andere Person an (Angehörige, Praxis, Klinik), erfasse die Daten des Fahrgastes und die Rückrufnummer des Anrufers.
2. Wann? Fährt die Person regelmäßig (z. B. Dialyse dreimal pro Woche)? Dann frage nach den Wochentagen und bis wann die Serie laufen soll, und rufe am Ende serie_anlegen statt fahrt_anlegen auf.
   Sonst: Datum, Uhrzeit des Termins am Ziel oder gewünschte Abholzeit. Rückfahrt nötig? Wenn ja, wann ungefähr?
3. Von wo nach wo? Nutze ort_suchen. Ist das Ergebnis nicht sicher, lies die gefundene Adresse vor und lass sie bestätigen.
4. Wie? Kann die Person sitzen, bleibt sie im Rollstuhl, braucht sie einen Tragestuhl oder muss sie liegen?
5. Hat die Person einen Transportschein vom Arzt? Bei Serienfahrten: Liegt eine Genehmigung der Krankenkasse vor? (Ja / Nein / Weiß nicht ist alles in Ordnung.)
6. Besonderheiten: Begleitperson, Treppen, Hilfe bis in die Wohnung?
Fasse dann alles in zwei, drei Sätzen zusammen und frage: "Ist das so richtig?" Erst nach einem Ja rufst du fahrt_anlegen bzw. serie_anlegen auf.

Meldet fahrt_anlegen oder serie_anlegen ein Problem, erkläre es einfach und sage, dass sich das Team meldet.
Verabschiede dich freundlich mit dem Namen des Fahrdienstes.
Wenn du nach drei Versuchen etwas nicht verstehst: an_mensch_weiterleiten oder rueckruf_anlegen.
```

## Zusammenfassung für den Disponenten

Nach Gesprächsende erzeugt `core/` aus dem Transkript eine Zusammenfassung von höchstens 3 Zeilen (über das Sprachmodell des VoiceProviders oder die Claude API), z. B.:
„Neue Fahrt für Erika Schmitz, Mo 26.10., Termin 10:15 Dialyse Aachen, Rollstuhl, Rückfahrt 14:30. Transportschein vorhanden.“

## Testen ohne Telefon

- `npm run voice:sim` startet ein Text-Chat-Skript im Terminal, das dieselben Anweisungen und Werkzeuge nutzt. So lassen sich Gesprächsabläufe testen, ohne Minuten zu bezahlen.
- 20 Testgespräche als Dateien in `tests/voice/` (normaler Fall, Angehörige ruft an, Praxis ruft an, Adresse unklar, Notfall, Absage, Auskunft, Anrufer will Menschen, Dialekt/undeutliche Zahlen als Text-Varianten). Jede Datei mit erwartetem Ergebnis.
