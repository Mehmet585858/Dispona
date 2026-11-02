# 05 – Disposition (Fahrzeugwahl)

Die Disposition ist das Herzstück: Sie läuft komplett in unserer Software, auf Basis unserer eigenen Fahrzeuge, Schichten, Fahrten und der GPS-Positionen aus der Fahrer-App.

Ziel: Für jede neue Fahrt in unter 10 Sekunden bis zu 3 passende Fahrzeuge vorschlagen, das beste zuerst, mit einer Begründung in einfachen Worten.

Code: `src/core/disposition/`. Reine Funktionen, keine Datenbankzugriffe in der Rechenlogik (Daten werden vorher geladen und übergeben) → gut testbar.

## Schritt 1: Passt das Fahrzeug? (harte Regeln)

Ein Fahrzeug ist Kandidat, wenn alles stimmt:

| Beförderungsart | Bedingung am Fahrzeug |
| --- | --- |
| SITZEND | `seats ≥ 1 + Begleitperson` |
| ROLLSTUHL | `wheelchairSpots ≥ 1` und `seats ≥ Begleitperson` |
| TRAGESTUHL | `carryChair = true` **oder** `wheelchairSpots ≥ 1` (BTW; mit Treppe siehe „Besatzung“) |
| LIEGEND | `stretcher = true` (und 2 Personen, siehe „Besatzung“) |

Zusätzlich: Fahrzeug `active`, es gibt eine `Shift` zur Abholzeit, nicht `onBreak` zur Abholzeit, und die **Besatzung** dieser Schicht passt zur Fahrt (nächster Abschnitt).

## Besatzung (Schichtplan, freigegeben am 02.11.2026)

Eine **Schicht** = Fahrzeug + Beginn + Ende (freie Uhrzeiten; Ende vor Beginn = Nachtschicht bis zum Folgetag, M-18) + **Fahrer** (Pflicht) + **Beifahrer** (optional, bei jedem Fahrzeug möglich) + **„Scalamobil an Bord“** (ja/nein). Der Beifahrer ist etwas anderes als `Ride.companion` (Begleitperson des Fahrgasts).

- **Aushilfen** gehören zum Personal (`Driver.istAushilfe`). Sie können Fahrer oder Beifahrer sein und melden sich wie Fahrer per Einmal-Link an.
- **Scalamobil** = elektrischer Treppensteiger. Damit schafft eine Person einen Fahrgast allein über die Treppe. Es braucht eine **Einweisung** (`Driver.scalamobilEinweisung`). Das Gerät wird zwischen Fahrzeugen getauscht, deshalb ist es eine Angabe **pro Schicht** (`Shift.scalamobil`). Der Betrieb hat N Scalamobile (`TenantSettings.scalamobilAnzahl`); zur selben Zeit haben höchstens N Schichten „Scalamobil an Bord“. Ein Scalamobil passt nur in ein Fahrzeug mit Tragestuhl oder Rollstuhlplatz.
- **Treppe** ist eine Angabe am Ort (`Place.treppe`). Eine Fahrt „hat eine Treppe“, wenn Abhol- **oder** Zielort sie hat.

| Fahrt | Besatzung |
| --- | --- |
| LIEGEND | immer 2 Personen: Fahrer + **aktiver** Beifahrer |
| TRAGESTUHL mit Treppe | 2 Personen auf einem Fahrzeug mit Tragestuhl (`carryChair`), **oder** 1 Person mit Scalamobil an Bord und Einweisung des **Fahrers**, auf einem Fahrzeug mit Tragestuhl oder Rollstuhlplatz |
| TRAGESTUHL ebenerdig | 1 Person reicht (Fahrzeug mit `carryChair` oder `wheelchairSpots ≥ 1`) |
| SITZEND, ROLLSTUHL | keine Anforderung an die Besatzung (Annahme, auch mit Treppe – offene Frage im Bauprotokoll 2026-11-02) |

Ein deaktivierter Beifahrer zählt nicht. Beifahrer bekommen keine Fahrten aufs Handy, die bleiben beim Fahrer; sie sehen nur ihre Schichten („Mein Schichtplan“).

