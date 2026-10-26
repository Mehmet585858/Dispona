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
| TRAGESTUHL | `carryChair = true` |
| LIEGEND | `stretcher = true` |

Zusätzlich: Fahrzeug `active`, es gibt eine `Shift` zur Abholzeit, nicht `onBreak` zur Abholzeit.

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
- „Anderes Fahrzeug“ → die anderen Vorschläge oder jedes Fahrzeug (mit Warnung, wenn harte Regeln verletzt sind).
- Entscheidung in `Suggestion` speichern (Kennzahl „unverändert übernommen“).

## Automodus (automatisch disponieren)

Einstellung je Fahrdienst (nur Admin): aus / nur nachts und am Wochenende (Voreinstellung beim Einschalten) / immer.

**Sicherheitsbedingungen – alle müssen erfüllt sein, sonst geht die Fahrt an den Disponenten:**

1. Fahrt hat keine Probleme (Adresse sicher, Fahrgast eindeutig, keine Doppelbuchung, Unterlagen nach Einstellung des Fahrdienstes in Ordnung).
2. Bester Vorschlag ist pünktlich und mindestens X Punkte besser als der zweitbeste (Einstellung, Standard 5).
3. GPS des gewählten Fahrzeugs ist aktuell (≤ 10 Min) oder das Fahrzeug startet vom Betriebshof.
4. Fahrer ist im Dienst und hat keine Pause zur Abholzeit.
5. Fahrt liegt im Zeitfenster des Automodus und höchstens N Tage in der Zukunft (Standard 3).

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
- Ausfall eines Fahrers → seine Fahrten werden neu vorgeschlagen.
