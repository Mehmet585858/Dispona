# 01 – Produkt

## In einem Satz

Eine Komplettlösung für Krankenfahrdienste: Die KI nimmt rund um die Uhr Fahrtbestellungen am Telefon an, die eigene Disposition ordnet jede Fahrt dem passenden Fahrzeug zu, und die Fahrer bekommen sie in der eigenen Fahrer-App.

## Entscheidung (26.10.2026)

- **Alles läuft über die eigene Software:** Annahme, Disposition, Fahrer-App.
- **DMRZ bleibt im Pilot außen vor.** Für die Abrechnung exportiert die Software die erledigten Fahrten als Datei. Anbindung an DMRZ oder andere Abrechnungssoftware später (`docs/07-adapter.md`).
- Anforderung des Pilot-Fahrdienstes: Die Software muss **annehmen, organisieren und disponieren** können, auch automatisch.

## Für wen

- Krankenfahrdienste, Taxi- und Mietwagenbetriebe mit Krankenfahrten, Rollstuhl- und Tragestuhlfahrdienste in Deutschland, 3 bis 50 Fahrzeuge.
- Anrufer: Fahrgäste, Angehörige, Arztpraxen, Kliniken, Dialysezentren, Pflegeheime.
- Nutzer der Software: Inhaber (richtet ein), Disponenten (bestätigen, planen), Fahrer (App).

## Leitprinzip: so einfach wie möglich

Ein Inhaber ohne IT-Kenntnisse richtet das System an einem Nachmittag selbst ein: nichts installieren, sinnvolle Voreinstellungen, eine Sache pro Bildschirm, sofort per Testanruf ausprobieren. Fahrer brauchen nur einen SMS-Link. Messlatte: erster Testanruf nach weniger als 30 Minuten; mindestens 80 % schaffen die Einrichtung ohne Support.

## Umfang

| Funktion | Pilot | Später |
| --- | --- | --- |
| Anrufe annehmen, Fahrt erfassen und prüfen | ja | – |
| Fahrgast wiedererkennen | ja | – |
| Fahrzeugvorschlag, Disponent bestätigt mit 1 Klick | ja | – |
| Automodus: eindeutige Fahrten selbst disponieren (nachts, Wochenende, nach Einstellung) | ja | ganztags |
| Serienfahrten (Dialyse, Bestrahlung …) und Plan für morgen | ja | Tourenoptimierung über alle Fahrzeuge |
| Fahrer-App: Fahrten, Push, Status, GPS, Navigation | ja | Foto Transportschein, Unterschrift |
| Live-Karte und Tagesplan für den Disponenten | ja | – |
| Export für die Abrechnung (CSV/Excel) | ja | Anbindung DMRZ u. a. |
| Erinnerung an Fahrgäste am Vortag (Anruf/SMS) | nein | ja |
| Weitere Sprachen | nein | Türkisch, Russisch, Arabisch u. a. |

## Nicht Teil des Produkts

- Abrechnung mit den Krankenkassen (bleibt bei der Abrechnungssoftware des Kunden; wir liefern die Daten).
- Medizinische Beratung oder Einschätzung.
- Rettungsdienst / qualifizierter Krankentransport mit medizinischer Betreuung.

## Die Pflichtdaten einer Fahrt

- Fahrgast: Name, Geburtsdatum, Rückrufnummer, Krankenkasse
- Abholadresse, Zieladresse (geprüft über Geocoding)
- Datum, Abholzeit oder Termin am Ziel, Rückfahrt ja/nein (+ Zeit)
- Beförderungsart: SITZEND, ROLLSTUHL (bleibt im Rollstuhl), TRAGESTUHL, LIEGEND
- Transportschein/Verordnung: JA / NEIN / UNKLAR; Genehmigung der Kasse: JA / NEIN / UNKLAR / NICHT_NOETIG
- Besonderheiten: Begleitperson, Treppen, Hilfe bis in die Wohnung, Sauerstoff (nur als Hinweis, keine Diagnose)

## Erfolgskennzahlen im Pilot

| Kennzahl | Ziel |
| --- | --- |
| Anrufe, die die KI vollständig erfasst | ≥ 80 % |
| Fehler in Pflichtdaten | < 2 % |
| Vorschläge, die der Disponent unverändert übernimmt | ≥ 70 % |
| Automatisch disponierte Fahrten ohne spätere Änderung | ≥ 95 % |
| Fahrten pünktlich am Ziel | ≥ 95 % |
| Anrufer, die zu einem Menschen wechseln | < 20 % |
| Verpasste Anrufe | nahe 0 |