Code: `besatzungPruefen()` und `besatzungsEtiketten()` in `src/core/shifts/besatzung.ts`. Gilt für jede Zuweisung (Vorschlag, Bestätigen, Umbesetzen, Ziehen im Zeitstrahl, Automodus, „Plan für morgen“, Demo): `findeEinsatzSchicht()` in `kandidaten.ts`, `einsatzfaehigenFahrerFinden()` in `zuweisen.ts`. Passt die Besatzung nicht, wird eine manuelle Zuweisung mit `BesatzungError` (Unterklasse von `KeinFahrerError`) und klarer Meldung abgelehnt, z. B. „Liegend-Fahrt braucht 2 Personen. In dieser Schicht ist kein Beifahrer eingetragen.“

## Schichtplan (Seite `/dispo/schichtplan`)

Bearbeitet wird immer „ein Fahrzeug an einem Tag“: Die Schichten, die an diesem Berliner Kalendertag beginnen, werden durch die Eingaben ersetzt. Prüfungen beim Speichern (`src/core/shifts/schichtplan.ts`):

- Fahrer ist gesetzt; Fahrer ≠ Beifahrer (zusätzlich CHECK in der Datenbank).
- Pro Fahrzeug keine überlappenden Schichten; keine Person überlappend doppelt verplant, weder als Fahrer noch als Beifahrer, über alle Fahrzeuge. Ausgefallene Schichten („Ich falle aus“) blockieren nicht – auf dem Fahrzeug darf eine Ersatzschicht laufen.
- Deaktivierte Personen sind nicht einplanbar (M-12); Scalamobil-Anzahl wird eingehalten.
- Personen und Fahrzeuge anderer Mandanten werden abgewiesen (`referenzenPruefen`, dazu der Trigger `Shift_mandant_referenzen` inkl. `beifahrerId`, M-11).

„Gilt für“: nur dieser Tag / Montag bis Freitag dieser Woche / jeden gleichen Wochentag im Monat / alle Werktage (Mo–Fr) im Monat. Dazu „Woche in nächste Woche kopieren“ und „Woche bis Monatsende wiederholen“ (Monat = Monat des Donnerstags der Woche). Das Ziel wird je Fahrzeug und Tag ersetzt. **Nie** werden vergangene Tage oder schon begonnene Schichten (`startedAt`) überschrieben – sie werden übersprungen und gemeldet. Im Seitenfenster bricht ein Prüffehler das Speichern ganz ab; beim Kopieren einer Woche wird ein Fahrzeug-Tag mit Fehler übersprungen und gemeldet.

**Schicht ändern oder löschen, wenn schon Fahrten darin liegen:** Betroffen ist jede zugewiesene, noch nicht begonnene Fahrt (`DISPONIERT`), deren Abholzeit in einer wegfallenden Schicht ihres Fahrzeugs lag und die danach keine Schicht desselben Fahrzeugs mit demselben Fahrer und passender Besatzung mehr hat. Vor dem Speichern zeigt das Seitenfenster einen **Hinweis** („3 Fahrten liegen in dieser Schicht“ mit Uhrzeiten, ohne Fahrgastnamen); erst nach Bestätigung wird gespeichert. Die Fahrten werden dann wie bei „Ich falle aus“ freigegeben (`disponierteFahrtFreigeben()`): zurück auf `ERFASST`, Fahrzeug und Fahrer gelöst, neu vorgeschlagen, Hinweis „Schicht geändert – neues Fahrzeug nötig“ in der Problemliste, Push „Fahrt entzogen“ an den bisherigen Fahrer. Wird ein Beifahrer deaktiviert, wird er aus allen noch nicht beendeten Schichten ausgetragen; Fahrten, die dann nicht mehr passen, bekommen „Beifahrer deaktiviert – neues Fahrzeug nötig“.

## Schritt 2: Passt die Fahrt in den Plan?

Für jeden Kandidaten den Tagesplan (zugewiesene Fahrten, sortiert) laden und prüfen, wo die neue Fahrt eingefügt werden kann:

- Startpunkt: Ende der vorherigen Fahrt (Zielort + geplante bzw. tatsächliche Ankunft laut Fahrer-Status) oder aktuelle GPS-Position, wenn keine Fahrt davor; ohne GPS (älter als 10 Min) der Betriebshof.
- `ankunftAbholung = startzeit + Fahrzeit(start → Abholort) + Puffer 5 Min`
- Fahrt beginnt `max(ankunftAbholung, pickupAt)`; Einstiegszeit: 5 Min (sitzend), 10 Min (Rollstuhl/Tragestuhl), 15 Min (liegend).
- `ankunftZiel = beginn + Einstieg + Fahrzeit(Abholort → Ziel)`
- Bei `appointmentAt`: `ankunftZiel ≤ appointmentAt − 5 Min`, sonst „zu spät“.
- Die nachfolgende Fahrt muss weiter pünktlich erreichbar sein.
- Sammelfahrt (später): zwei Fahrgäste gleichzeitig, wenn Plätze reichen und Umweg ≤ 10 Min.

## Schritt 3: Bewertung (weiche Regeln)

```
score = 1.0 * anfahrtMinuten
      + 3.0 * verspaetungMinuten
      + 0.5 * leerKilometer
      + 2.0 * (verschiebtFolgefahrt ? 10 : 0)
```

Kleiner ist besser. Gewichte in `src/core/disposition/weights.ts`, damit sie später je Mandant einstellbar sind.

Begründung als Text, z. B. „Anfahrt 9 Min · pünktlich am Ziel“, „als Sammelfahrt mit 1 weiterem Fahrgast“, „5 Min zu spät zum Termin“.

## Ergebnis

`Suggestion.options`: max. 3 Einträge, sortiert nach `score`. Kein Kandidat → Fahrt bekommt Problem `KEIN_FAHRZEUG` und erscheint rot beim Disponenten.

## Fahrzeiten

Über `RoutingProvider.matrix()`, ein Aufruf für alle Kandidaten (nur Koordinaten und Uhrzeit, keine Namen). Ergebnisse 10 Minuten zwischenspeichern (gleiche Start-/Zielpunkte gerundet auf ~100 m). Fällt der Routing-Dienst aus: Luftlinie × 1,4 bei 40 km/h als Notlösung, Vorschlag mit Hinweis „Fahrzeit geschätzt“.

## Bestätigen durch den Disponenten

- „Bestätigen“ → Fahrt `DISPONIERT`, Fahrzeug und Fahrer aus der Schicht gesetzt, Push an den Fahrer, 10 Sekunden „Rückgängig“.
- „Anderes Fahrzeug“ → die anderen Vorschläge oder jedes Fahrzeug des Fahrdienstes – aber nur, wenn das Fahrzeug zur Abholzeit einen **einsatzfähigen Fahrer** hat (siehe unten). Fehlt er, wird die Zuweisung abgelehnt, die Fahrt bleibt unverändert, und der Disponent sieht den Grund als Meldung (z. B. „Fahrer ist zur Abholzeit nicht im Dienst. Erst eine Schicht für dieses Fahrzeug eintragen oder ein anderes Fahrzeug wählen.“). Es gibt keine Zuweisung „mit Warnung“.
- Entscheidung in `Suggestion` speichern (Kennzahl „unverändert übernommen“).

**Einsatzfähiger Fahrer (gilt für jede Zuweisung – Bestätigen, Umbesetzen, Ziehen im Zeitstrahl, Automodus, „Plan für morgen“):** Für das Fahrzeug läuft zur Abholzeit eine `Shift`, deren Fahrer nicht ausgefallen ist (nicht `unavailable`, „Ich falle aus“), keine Pause hat (nicht `onBreak`) und aktiv ist (`Driver.active`) – und deren **Besatzung zur Fahrt passt** (Abschnitt „Besatzung“). Das ist dieselbe Regel wie Sicherheitsbedingung 4 und 6 des Automodus. Laufen mehrere Schichten auf dem Fahrzeug (z. B. Ersatzfahrer nach einem Ausfall), zählt die erste einsatzfähige. Code: `einsatzfaehigenFahrerFinden()` in `src/core/disposition/zuweisen.ts`, Fehler `KeinFahrerError`.

Zusätzlich sichert die Datenbank das Ergebnis selbst ab: Eine Fahrt im Status `DISPONIERT` hat immer `vehicleId` **und** `driverId`. Der Trigger `Ride_disponiert_mit_fahrer` (Migration `20261031180000_disponiert_nur_mit_fahrer`) lehnt jedes Anlegen oder Ändern ab, das diese Regel verletzt – auch aus Skripten oder künftigen Codepfaden. Verliert eine Fahrt ihren Fahrer (Ausfall, Umplanung), verlässt sie zuerst `DISPONIERT` (zurück auf `ERFASST`), dann werden Fahrzeug und Fahrer gelöst.

## Automodus (automatisch disponieren)

Einstellung je Fahrdienst (nur Admin): aus / nur nachts und am Wochenende (Voreinstellung beim Einschalten) / immer.

**Sicherheitsbedingungen – alle müssen erfüllt sein, sonst geht die Fahrt an den Disponenten:**

1. Fahrt hat keine Probleme (Adresse sicher, Fahrgast eindeutig, keine Doppelbuchung, Unterlagen nach Einstellung des Fahrdienstes in Ordnung).
2. Bester Vorschlag ist pünktlich und mindestens X Punkte besser als der zweitbeste (Einstellung, Standard 5).
3. GPS des gewählten Fahrzeugs ist aktuell (≤ 10 Min) oder das Fahrzeug startet vom Betriebshof.
4. Fahrer ist im Dienst und hat keine Pause zur Abholzeit.
5. Fahrt liegt im Zeitfenster des Automodus und höchstens N Tage in der Zukunft (Standard 3).
6. **Besatzung passt zur Fahrt** (seit 02.11.2026): Liegend mit aktivem Beifahrer, Tragestuhl über eine Treppe zu zweit mit Tragestuhl oder mit Scalamobil und eingewiesenem Fahrer (`pruefeBesatzung()` in `automodus.ts`). Der Automodus disponiert nie, wenn sie verletzt ist; der Grund steht an der Fahrt (`autoSkipReason`).

Dann: Fahrt `DISPONIERT` mit Vermerk „automatisch“, Push an den Fahrer. Bestätigt der Fahrer nicht innerhalb von 5 Minuten (bei Fahrten in < 60 Min) → SMS an Fahrer, danach Alarm an Inhaber/Bereitschaft.

Morgens: Übersicht „Heute Nacht“ – automatisch disponiert (n), liegen geblieben (n, mit Grund).

**Neuplanung:** Meldet ein Fahrer Verspätung oder fällt aus („Ich falle aus“ in der App), werden seine offenen Fahrten neu vorgeschlagen; im Automodus nur nach denselben Sicherheitsbedingungen, sonst Alarm.

## Vorausplanung

- Serien erzeugen Fahrten 14 Tage im Voraus.
- Am Vorabend (Einstellung, Standard 18:00): alle unzugewiesenen Fahrten des nächsten Tages nacheinander nach Abholzeit einplanen (gierig, wie oben). Ergebnis als Sammel-Vorschlag „Plan für morgen“, den der Disponent mit einem Klick übernimmt oder einzeln ändert.
- Später: Optimierung über alle Fahrzeuge (Google OR-Tools, Vehicle Routing mit Zeitfenstern) als eigener kleiner Python-Dienst – erst wenn der gierige Plan im Pilot nicht reicht.

## Tests (Pflicht)

`tests/disposition/*.test.ts` mit festen Beispieldaten und einem Fake-RoutingProvider:

- Rollstuhlfahrt bekommt nie ein Fahrzeug ohne Rollstuhlplatz.
- Fahrzeug ohne Schicht wird nie vorgeschlagen.
- Näheres Fahrzeug gewinnt bei sonst gleichen Bedingungen.
- Pünktliches Fahrzeug schlägt näheres, das zu spät käme.
- Einfügen zerstört keine Folgefahrt.
- Kein Kandidat → Problem `KEIN_FAHRZEUG`.
- Automodus: je verletzter Sicherheitsbedingung ein Test (keine automatische Disposition), plus Erfolgsfall.
- Besatzung: Liegend nie ohne Beifahrer, Tragestuhl über Treppe nur zu zweit oder mit Scalamobil und Einweisung (`tests/disposition/zuweisenBesatzung.test.ts`, `tests/shifts/besatzung.test.ts`).
- Ausfall eines Fahrers → seine Fahrten werden neu vorgeschlagen.
