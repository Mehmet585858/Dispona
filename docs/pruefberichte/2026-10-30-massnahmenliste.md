# Maßnahmenliste Dispona – Stand 30.10.2026 (zuletzt aktualisiert 31.10.2026, dritte Aktualisierung, durch M. Reiter, Projektleitung)

Diese Liste führt fünf Prüfberichte, die Beobachtungen am Rande aus dem Behebungsprotokoll Durchgang 3 und das Behebungsprotokoll zu M-46/M-47 zu einer einzigen Reparaturliste ohne Dubletten zusammen.

**Quellen**

| Quelle | Inhalt | Befunde | Verdachte |
|---|---|---|---|
| `docs/13-dispositionspruefung.md` | Drei interne Prüfrunden der Dispositionslogik, des Umplanens und der Fahrer-App. Die Befunde heißen hier R1-1 bis R1-7 (Runde 1), R2-1 bis R2-11 (Runde 2) und R3-1 bis R3-11 (Runde 3), in der Reihenfolge des Dokuments. | 29 | – |
| `docs/pruefberichte/2026-10-30-berger-durchgang-1.md` | Externer Prüfbericht K. Berger, Durchgang 1 (Code-Prüfung ohne Datenbank). | 40 (S1-001 bis S4-010) | 9 (V-001 bis V-009) |
| `docs/pruefberichte/2026-10-30-berger-durchgang-2.md` | Externer Prüfbericht K. Berger, Durchgang 2 (gegen echte Datenbank und laufenden Server). Enthält zusätzlich eine Nachprüfung von 12 Befunden aus Durchgang 1. | 22 (S1-006, S2-012 bis S2-017, S3-015 bis S3-025, S4-011 bis S4-014) | 4 (V-010 bis V-013) |
| `docs/pruefberichte/2026-10-31-berger-durchgang-3.md` | Externer Prüfbericht K. Berger, Durchgang 3 (Schwerpunkt: KI am Telefon, Serien, Import, Oberfläche). | 21 (S1-007, S2-018 bis S2-024, S3-026 bis S3-033, S4-015 bis S4-019) | 3 (V-014 bis V-016) |
| `docs/pruefberichte/2026-10-31-behebung-3-massnahmen.md` (nur auf Branch `claude/behebung-durchgang-2`) | Behebungsprotokoll L. Hartmann, Durchgang 3, Abschnitt „Auf dem Weg aufgefallen“. Keine Prüfbefunde, sondern Beobachtungen am Rande; hier B3-A1 bis B3-A7 genannt. Aufnahme freigegeben vom Auftraggeber am 31.10.2026 (Entscheidung D1). | 7 Beobachtungen (B3-A1 bis B3-A7) | – |
| `docs/pruefberichte/2026-10-31-berger-durchgang-4.md` | Externer Prüfbericht K. Berger, Durchgang 4 (gegen `claude/behebung-durchgang-2`, Stand `aa4e6e7`; Schwerpunkt: Nachprüfung M-01 bis M-23, manuelle Zuweisung, Serien-Rückbau, Fahrgastnamen). Kurzfassung (Urteil, Zahlen, Top-3) im Volltext übernommen; Einzelheiten zu S2-027 bis S2-029, S3-035 bis S3-038, S4-020 bis S4-023 sowie die Nachprüfungstabelle M-01 bis M-23 und Zusatzprüfung 1 liegen nur im Chat-Verlauf der auftraggebenden Sitzung vor, noch nicht in Dateiform. | 20 (S1-008, S1-009, S2-025 bis S2-029, S3-034 bis S3-038, S4-020 bis S4-023) | 4 (V-017 bis V-020) |
| `docs/pruefberichte/2026-10-31-behebung-3-m46-m47.md` (nur auf Branch `claude/behebung-pilot-blocker`) | Behebungsprotokoll L. Hartmann zu den Maßnahmen M-46 und M-47 (Pilot-Blocker aus Durchgang 3). Keine neuen Prüfbefunde; Status- und Entscheidungsgrundlage für M-46/M-47. | – | – |
| **Summe** | | **132 Befunde + 7 Beobachtungen** | **20 Verdachte** |

**So wurde gezählt**

- Jeder der 132 Befunde ist genau einer Maßnahme zugeordnet (Anhang), soweit die Einzelheiten dafür vorliegen. Befunde mit derselben Ursache bilden zusammen eine Maßnahme. Wo ein Befund zu zwei Maßnahmen passt, steht er bei der Maßnahme, die die Ursache behebt; die zweite ist als „siehe auch“ vermerkt.
- Nach der Zusammenführung bleiben **85 Maßnahmen**: 12 × P1, 26 × P2, 30 × P3, 17 × P4 (davon 20 neu aus Durchgang 3: M-46 bis M-65; 6 neu aus den Beobachtungen des Behebungsprotokolls: M-66 bis M-71; 14 neu aus Durchgang 4: M-72 bis M-85). Dazu M-67, der durch Durchgang 4 (S3-034) von P2 auf P1 hochgestuft und in den Abschnitt „P1 – Pilot-Blocker“ verschoben wurde.
- Die 7 Beobachtungen B3-A1 bis B3-A7 sind ebenfalls genau einer Maßnahme zugeordnet (Anhang). B3-A4 (Zeitrechnung mit Server-Zeitzone) deckt sich mit der bestehenden Maßnahme M-26 und ist dort als Ergänzung eingetragen statt als Dublette; deshalb 7 Beobachtungen, aber 6 neue Maßnahmen.
- Zwei Verdachte wurden in Durchgang 2 bestätigt (V-005, V-006) und zählen deshalb als Befund in einer Maßnahme. Die übrigen 18 Verdachte (V-001 bis V-004, V-007 bis V-020) stehen im Abschnitt „Vor dem Pilot extern klären“.
- Von den 20 neuen Durchgang-4-Befunden liegen 9 im Volltext vor (S1-008, S1-009, S2-025, S2-026, S3-034 → Maßnahmen M-72 bis M-74 sowie Ergänzungen zu M-66/M-67) und 11 nur als Kennung ohne Kurztitel/Einzelheiten (S2-027 bis S2-029, S3-035 bis S3-038, S4-020 bis S4-023 → Maßnahmen M-75 bis M-85). Diese 11 Maßnahmen sind absichtlich nur als Platzhalter angelegt („Kurztitel nicht übergeben“) statt mit erfundenen Angaben gefüllt; sie werden nachgetragen, sobald der vollständige Bericht vorliegt.
- M-01 bis M-23 (alle ursprünglichen P1/P2) sind seit dem Behebungsdurchgang 3 bearbeitet (Branch `claude/behebung-durchgang-2`, gepusht, **noch nicht nach `master` gemergt**) und wurden in Prüfdurchgang 4 nachgeprüft (siehe „Auftragsstand“ und „Nachprüfung Durchgang 4“); M-46 und M-47 sind seit 31.10.2026 BEHOBEN (Branch `claude/behebung-pilot-blocker`, noch nicht von Berger gegengeprüft). M-24 bis M-45 und M-48 bis M-85 sind noch nicht bearbeitet (OFFEN).
- „live bestätigt“ heißt: Durchgang 2 hat den Fehler gegen eine echte Datenbank oder einen laufenden Server nachgestellt, nicht nur im Code gelesen.

**So sind die Prioritäten zu lesen**

| Priorität | Bedeutung | Regel |
|---|---|---|
| P1 | Pilot-Blocker. Ohne diese Reparaturen darf kein echter Fahrdienst das System nutzen. | enthält mindestens einen S1-Befund oder einen „Kritisch“-Befund |
| P2 | Vor dem Pilot erledigen. | höchste Schwere S2 oder „Hoch“ |
| P3 | In den ersten Pilotwochen erledigen. | höchste Schwere S3 oder „Mittel“ |
| P4 | Später. | höchste Schwere S4 oder „Niedrig“ |

Innerhalb einer Priorität stehen zuerst Maßnahmen, die Datenverlust oder einen Datenschutzverstoß verhindern, dann Maßnahmen gegen Betriebsgefahr für Fahrten (Fahrt fällt aus, falsche Adresse, Doppelbuchung), dann der Rest.

## Auftragsstand und Entscheidungen des Auftraggebers

**Entscheidungen vom 31.10.2026** (Antwort des Auftraggebers auf das Entscheidungsbündel der Projektleitung):

| Punkt | Entscheidung |
|---|---|
| A1 – Zusammenführen von `claude/behebung-durchgang-2` nach `master` | Option (b): **erst** Prüfung durch K. Berger, **dann** zusammenführen. Jetzt **kein** Merge nach `master`. |
| Schritt 1 – Prüfdurchgang 4 | **Freigegeben.** K. Berger prüft gegen `claude/behebung-durchgang-2`. |
| Schritt 2 – Behebung der neuen P1-Maßnahmen | **Freigegeben, nur M-46 und M-47.** M-48 bis M-51 sind ausdrücklich **nicht** beauftragt. L. Hartmann behebt parallel auf einem neuen Branch. |
| D1 – Beobachtungen am Rande aus dem Behebungsprotokoll | **Freigegeben.** Die 7 Beobachtungen werden als Maßnahmen aufgenommen (jetzt M-66 bis M-71, B3-A4 als Ergänzung zu M-26). |

**Abgeschlossene Aufträge (beauftragt am 31.10.2026, beide abgeschlossen und eingearbeitet durch M. Reiter, Projektleitung):**

| Auftrag | Wer | Gegen / auf | Ergebnis |
|---|---|---|---|
| Prüfdurchgang 4 (Nachprüfung M-01 bis M-23 laut Nachprüfungsauftrag im Behebungsprotokoll Durchgang 3) | K. Berger (`dispona-pruefer`) | `claude/behebung-durchgang-2`, Stand `aa4e6e7` | Abgeschlossen. Bericht: `docs/pruefberichte/2026-10-31-berger-durchgang-4.md`. Urteil: Pilotstart weiterhin **nein**. 20 neue Befunde (2 × S1, 5 × S2, 5 × S3, 4 × S4) und 4 neue Verdachte (V-017 bis V-020), siehe Maßnahmen M-72 bis M-85 und Eskalation M-67. Nachprüfung M-01 bis M-23: laut Kurzfassung „überwiegend so umgesetzt wie beschrieben“, alle 398 Tests grün; die Einzelbewertung je Maßnahme sowie die Zusatzprüfung 1 (Status der alten Befunde M-46 bis M-65 auf dem Branch) liegen nur im Chat-Verlauf der auftraggebenden Sitzung vor, noch nicht itemisiert in Dateiform – deshalb hier **nicht** einzeln als Status je M-Nummer übernommen, um nichts zu erfinden; bei nächster Gelegenheit nachtragen. |
| Behebung M-46 und M-47 | L. Hartmann (`dispona-behebung`) | neuer Branch `claude/behebung-pilot-blocker`, abgezweigt von `claude/behebung-durchgang-2` (`aa4e6e7`), Commits `e7a274f`, `8745d1e`, `5757d00`, `92339b6`, gepusht | Abgeschlossen. Protokoll: `docs/pruefberichte/2026-10-31-behebung-3-m46-m47.md`. Beide Maßnahmen **BEHOBEN** (72 neue Regressionstests, 470/470 grün, Lint/Typecheck grün; Code-Gegenlesen durch Projektleitung an `pruefungen.ts`, `rufnummer.ts`, `webhook/route.ts` bestätigt die Beschreibung). **Von K. Berger noch nicht gegengeprüft** – Hartmann selbst schlägt einen gezielten Nachprüfdurchgang nur für M-46/M-47 vor (siehe Entscheidungsbündel). Fünf eigene Entscheidungspunkte offen, siehe Entscheidungsbündel. |

Hinweis: Prüfdurchgang 4 prüfte den Stand `aa4e6e7` und damit **nicht** die Reparaturen an M-46/M-47 auf `claude/behebung-pilot-blocker` – diese brauchen eine eigene Nachprüfung, bevor irgendetwas zusammengeführt wird.

**Offene Entscheidungen, Entscheidungsbündel 2 (vorgelegt 31.10.2026 durch M. Reiter, Projektleitung):** Bergers 5 „Vor dem Pilot“-Punkte aus Durchgang 4 (einsatzfähiger Fahrer vor Zuweisung, Serien-Pausen umkehrbar, keine Namen mehr in Fahrer-Texten/Telefon, Panne/Abbruch zuweisbar, Hintertür `fahrtStatusSetzen` entfernen), Hartmanns 5 Entscheidungspunkte zu M-46/M-47 (u. a. Verhalten bei KI aus ohne gültige Weiterleitungsnummer, Toleranzwert 15 Minuten, `docs/04` nachziehen, echter kostenpflichtiger Testanruf gegen Vapi) sowie die Merge- und Nachprüf-Frage sind dem Auftraggeber gebündelt vorgelegt, noch **nicht entschieden**. Einzelheiten siehe Übergabe der Projektleitung vom 31.10.2026 (nicht in dieser Datei wiederholt, um sie nicht noch umfangreicher zu machen).

## Auf einen Blick

| Priorität | Anzahl Maßnahmen | Was dahinter steckt |
|---|---|---|
| P1 – Pilot-Blocker | 12 (7 behoben/teilweise + 2 behoben, ungeprüft + 3 neu) | Ein Entwickler-Befehl löscht alle Kundendaten, jeder Fahrer kann alle Fahrgastdaten herunterladen, Alarm-SMS und Fahrer-Login existieren nicht, Fahrzeuge werden doppelt vergeben, Fahrer können am Büro vorbei stornieren, die KI schickt Fahrer zur falschen Adresse und verliert Rückfahrten. **Durchgang 3, behoben (noch nicht von Berger gegengeprüft):** Die KI kennt jetzt Datum/Uhrzeit und lehnt Fahrten mit falscher Zeit ab (M-46); die Weiterleitung an einen Menschen im Notfall ist jetzt real angebunden (M-47). **Neu (Durchgang 4):** Manuelle Zuweisung ohne Schichtprüfung, Fahrt kann ohne Fahrer als „disponiert“ enden, ausgefallene/deaktivierte Fahrer bekommen Fahrten zurück (M-72); verkürzte Serienpause oder zurückgenommene Serienänderung löscht Dialysetermine dauerhaft (M-73). **Hochgestuft (Durchgang 4, S3-034):** Die Büro-Funktion `fahrtStatusSetzen` ist eine real nutzbare Hintertür um alle Dispositionsregeln, bisher nur durch eine geheime Action-ID begrenzt (M-67, vorher P2). |
| P2 – vor dem Pilot | 26 (16 behoben/teilweise + 1 aus Beobachtungen + 5 neu + 4 neu, Details ausstehend) | Fahrgastdaten im Handy-Cache und im Server-Protokoll, unvollständige Löschung, Mandantengrenze bei Fremdschlüsseln, kein Fahrer-Offboarding, Identität am Telefon nicht geprüft, doppelte Fahrten durch Webhook-Wiederholung, stummer Alarmweg, Nachtautomatik ohne Fehlererkennung und ohne erfüllbare Bedingungen, Nachtschichten, Umplanen, Stammkundenerkennung, Serien, Registrierung. **Neu (Durchgang 3):** Serien ohne Startdatum, stornierte Fahrten bleiben im Zeitstrahl wie geplant, Geburtsdatum beim Import vertauscht, Fahrer-App ohne Datum je Fahrt, Serverregion nicht auf EU festgelegt. **Neu (Beobachtungen Behebung 3):** Fahrgastname kann über den Ortsnamen in SMS/Push an Fahrer gelangen (M-66; durch Durchgang 4, S2-025, bestätigt). M-67 (Büro-Funktion ohne Umplan-Regeln) ist nach Durchgang 4 nach P1 verschoben, siehe oben. **Neu (Durchgang 4):** Unbekannte Anrufer bekommen am Telefon volle Adresse und Ortsbezeichnung (ggf. Fahrgastname) vorgelesen, ohne Identitätsprüfung (M-74); drei weitere Befunde ohne vorliegenden Kurztitel (M-75 bis M-77). |
| P3 – erste Pilotwochen | 30 (16 behoben/offen + 8 neu + 2 aus Beobachtungen + 4 neu, Details ausstehend) | Öffentliche Demo-Seite mit Transkripten, Exportlücken, Zeitzonenfehler, doppelte Schreibzugriffe bei Verbindungsabbruch, unvollständige Endprüfung der Zuweisung, Hin-/Rückfahrt-Kopplung, Vorschlagsqualität, Fahrer-App-Robustheit, Tests und Datenbankschema. **Neu (Durchgang 3):** Hydrationsfehler durch fehlende Zeitzone, verschluckte Fehler in 20 Oberflächen-Komponenten, Einrichtungsassistent ohne fachliche Prüfung, falsche Vorschlagsrechnung bei Terminfahrten, Routing ohne Zeitlimit, Push-Fehler werden verworfen, „Ich falle aus“ ohne Rückfrage, verzerrte Pilot-Kennzahlen. **Neu (Beobachtungen Behebung 3):** technische Problemcodes in „Braucht Sie“ (M-68); ungeprüfter Verdacht doppelter/fehlender Fahrer-Meldung bei „Fahrzeug ändern“ (M-69). **Neu (Durchgang 4):** vier weitere Befunde ohne vorliegenden Kurztitel (M-78 bis M-81). |
| P4 – später | 17 (6 behoben/offen + 5 neu + 2 aus Beobachtungen + 4 neu, Details ausstehend) | Einmal-Codes im Klartext, fehlende Sicherheits-Header, Platzhalter-Adressen, technische Codes in KI-Antworten, Feiertage/Kleinigkeiten, veralteter Sicherheitsbericht. **Neu (Durchgang 3):** Gesprächsbericht-Reihenfolge, offene Design-/Projektregeln, Benutzer-Enumeration bei der Anmeldung, unvollständige Vapi-Konfiguration, fehlerhafte neue Adressen. **Neu (Beobachtungen Behebung 3):** Testpflege – liegengebliebene Testdaten (M-70, M-71). **Neu (Durchgang 4):** vier weitere Befunde ohne vorliegenden Kurztitel (M-82 bis M-85). |

## Empfohlene Reihenfolge

Die ersten zehn Maßnahmen in der Reihenfolge, in der sie angegangen werden sollten:

1. **M-01 Seed und Demo-Reset nur lokal und mandantenbezogen** – Der gefährlichste Befehl im Projekt; solange er existiert, kann jede weitere Arbeit an der Datenbank versehentlich alle Kundendaten löschen (ist laut Git-Historie schon einmal gegen Produktion gelaufen).
2. **M-02 Zentrale Rollen- und Sitzungsprüfung** – Schließt den offenen Export und alle ungeschützten Server Actions auf einmal; alle späteren Maßnahmen an Actions und API-Routen bauen auf dieser zentralen Prüfung auf.
3. **M-04 Zuweisung und Statuswechsel in Transaktion mit Sperre** – Behebt die Ursache von sieben Befunden aus allen drei Quellen; die Cron-Maßnahme (M-16) und das Umplanen (M-20) setzen darauf auf.
4. **M-03 Echter SMS-Versand und Fahrer-Login** – Braucht einen externen Anbieter (Vertrag, Rufnummer, Freigabe) und damit Vorlaufzeit; früh starten, parallel zu 2 und 3.
5. **M-05 Fahrer-Server-Actions absichern** – Kleine Änderung mit großer Wirkung: schließt den Weg, auf dem ein Fahrer Fahrten am Büro vorbei stornieren oder in die Warteschlange zurückwerfen kann.
6. **M-06 Adress- und Fahrgastsuche über die Datenbank** – Verhindert Fahrten zur falschen Adresse; muss vor dem ersten echten Testanruf fertig sein.
7. **M-07 Rückfahrt richtig anlegen** – Verhindert stillschweigend verlorene Rückfahrten, insbesondere bei Dialyse-Serien.
8. **M-08 Service Worker nur für die App-Hülle** – Nach M-02 ist der Export für Fahrer gesperrt, aber Fahrgastdaten der Tagesansicht liegen weiter unbegrenzt im Handy-Cache; vor dem ersten Gerät beim Fahrer erledigen.
9. **M-11 Mandantenprüfung für Fremdschlüssel** – Ergänzt den Kern `withTenant()`, auf dem alle Datenzugriffe aufsetzen; je früher, desto weniger Stellen müssen später nachgezogen werden.
10. **M-21 Zentrale Telefonnormalisierung** – Muss vor dem Import der ersten Pilot-Fahrgäste fertig sein, sonst werden alle Bestandsdaten im falschen Format gespeichert und die Stammkundenerkennung versagt vom ersten Tag an.

Danach folgen die übrigen P1-/P2-Maßnahmen in der Reihenfolge der Abschnitte unten.

**Nachtrag Durchgang 4 (31.10.2026):** Drei weitere P1-Maßnahmen sind seither hinzugekommen und noch nicht beauftragt: M-72 (Zuweisung ohne Schichtprüfung), M-73 (Serienänderung löscht Termine) und M-67 (hochgestuft – `fahrtStatusSetzen`-Hintertür). Reihenfolge unter den übrigen offenen P1-Punkten mit dem Auftraggeber abzustimmen, siehe Entscheidungsbündel.

## Maßnahmen

### P1 – Pilot-Blocker

#### M-01 Seed und Demo-Reset nur gegen lokale Datenbank, nur für den eigenen Mandanten
- **Problem:** Der Befehl `npm run seed` (lädt Beispieldaten) löscht vorher alle Fahrgäste, Fahrzeuge, Fahrten, Orte, Rufnummern und Einstellungen **aller** Fahrdienste, nicht nur die der Musterfirma. Zeigt die `.env`-Datei auf die Produktionsdatenbank, ist der Betrieb aller Kunden mit einem Befehl weg. Laut Git-Historie ist genau das schon einmal passiert. Außerdem laufen Demo-Mandant und Produktion in derselben Datenbank, und jeder Build führt Datenbank-Migrationen aus, bevor der neue Code live ist.
- **Zu tun:**
  1. Alle `deleteMany()`-Aufrufe im Seed auf den Muster-Mandanten einschränken (`where: { tenantId }`).
  2. Seed und `demoZuruecksetzen` verweigern den Lauf, wenn `DATABASE_URL` nicht auf `localhost` zeigt; sonst ausdrückliche Rückfrage mit dem Namen des Datenbank-Hosts.
  3. Demo-Mandant in eine eigene Datenbank oder einen eigenen Vercel-Stand verschieben; `prisma migrate deploy` aus dem Build-Schritt nehmen und als bewussten Schritt vor dem Deploy ausführen.
  4. `demoZuruecksetzen(tenantId)` ohne Standardwert: der Aufrufer muss den Mandanten ausdrücklich nennen.
- **Betroffene Dateien:** `prisma/seed.ts`, `src/core/demo/aufraeumen.ts`, `package.json` (Build-Skript), `vercel.json`, `CLAUDE.md`/README (Befehlsbeschreibung).
- **Erledigt damit:** S1-006 (live bestätigt), S3-013.
- **Nachweis:** Test, der den Seed gegen eine Datenbank mit zwei Mandanten laufen lässt und zählt, dass der zweite Mandant danach unverändert ist. Test, dass der Seed bei einer Nicht-localhost-URL abbricht.
- **Status:** TEILWEISE (Behebung Durchgang 3, Branch `claude/behebung-durchgang-2`, noch nicht gemergt). S1-006 behoben. Offen: Punkt 3, eigene Demo-Datenbank/Build-Ablauf – RÜCKFRAGE, siehe Entscheidungsbündel Punkt 5.

#### M-02 Zentrale Rollen- und Sitzungsprüfung in jeder API-Route und jeder Server Action
- **Problem:** Wer eingeloggt ist, darf heute fast alles – egal mit welcher Rolle. Ein Fahrer kann über einen Link die komplette Abrechnungsliste mit Namen, Geburtsdaten, Krankenkassen und Adressen aller Fahrgäste herunterladen und markiert dabei alle Fahrten als „schon exportiert“, so dass sie in der echten Abrechnung fehlen. Er kann über die Server Actions der Disposition (Funktionen, die der Browser direkt am Server aufruft) Fahrten lesen, stornieren, Fahrzeuge zuweisen und Gesprächsprotokolle lesen. Zwei Adresssuch-Funktionen brauchen gar keine Anmeldung. Die 12-Stunden-Grenze für Bürositzungen gilt nur für Seiten, nicht für API-Aufrufe.
- **Zu tun:**
  1. Eine zentrale Hilfsfunktion `requireRole(["ADMIN","DISPONENT"])` (bzw. `["FAHRER"]`) bauen, die Sitzung, Rolle **und** Sitzungsalter prüft; `requireSession()` allein reicht nirgends mehr.
  2. Jede exportierte Server Action in `src/app/**/actions.ts` und jede API-Route beginnt mit dieser Prüfung; `/fahrer`-Actions prüfen zusätzlich `role === "FAHRER"`, nicht nur „es gibt eine Driver-Zeile“.
  3. Fehlende Anmeldung liefert HTTP 401/403 statt 500.
  4. Lint-Regel oder Test, der jede `"use server"`-Datei auf die Prüfung durchsucht, damit neue Actions nicht wieder ungeschützt sind.
- **Betroffene Dateien:** `src/app/api/export/abrechnung/route.ts`, `src/proxy.ts`, `src/lib/auth.ts`, alle `src/app/dispo/**/actions.ts`, `src/app/einrichtung/[schritt]/actions.ts`, `src/app/fahrer/actions.ts`.
- **Erledigt damit:** S1-001 (live bestätigt), S2-001, S3-003, S3-018 (live bestätigt), R3-6 „Rolle wird in /fahrer-Server-Actions nie erneut geprüft“. Siehe auch M-05 (Fahrer-Actions) und V-001/V-013 (Verdachte).
- **Nachweis:** Test mit FAHRER-Sitzung gegen `/api/export/abrechnung` → 403, ohne Sitzung → 401; Test mit 13 Stunden alter Büro-Sitzung → abgelehnt; automatische Prüfung, dass jede Action-Datei die Rollenprüfung enthält.
- **Status:** BEHOBEN (Behebung Durchgang 3, Branch `claude/behebung-durchgang-2`, noch nicht gemergt).

#### M-03 Echter SMS-Versand, Fahrer-Anmelde-Link und Büro-Login-Mail in Produktion
- **Problem:** Der SMS-Anbieter ist ein Platzhalter, der nur eine Zeile ins Server-Protokoll schreibt. Alle nächtlichen Alarme (Fahrer bestätigt nicht, kein Fahrzeug, Alarm an den Inhaber) landen also nie auf einem Handy – und das System merkt sich den Alarm als „gesendet“. Der Anmelde-Link für Fahrer wird in Produktion gar nicht versendet; kein Fahrer kann sich einloggen. Ohne `RESEND_API_KEY` kommt auch keine Büro-Login-Mail, der Nutzer sieht trotzdem „Code gesendet“. Die Beispiel-Konfiguration nennt falsche Variablennamen.
- **Zu tun:**
  1. Echten `SmsProvider` anbinden (EU-Anbieter, Kosten vorher mit dem Auftraggeber klären); Platzhalter nur noch bei `istEntwicklung`.
  2. `sendMagicLink` schickt den Fahrer-Link per SMS über diesen Provider.
  3. Fehlende Schlüssel (`SMS_API_KEY`, `RESEND_API_KEY`, `VAPID_*`) lassen den Start in Produktion scheitern statt still zu loggen; Fehlermeldung an den Nutzer statt „Code gesendet“.
  4. `.env.example` auf die tatsächlich gelesenen Variablen bringen (`RESEND_API_KEY`, `DIRECT_URL`, SMS-Schlüssel).
  5. Test auf echtem iPhone und Android: Link kommt an, Login klappt.
- **Betroffene Dateien:** `src/providers/sms/index.ts`, `src/lib/auth.ts`, `src/lib/email.ts`, `src/app/dispo/fahrer/FahrerClient.tsx`, `src/core/notify/eskalation.ts`, `.env.example`.
- **Erledigt damit:** S1-002 (live bestätigt), S4-013 (live bestätigt), S4-002.
- **Nachweis:** Eskalations-Test mit gemocktem Provider zählt echte `send()`-Aufrufe; manueller Testlauf: Fahrer-Einladung → SMS kommt auf zwei Geräten an; Start ohne Schlüssel bricht mit klarer Meldung ab.
- **Status:** TEILWEISE (Behebung Durchgang 3). Versandweg gebaut, Fehlerverhalten korrekt. Offen: echter SMS-Anbieter – RÜCKFRAGE, siehe Entscheidungsbündel Punkt 1. Ohne Anbieter kein Pilot.

#### M-04 Fahrzeugzuweisung und Statuswechsel in einer Datenbank-Transaktion mit Sperre
- **Problem:** Das System prüft erst „ist das Fahrzeug frei?“ und schreibt dann – ohne Sperre dazwischen. Laufen zwei Zuweisungen gleichzeitig (zwei Disponenten, oder Disponent und Nachtautomatik), bekommen zwei Fahrten dasselbe Fahrzeug, und niemand merkt es. Dasselbe Muster bei Statuswechseln: „Fahrgast an Bord“ und „nicht angetroffen“ werden beide angenommen. Dazu schreibt die Zuweisung Fahrzeug und Fahrer schon in die Datenbank, bevor der Statuswechsel geprüft ist – schlägt der fehl, zeigt die Fahrt auf einen Fahrer, der nie benachrichtigt wurde. Und in der Fahrer-App können der alte und der neue Fahrer einer umbesetzten Fahrt gleichzeitig schreiben.
- **Zu tun:**
  1. `fahrzeugZuweisen` komplett in `prisma.$transaction` (eine Transaktion = alle Schritte gelten gemeinsam oder gar nicht) mit Sperre auf das Fahrzeug (`pg_advisory_xact_lock` oder `SELECT … FOR UPDATE`), Konfliktprüfung innerhalb der Sperre.
  2. Statuswechsel als bedingtes Update: `UPDATE … WHERE id = ? AND status = <alter Status>`; 0 betroffene Zeilen = Konflikt, kein stiller Erfolg. Event- und Audit-Zeile in derselben Transaktion.
  3. Status erst prüfen, dann Fahrzeug/Fahrer schreiben – nicht umgekehrt.
  4. Fahrer-Actions schreiben mit `WHERE id = ? AND driverId = <eigener Fahrer>`; Eigentümerschaft wird nicht mehr in einem getrennten Lesezugriff geprüft.
  5. Optional: Datenbank-Constraint gegen überlappende Zeitfenster je Fahrzeug (Postgres `EXCLUDE`), damit die Datenbank selbst die letzte Verteidigungslinie ist.
- **Betroffene Dateien:** `src/core/disposition/zuweisen.ts`, `src/core/rides/status.ts`, `src/core/disposition/automatischDisponieren.ts`, `src/app/fahrer/actions.ts`, `src/app/dispo/fahrten/actions.ts` (`fahrtVerschieben`).
- **Erledigt damit:** S1-004 (live bestätigt), S2-015 (live bestätigt), R1-1 „Cron-Race bei parallelen Automodus-Durchläufen“, R2-1 „Stiller Fahrzeug-Doppelbuchungs-Race (TOCTOU) in fahrzeugZuweisen“, R2-2 „Schreiben-vor-Status-Prüfung erzeugt Split-Brain-Datensatz“, R3-2 „TOCTOU: Eigentümerprüfung und Schreiben sind getrennte DB-Aufrufe“. Siehe auch M-16 (Laufsperre der Crons) und M-23 (weitere Mehrzeilen-Schreibvorgänge).
- **Nachweis:** Die Reproduktionstests aus Durchgang 2 gegen Postgres werden ins Projekt übernommen: `Promise.allSettled([zuweisen(A,V1), zuweisen(B,V1)])` → genau einer scheitert mit `FahrzeugKonfliktError`; paralleler Statuswechsel → genau ein Event; alter Fahrer schreibt nach Umbesetzung → abgelehnt.
- **Status:** BEHOBEN (Behebung Durchgang 3).

#### M-05 Fahrer-Server-Actions absichern: nur erlaubte Status, geprüfte GPS-Werte
- **Problem:** Die Funktion, mit der ein Fahrer „unterwegs / an Bord / erledigt“ meldet, nimmt jeden beliebigen Status vom Handy an. Ein Fahrer kann damit seine Fahrt stornieren (ohne dass das Büro es merkt) oder in die Warteschlange zurückwerfen. GPS-Werte werden ohne Prüfung gespeichert, und eine nie beendete Schicht sendet tagelang Positionen.
- **Zu tun:**
  1. Feste Liste der erlaubten Ziel-Status für Fahrer (`UNTERWEGS`, `AN_BORD`, `ERLEDIGT`, `NICHT_ANGETROFFEN`) zur Laufzeit prüfen (`zod`-Schema); alles andere ablehnen.
  2. `lat`/`lng` auf gültige Bereiche prüfen (−90…90, −180…180, keine `NaN`).
  3. „Laufende Schicht“ zusätzlich auf das aktuelle Datum begrenzen.
- **Betroffene Dateien:** `src/app/fahrer/actions.ts`, `src/core/rides/status.ts`.
- **Erledigt damit:** R3-1 „Fahrer kann über die Server-Action jeden beliebigen Status setzen“, S4-014.
- **Nachweis:** Test: `fahrtStatusSetzenFahrer(…, "STORNIERT")` → abgelehnt; `gpsPositionMelden(999, NaN)` → abgelehnt.
- **Status:** BEHOBEN (Behebung Durchgang 3).

#### M-06 Adress- und Fahrgastsuche über die Datenbank, exakter Adressabgleich, Geocoding mit Regionsbezug
- **Problem:** Sagt ein Anrufer „Hauptstraße 1“, liefert das System den gespeicherten Ort „Hauptstraße 12“ als *sicher* zurück, weil nur geprüft wird, ob der Text irgendwo enthalten ist. Die KI liest die Adresse dann nicht einmal vor. Fahrgast- und Ortssuche laden nur die ersten 200/300 Zeilen ohne Sortierung – ab mittelgroßem Betrieb werden Stammkunden nicht gefunden und doppelt angelegt. Die Adresssuche im Internet (Geocoding) bekommt keinen Hinweis auf das Einsatzgebiet und findet „Kirchstraße 5“ in der Nachbarstadt.
- **Zu tun:**
  1. Ortsabgleich nur dann „sicher“, wenn Straße, Hausnummer **und** PLZ/Ort übereinstimmen; Teiltreffer → „nicht sicher“, KI liest vor und fragt nach.
  2. Fahrgast- und Ortssuche als Datenbankabfrage (`where` auf Name/Straße mit vorhandenem Index), nicht im Speicher über die ersten 300 Zeilen; Namensähnlichkeit (Levenshtein) nur als Zusatz mit Rückfrage.
  3. `serviceAreaCenter` des Mandanten als `near`-Parameter an `routingProvider.geocode()` übergeben, an allen drei Aufrufstellen.
- **Betroffene Dateien:** `src/core/voice/werkzeuge.ts`, `src/providers/routing/openRouteService.ts`, `src/app/dispo/fahrten/actions.ts`, `src/app/einrichtung/[schritt]/actions.ts`.
- **Erledigt damit:** S1-003, S2-006, S2-007.
- **Nachweis:** Die beiden Reproduktionsfälle aus Durchgang 1 („Hauptstraße 1“, „Aachen“) liefern „nicht sicher“ bzw. keinen Treffer; Test mit 500 Fahrgästen findet Zeile 412.
- **Status:** BEHOBEN (Behebung Durchgang 3).

#### M-07 Rückfahrt richtig anlegen: „Zeit offen“, Mitternacht, Doppelbuchungs-Ausnahme
- **Problem:** Bestellt ein Anrufer „mit Rückfahrt, Zeit weiß ich noch nicht“, wird die Rückfahrt stillschweigend verworfen – die KI meldet trotzdem „Fahrt erfasst“. Bei Serien fehlt die Rückfahrt dann für jeden Termin. Eine Rückfahrt nach Mitternacht landet am Tag der Hinfahrt, also 23 Stunden *vor* der Hinfahrt. Und beim Anlegen der Rückfahrt werden alle Fahrten des Fahrgasts mit exakt derselben Uhrzeit aus der Doppelbuchungsprüfung ausgeblendet, nicht nur die zugehörige Hinfahrt.
- **Zu tun:**
  1. Fachkonzept „Rückfahrt ja, Zeit offen“: Rückfahrt wird mit Kennzeichen `rueckfahrtZeitOffen` angelegt und landet in „Braucht Sie“; `rueckfahrt: true` ohne Zeit darf nicht mehr still durchrutschen (Validierung).
  2. Rückfahrtzeit kleiner als Hinfahrtzeit → Folgetag; Prüfung `rueckfahrt > hinfahrt` in der Validierung.
  3. Doppelbuchungs-Ausnahme über die Fahrt-ID der Hinfahrt (`returnOfId`), nicht über den Zeitwert.
- **Betroffene Dateien:** `src/core/rides/erfassen.ts`, `src/core/rides/validation.ts`, `src/core/rides/pruefungen.ts`, `src/core/rides/serie.ts`, `src/providers/voice/vapi.ts` (Werkzeugschema).
- **Erledigt damit:** S1-005, R1-2 „Doppelbuchungs-Ausnahme filtert nach Zeitwert statt Fahrt-Identität“, R1-3 „Rückfahrt über Mitternacht landet auf dem falschen Kalendertag“.
- **Nachweis:** Tests: `rueckfahrt: true, rueckfahrtzeit: ""` → zwei Fahrten, zweite mit Problem „Zeit offen“; Hinfahrt 23:30 / Rückfahrt 00:15 → Rückfahrt am Folgetag; zweite echte Fahrt zur selben Uhrzeit → `DOPPELBUCHUNG` gemeldet.
- **Status:** BEHOBEN (Behebung Durchgang 3), unter der Annahme 9a aus dem Behebungsprotokoll (Rückfahrt „Zeit offen“ mit Platzhalter Hinfahrt+4h) – noch nicht vom Auftraggeber bestätigt.

#### M-46 Zeitbezug für das Gespräch: aktuelles Datum, Uhrzeit und Zeitzone an die KI, Prüfung auf Vergangenheit und falsche Formate
- **Problem:** Die KI bekommt im Prompt kein aktuelles Datum und keine Uhrzeit mitgeteilt, muss aber absolute Werte liefern (S1-007). Zeit- und Datumsfelder der KI-Werkzeuge werden ungeprüft übernommen: „halb acht“ wird 00:00 Uhr, „0630“ vier Wochen später, „2026-02-30“ der 1. März (S2-020). Eine Fahrt für gestern oder mit Termin vor Abholung wird ohne Hinweis angelegt und disponiert.
- **Zu tun:**
  1. Prompt-Vorlage um „Heute ist <Wochentag, Datum>, es ist <Uhrzeit> Uhr, Zeitzone Europe/Berlin.“ ergänzen.
  2. `fahrtPruefen` um eine Prüfung „Abholzeit nicht in der Vergangenheit“ und „Termin nach Abholung“ ergänzen.
  3. Zod-Schemata für `datum`/`abholzeit`/`terminzeit`/`rueckfahrtzeit`/`bis` erzwingen das Format (Regex/Bereichsprüfung) statt nur `z.string()`.
  4. `berlinerMitternacht`/`mitUhrzeit` werfen bei ungültigem oder unauflösbarem Wert einen klaren Fehler statt zu raten.
- **Betroffene Dateien:** `src/core/notify/voicePrompt.ts`, `src/providers/voice/vapi.ts`, `src/core/rides/pruefungen.ts`, `src/core/rides/validation.ts`, `src/core/shifts/week.ts`, `src/core/voice/werkzeuge.ts`.
- **Erledigt damit:** S1-007, S2-020.
- **Nachweis:** Test, der den ausgelieferten Prompt auf „heute ist“ + Datum prüft; Tests für „halb acht“, „0630“, „25:00“, „2026-02-30“ → Fehler statt stille Umdeutung; Test „Abholzeit gestern“ wird abgelehnt.
- **Status:** BEHOBEN (Behebung M-46/M-47, Branch `claude/behebung-pilot-blocker`, Commits `e7a274f`, `5757d00`). Prompt nennt jetzt Wochentag/Datum/Uhrzeit/Zeitzone, `fahrtPruefen` lehnt Vergangenheit (Toleranz 15 Min., Annahme – Entscheidung ausstehend) und Termin-vor-Abholung ab, Zeitfelder sind streng geprüft (`DATUM`/`UHRZEIT`-Schemata), `week.ts` wirft bei ungültigen Werten. 55 neue Regressionstests grün, live gegen `next start` unter `TZ=UTC` nachgestellt (siehe Behebungsprotokoll). Code-Gegenlesen durch Projektleitung an `src/core/rides/pruefungen.ts` bestätigt die Beschreibung. **Von K. Berger noch nicht gegengeprüft** – Prüfdurchgang 4 lief gegen den Stand davor (`aa4e6e7`). Drei Entscheidungspunkte offen (Toleranzwert, Umgang mit Fahrten in der Vergangenheit im Büro, `docs/04` nachziehen), siehe Entscheidungsbündel.

#### M-47 Weiterleitung an einen Menschen real anbinden: Werkzeugname mit Vapi abgleichen, Rückfall als Fehler, Nummer validiert
- **Problem:** Der Prompt befiehlt das Werkzeug `an_mensch_weiterleiten`; dieses existiert in der an Vapi gesendeten Konfiguration nicht (dort `transferCall`). Kommt der Aufruf trotzdem an, antwortet das System „Wird weitergeleitet.“, ohne etwas zu tun. Eine leere oder national formatierte `escalationNumber` wird ungeprüft an Vapi durchgereicht (S2-019).
- **Zu tun:**
  1. Prompt und Werkzeugliste auf denselben Namen bringen (`transferCall` mit Ziel).
  2. Rückfall bei fehlender/leerer Nummer liefert einen Fehler statt „Wird weitergeleitet.“.
  3. `escalationNumber` beim Speichern auf E.164 normalisieren und validieren (zusammen mit M-21).
  4. Notfall-Stichwortliste im Prompt um Sturz, Schlaganfall-Zeichen, Suizidäußerung ergänzen (bisher nur „z. B.“).
- **Betroffene Dateien:** `src/core/notify/voicePrompt.ts`, `src/providers/voice/vapi.ts`, `src/core/voice/werkzeuge.ts`, `src/app/api/voice/webhook/route.ts`, `src/app/einrichtung/[schritt]/actions.ts`, `src/app/(auth)/registrieren/actions.ts`.
- **Erledigt damit:** S2-019 (berührt auch V-015).
- **Nachweis:** Live-Testanruf „ich will einen Menschen“ und der Notfall-Satz lösen einen tatsächlichen Transfer-Versuch bei Vapi aus (nicht nur eine „ok“-Antwort); Test, der eine leere/nationale `escalationNumber` beim Speichern abweist.
- **Status:** BEHOBEN (Behebung M-46/M-47, Branch `claude/behebung-pilot-blocker`, Commit `8745d1e`); echter Testanruf gegen Vapi steht noch aus. Prompt und Werkzeugliste nennen jetzt beide `transferCall`; ein fehlgeschlagener Versuch liefert einen Fehler mit 112-Hinweis statt Scheinerfolg; `escalationNumber` wird beim Speichern über `weiterleitungsnummerE164()` normalisiert und geprüft (E.164), leere/ungültige Nummern werden abgelehnt; Notfall-Stichwortliste um Sturz, Schlaganfall-Zeichen und Suizidäußerung ergänzt. 20 neue Regressionstests grün, live nachgestellt (siehe Behebungsprotokoll). Code-Gegenlesen durch Projektleitung an `src/core/einrichtung/rufnummer.ts` und `src/app/api/voice/webhook/route.ts` bestätigt die Beschreibung. **Von K. Berger noch nicht gegengeprüft.** Zwei Entscheidungspunkte offen (Verhalten bei KI aus ohne gültige Nummer, `docs/04` nachziehen) und der echte Testanruf gegen Vapi (kostet eine Testnummer, Geld – braucht ausdrückliche Zustimmung), siehe Entscheidungsbündel.

#### M-72 Manuelle Zuweisung nur an ein Fahrzeug mit laufender Schicht und einsatzfähigem Fahrer (Durchgang 4, neu)
- **Problem:** Weist der Disponent im Fahrt-Fenster ein Fahrzeug zu, für das gerade keine Schicht läuft, steht die Fahrt auf „disponiert“, hat aber keinen Fahrer – ohne Push, ohne Bestätigungs-SMS, ohne Kein-Fahrzeug-Alarm, und ohne dass sie in „Braucht Sie“ erscheint. Wählt er das Fahrzeug eines Fahrers, der „Ich falle aus“ gedrückt hat oder deaktiviert wurde (M-12), geht die Fahrt genau an diesen Fahrer zurück.
- **Zu tun:** Die manuelle Zuweisung muss dieselbe Kandidatenprüfung durchlaufen wie der Automodus (laufende Schicht, nicht ausgefallen, nicht deaktiviert) oder zumindest eine Warnung mit Bestätigung zeigen; eine Fahrt ohne einsatzfähigen Fahrer darf nicht als „disponiert ohne Alarm“ enden – entweder ablehnen oder sofort in den Kein-Fahrzeug-Alarm/„Braucht Sie“ einsortieren. Genaue Lösung mit dem Auftraggeber abstimmen (siehe Entscheidungsbündel).
- **Betroffene Dateien:** vermutlich `src/core/disposition/zuweisen.ts`, `src/app/dispo/fahrten/actions.ts`, Fahrt-Fenster-Komponente (genaue Dateien erst beim Beheben zu bestätigen).
- **Erledigt damit:** S1-008 (Berger Durchgang 4, Top-3-Befund 1).
- **Priorität:** P1 – Pilot-Blocker (Berger: S1; Fahrt kann ohne jeden Alarm ohne Fahrer bleiben, zusätzlich Fahrten können an ausgefallene/deaktivierte Fahrer zurückgehen).
- **Status:** OFFEN. Noch nicht beauftragt.

#### M-73 Serienpause/Serienänderung darf storniert angelegte Termine nicht unwiederbringlich löschen (Durchgang 4, neu)
- **Problem:** Verkürzt das Büro eine Serienpause nachträglich (z. B. weil der Patient früher aus dem Krankenhaus kommt), werden die schon stornierten Tage nie wieder angelegt. Dasselbe bei „Wochentage ändern und zurück“ und bei „versehentlich beendet, Enddatum wieder verlängert“. Die KI kann eine Serie am Telefon beenden (`serie_beenden`); rückgängig machen geht nicht – außer eine komplett neue Serie anzulegen.
- **Zu tun:** Serienänderungen (Pause, Wochentage, Enddatum, Beenden) dürfen bereits stornierte Termine nicht endgültig vernichten; entweder eine Wiederherstellungsfunktion schaffen oder (Mindestlösung) vor jeder destruktiven Serienänderung eine Bestätigung mit Vorschau zeigen, welche Termine endgültig verloren gehen. Genaue Lösung mit dem Auftraggeber abstimmen (siehe Entscheidungsbündel).
- **Betroffene Dateien:** vermutlich `src/core/rides/serie.ts`, `src/core/voice/werkzeuge.ts` (`serie_beenden`), Serien-Bearbeitungskomponenten im Büro (genaue Dateien erst beim Beheben zu bestätigen).
- **Erledigt damit:** S1-009 (Berger Durchgang 4, Top-3-Befund 2). Siehe auch M-22 (Serien bearbeiten/stoppen).
- **Priorität:** P1 – Pilot-Blocker (Berger: S1; dauerhafter, stiller Verlust von Dialyseterminen – lebenswichtige Fahrten).
- **Status:** OFFEN. Noch nicht beauftragt.

#### M-67 Büro-Funktion `fahrtStatusSetzen` entfernen oder auf die Fachfunktionen umleiten (keine Hintertür um Umplan- und Sicherheitsregeln) — **hochgestuft von P2 auf P1 (Durchgang 4, S3-034)**
- **Problem:** Die Server Action `fahrtStatusSetzen` setzt jeden laut Übergangstabelle erlaubten Status direkt, ohne Fahrzeug/Fahrer zu lösen, ohne Neuprüfung und ohne die Fahrer-Meldungen aus M-20 – z. B. DISPONIERT → ERFASST mit stehen gebliebener Zuweisung, oder ERFASST → DISPONIERT ohne Fahrzeug. Die Oberfläche ruft sie nicht auf; erreichbar ist sie trotzdem für jede angemeldete Büro-Sitzung (Server Actions sind von außen aufrufbar). Die Rollenprüfung ist vorhanden. **Durchgang 4 (S3-034):** Berger stuft dies als echte, nutzbare Hintertür um alle Dispositionsregeln ein, die aktuell nur durch die geheime Action-ID begrenzt ist (dieselbe Action-ID-Frage wie Verdacht V-001/V-013) – nicht nur ein theoretisches Risiko.
- **Zu tun:**
  1. Funktion entfernen, wenn sie nirgends gebraucht wird; sonst auf `fahrtAendern`/`fahrzeugZuweisungAufheben`/`fahrzeugZuweisen` umleiten, so dass dieselben Regeln gelten wie im normalen Ablauf.
  2. Test bzw. Quelltext-Prüfung, dass keine Büro-Action Status ohne diese Fachfunktionen setzt.
- **Betroffene Dateien:** `src/app/dispo/fahrten/actions.ts` (`fahrtStatusSetzen`), ggf. `src/core/rides/status.ts`.
- **Erledigt damit:** B3-A1 (Behebungsprotokoll Durchgang 3, „Auf dem Weg aufgefallen“ Nr. 1; dort Vorschlag 6, Empfehlung „jetzt“, Aufwand ca. 1 Stunde), S3-034 (Berger Durchgang 4, bestätigt und verschärft). Siehe auch M-20, V-001/V-013 (Action-ID).
- **Gegengelesen (Projektleitung, 31.10.2026, Stand `aa4e6e7`):** `fahrtStatusSetzen` ruft nach `requireBueroSession()` direkt `fahrtStatusAendern` auf; im Quelltext unter `src/` und `tests/` gibt es außer der Definition keinen Aufruf. Beobachtung bestätigt.
- **Priorität:** P1 – Pilot-Blocker (hochgestuft von P2 durch Berger Durchgang 4: reale, nutzbare Hintertür um die Umplan- und Sicherheitsregeln, nicht nur ein theoretisches Risiko).
- **Nachweis:** Funktion existiert nicht mehr bzw. Test: Aufruf mit DISPONIERT → ERFASST löst Fahrzeug und Fahrer und benachrichtigt den Fahrer genau einmal.
- **Status:** OFFEN.

### P2 – vor dem Pilot

#### M-08 Service Worker speichert nur die App-Hülle, löscht beim Abmelden
- **Problem:** Der Service Worker (Hintergrundprogramm der Fahrer-App für Offline-Betrieb) legt jede geladene Seite und jede Datei im Handy-Cache ab – darunter die Tagesansicht mit Fahrgastnamen und Telefonnummern und sogar die Abrechnungsdatei, wenn der Fahrer sie einmal geöffnet hat. Gelöscht wird nur, wenn die App an einem späteren Tag erneut geöffnet wird, nie beim Abmelden. Ein verkauftes oder verlorenes Handy trägt die Patientenliste weiter.
- **Zu tun:**
  1. Nur die App-Hülle (HTML-Gerüst, Skripte, Icons) cachen; nie `/api/*`, nie Seiten mit Fahrgastdaten.
  2. Geltungsbereich des Service Workers auf `/fahrer` begrenzen.
  3. Beim Abmelden `caches.delete()` für alle Caches und Löschen der `localStorage`-Warteschlange.
  4. Tages-Cache zeitgesteuert ablaufen lassen, nicht erst beim nächsten Aufruf.
- **Betroffene Dateien:** `public/sw.js`, `src/app/fahrer/ServiceWorkerRegistrar.tsx`, `src/components/SignOutButton.tsx`.
- **Erledigt damit:** S2-012 (live bestätigt), R3-10 „Service-Worker-Cache mit Fahrgast-PII kann die Ein-Tages-Frist überleben“.
- **Nachweis:** Playwright-Test: nach Login und Laden der Tagesansicht enthält `caches` keine Antwort mit Fahrgastnamen; nach Logout sind alle Caches leer.
- **Status:** TEILWEISE (Behebung Durchgang 3). Export/Dispo nicht mehr im Cache, Aufräumen bei jedem Aufwachen. Offen: Widerspruch „nie cachen“ (Maßnahme) vs. gewollter Offline-Tagesplan (docs/08) – RÜCKFRAGE, siehe Entscheidungsbündel Punkt 4.

#### M-09 Keine Telefonnummern und Adressen im Server-Protokoll
- **Problem:** Der SMS-Platzhalter und der Push-Ersatzweg schreiben Fahrer-Handynummer und Abholadresse („Neue Fahrt 06:30 Hauptstraße 12 → Dialyse“) in das Server-Protokoll, auch in Produktion. Das verstößt gegen die Projektregel und gegen den eigenen Sicherheitsbericht.
- **Zu tun:**
  1. Beide Log-Zeilen nur noch bei `istEntwicklung`, und dort ohne Rufnummer/Adresse (nur IDs).
  2. Push-Fallback ohne VAPID-Schlüssel wirft einen Fehler statt den Text zu loggen.
  3. Lint-Regel: kein `console.log` außerhalb `src/lib/logging`.
- **Betroffene Dateien:** `src/providers/sms/index.ts`, `src/core/notify/push.ts`.
- **Erledigt damit:** S2-009 (live bestätigt).
- **Nachweis:** Test mit `NODE_ENV=production` fängt `console.log` ab und erwartet keine Ausgabe mit `+49` oder Ortsnamen.
- **Status:** BEHOBEN (Behebung Durchgang 3).

#### M-10 Löschkonzept zu Ende denken: Fahrgastlöschung, Löschfristen, Gesprächszusammenfassung
- **Problem:** „Fahrgast löschen“ (Art. 17 DSGVO) anonymisiert nur die Fahrgast-Zeile. Name, Anrufernummer und Anliegen bleiben in der Gesprächszusammenfassung, in Ortsnamen („Wohnung Testmann“), in Fahrt-Hinweisen („Sauerstoffgerät“), in Serien-Vorlagen und in Benachrichtigungen stehen. Die Löschfristen räumen nur Audio und Transkript ab, nie Zusammenfassung und Rufnummer. Fehlt der Schlüssel zur Zusammenfassungs-KI, landet das Roh-Transkript im Klartext in der Zusammenfassung – dauerhaft und unverschlüsselt.
- **Zu tun:**
  1. `fahrgastAnonymisieren` erweitert auf `Call.summary`, `Call.fromNumber`, `Ride.assistanceNotes`, Orts-Labels des Fahrgasts, `RideSeries.template`, `Notification.toRef`, GPS-Koordinaten in `RideStatusEvent`.
  2. Löschfristen erfassen `summary` und `fromNumber` mit derselben Frist wie das Transkript.
  3. `summary` verschlüsselt speichern wie das Transkript; `kurzfassungOhneModell` abschaffen (bei Fehler: leere Zusammenfassung plus Hinweis, nicht das Transkript).
  4. Unterauftragnehmer-Liste in `docs/08` um die Zusammenfassungs-KI ergänzen.
- **Betroffene Dateien:** `src/core/passengers/loeschung.ts`, `src/core/datenschutz/loeschfristen.ts`, `src/core/notify/anrufZusammenfassung.ts`, `src/core/voice/anruf.ts`, `src/app/dispo/anrufe/actions.ts`.
- **Erledigt damit:** S2-016 (live bestätigt), S3-012 (live bestätigt, verschärft), S3-024 (live bestätigt).
- **Nachweis:** Der Reproduktionstest aus Durchgang 2 (vollständiger Datensatz, dann Anonymisierung und Löschfristen) findet anschließend keinen Namen, keine Rufnummer und keine Notiz mehr; `summary` ohne API-Schlüssel ist leer.
- **Status:** TEILWEISE (Behebung Durchgang 3). Löschung technisch umgesetzt. Offen: Umfang (Adress-Anonymisierung) und Unterauftragnehmer-Eintrag docs/08 – RÜCKFRAGE, siehe Entscheidungsbündel Punkt 3.

#### M-11 Mandantenprüfung für Fremdschlüssel in `withTenant()`
- **Problem:** `withTenant()` trennt die Mandanten auf der Zieltabelle sauber, prüft aber nicht, ob verknüpfte Zeilen (Fahrgast, Ort, Fahrer, Fahrzeug) zum selben Mandanten gehören. Mit einer fremden ID lässt sich eine Fahrt an den Fahrgast eines anderen Fahrdienstes hängen; Mandant A sieht dann dessen Namen und Geburtsdatum in seiner Fahrtliste, und Einsatzgebiets- und Genehmigungsprüfung werden still übersprungen.
- **Zu tun:**
  1. Bei `create`/`update` über `withTenant()` jede referenzierte ID (`passengerId`, `pickupPlaceId`, `dropoffPlaceId`, `driverId`, `vehicleId`) gegen den Mandanten prüfen; Fremdtreffer → Fehler.
  2. Aufrufer behandeln „nicht gefunden“ als Fehler, nicht als „keine Zusatzdaten“ (`erfassen.ts`, `werkzeuge.ts`, `schichtMusterAnlegen`, `genehmigungSpeichern`, `pushAboSpeichern`).
  3. `tests/db-tenant.test.ts` um Fremdschlüssel- und `include`-Fälle erweitern.
- **Betroffene Dateien:** `src/lib/db.ts`, `src/core/rides/erfassen.ts`, `src/core/voice/werkzeuge.ts`, `src/app/dispo/fahrer/actions.ts`, `src/app/dispo/fahrgaeste/actions.ts`.
- **Erledigt damit:** S2-008 (live bestätigt). Siehe auch M-45 (Sicherheitsbericht Punkt 1).
- **Nachweis:** Datenbanktest: `fahrtErfassen(tenantA, { passengerId: <B> })` → Fehler, keine Fahrt angelegt.
- **Status:** BEHOBEN (Behebung Durchgang 3) – jetzt per Datenbank-Trigger auf 13 Tabellen, nicht nur in der Anwendung. Ergänzung aus Prüfbericht Durchgang 3 (Fremdschlüssel über fahrzeugZuweisen/fahrtAendern) ist laut Protokoll durch denselben Trigger mitabgedeckt, aber nicht gegen diesen konkreten Befund erneut nachgeprüft worden.

#### M-12 Fahrer deaktivieren und Offboarding
- **Problem:** Es gibt keine Möglichkeit, einen Fahrer zu sperren. Ein gekündigter Fahrer hat mit seiner 30-Tage-Sitzung weiter vollen Zugriff auf Fahrten, Status, GPS und Push, bis der Admin jede einzelne Geräte-Sitzung von Hand findet und löscht.
- **Zu tun:**
  1. Feld `Driver.active` (bzw. `gesperrtAm`) einführen; Button „Fahrer deaktivieren“ in der Fahrer-Verwaltung.
  2. Deaktivieren löscht alle Sitzungen und Push-Abonnements des Fahrers, beendet laufende Schichten und entfernt ihn aus den Kandidaten.
  3. Jede Fahrer-Action prüft `active`.
  4. Bei Rollenwechsel (Fahrer wird Disponent) wird die Driver-Zeile deaktiviert.
- **Betroffene Dateien:** `prisma/schema.prisma`, `src/app/dispo/fahrer/actions.ts`, `src/app/fahrer/actions.ts`, `src/core/disposition/kandidaten.ts`, `src/lib/auth.ts`.
- **Erledigt damit:** R3-4 „Es gibt überhaupt keine Fahrer-Deaktivierung/Offboarding“.
- **Nachweis:** Test: nach Deaktivierung sind `Session`- und `PushSubscription`-Zeilen des Fahrers weg, Action-Aufruf → abgelehnt, Fahrer taucht in keinem Vorschlag auf.
- **Status:** BEHOBEN (Behebung Durchgang 3).

#### M-13 Identitätsbindung im Voice-Agent: Anrufernummer prüfen, Fahrt gehört zum Fahrgast
- **Problem:** Die KI am Telefon glaubt dem Anrufer seine Telefonnummer. Wer die Handynummer einer fremden Person kennt, erhält Geburtsdatum und Fahrgast-ID und kann anschließend deren Fahrten ansehen und stornieren. `fahrt_aendern` und `fahrt_stornieren` prüfen nicht, ob die Fahrt zum gerade erkannten Fahrgast gehört.
- **Zu tun:**
  1. Telefon-Suche nur mit der echten Anrufernummer aus dem Anruf, nie mit einer vom Sprachmodell genannten Nummer; genannte Nummer nur als Zusatzmerkmal mit Geburtsdatum-Abfrage.
  2. `fahrt_aendern`/`fahrt_stornieren`/`fahrt_finden` prüfen serverseitig `ride.passengerId === identifizierter Fahrgast` (Identität im Anruf-Kontext halten).
  3. System-Prompt: Identität vor Storno/Änderung bestätigen; Hinweis gegen Prompt-Injection.
  4. `rueckruf_anlegen` darf `Call.summary` nicht überschreiben, nur ergänzen.
- **Betroffene Dateien:** `src/core/voice/werkzeuge.ts`, `src/core/voice/voicePrompt.ts`, `src/providers/voice/vapi.ts`.
- **Erledigt damit:** S2-002, R2-11 „Voice-Agent-Werkzeuge prüfen keine Fahrgast-Eigentümerschaft der rideId“.
- **Nachweis:** Reproduktionstest aus Durchgang 1 (Anruf von +49111…, genannte Nummer +49222…) liefert keinen Treffer; `fahrt_stornieren` mit fremder `rideId` → abgelehnt.
- **Status:** BEHOBEN (Behebung Durchgang 3).

#### M-14 Webhook idempotent je `toolCallId`, Eingaben begrenzen, Serien-Anlage entkoppeln
- **Problem:** Schickt der Telefon-Anbieter denselben Aufruf zweimal (z. B. nach einem Netzwerk-Hänger), legt das System dieselbe Fahrt zweimal an – oder eine ganze Dialyse-Serie doppelt. Ungültiges JSON ergibt einen Serverfehler 500, worauf Anbieter typischerweise erneut senden; ein 6-MB-Body wird anstandslos angenommen. Der Geheimnisvergleich ist nicht zeitkonstant und es gibt keinen Schutz gegen Wiederholung. Eine Serie mit 12 Terminen löst im Webhook rund 500 Routing-Aufrufe aus (bestätigt), dauert 50–150 s und läuft damit in den Zeitlimit des Anbieters – der dann wiederholt.
- **Zu tun:**
  1. Tabelle oder Feld für verarbeitete `toolCallId`s; zweiter Aufruf liefert das gespeicherte Ergebnis zurück, legt nichts an.
  2. JSON-Fehler und falscher Content-Type → HTTP 400; Body-Limit (z. B. 256 KB).
  3. Geheimnisvergleich mit `crypto.timingSafeEqual`; HMAC-Signatur mit Zeitstempel, sobald Vapi das anbietet.
  4. `serie_anlegen` legt nur die Serie an und antwortet sofort; die einzelnen Fahrten mit Vorschlagsrechnung erzeugt ein Hintergrundlauf (`serienVerlaengern`). Routing-Aufrufe je Kandidat begrenzen; stiller Luftlinien-Rückfall bei 429 wird als Problem gemeldet.
  5. `end-of-call-report` doppelt → zweiter Aufruf wird ignoriert (kein zweiter KI-Aufruf).
- **Betroffene Dateien:** `src/app/api/voice/webhook/route.ts`, `src/core/voice/werkzeuge.ts`, `src/core/rides/serie.ts`, `src/providers/routing/openRouteService.ts`, `src/providers/voice/vapi.ts`, alle `src/app/api/cron/*/route.ts` (Geheimnisvergleich).
- **Erledigt damit:** S2-014 (live bestätigt), S3-016 (live bestätigt), S4-007 (live bestätigt), V-005 (bestätigt). Siehe auch V-011 (Verdacht, Vapi-Retry).
- **Nachweis:** Replay-Test aus Durchgang 2: identischer Webhook zweimal → genau eine Fahrt; kaputtes JSON → 400; Mock-Zählung der Routing-Aufrufe je Serien-Webhook ≤ 1 je Termin.
- **Status:** TEILWEISE (Behebung Durchgang 3). Zeitkonstanter Geheimnisvergleich, Serien-Anlage im Hintergrund. Offen: HMAC/Wiederholungsschutz (abhängig von Vapi, siehe V-011), Routing-Grenze je Kandidat, 429-Rückfall als Problem – RÜCKFRAGE, siehe Entscheidungsbündel Punkt 7.

#### M-15 Eskalation je Zuweisung statt je Fahrt, nur für zeitnahe Fahrten
- **Problem:** Der Alarm „Fahrer hat nicht bestätigt“ feuert pro Fahrt genau einmal. Wird die Fahrt danach einem anderen Fahrer gegeben, der ebenfalls nicht reagiert, kommt kein zweiter Alarm und kein Inhaber-Alarm – nachts steht niemand vor der Tür. Umgekehrt feuert die SMS schon zwei Minuten nach jeder Zuweisung, auch für Fahrten nächste Woche: beim Plan für morgen gehen 90 SMS auf einmal raus, die Fahrer stumpfen ab.
- **Zu tun:**
  1. Dedup-Schlüssel der Benachrichtigung auf `(rideId, driverId, Zuweisungszeitpunkt)` umstellen, für `KEINE_BESTAETIGUNG_FAHRER` und `KEINE_BESTAETIGUNG_INHABER`; `fahrzeugZuweisen` setzt beim Fahrerwechsel die Eskalation zurück.
  2. Eskalation nur, wenn die Fahrt in weniger als 60 Minuten beginnt (laut `docs/05`), mit 5 Minuten Frist; Fahrten für später werden erst in diesem Fenster geprüft.
  3. Gleiches Muster für `keinFahrzeugAlarmPruefen`.
- **Betroffene Dateien:** `src/core/notify/eskalation.ts`, `src/core/disposition/zuweisen.ts`, `prisma/schema.prisma` (Notification-Index).
- **Erledigt damit:** S2-017 (live bestätigt), R2-8 „Eskalations-SMS-Dedup ist für immer an die rideId gebunden“, S3-006.
- **Nachweis:** Reproduktionstest aus Durchgang 2: Fahrer 1 eskaliert, Umbesetzung auf Fahrer 2, 5 Minuten → `smsAnFahrer` 1 für Fahrer 2; Zuweisung für morgen → keine SMS.
- **Status:** BEHOBEN (Behebung Durchgang 3), unter der Annahme 9b (Fahrer- und Inhaber-Alarm im selben Lauf nach 5 Minuten) – noch nicht vom Auftraggeber bestätigt; siehe auch Widerspruch docs/02 vs. docs/05 (Entscheidungsbündel Punkt 8).

#### M-16 Cron-Läufe: Laufsperre, Fehlerisolierung je Fahrt, Laufprotokoll und Alarm
- **Problem:** Die Nachtautomatik und „Plan für morgen“ laufen jede Minute. Bricht eine einzelne Fahrt mit einem unerwarteten Fehler ab, bleibt die gesamte restliche Liste des Fahrdienstes liegen – jede Minute erneut, bis zum Morgen, ohne dass jemand es erfährt. „Plan für morgen“ setzt sein „heute schon gelaufen“-Kennzeichen erst nach dem Lauf; dauert der Lauf länger als eine Minute oder wirft er, rechnet der nächste Takt alles noch einmal und erzeugt doppelte Vorschläge und konkurrierende Zuweisungen.
- **Zu tun:**
  1. Laufsperre je Cron und Mandant (`pg_advisory_lock` oder `Job`-Tabelle mit Status): ein zweiter Lauf beendet sich sofort.
  2. `try/catch` um jede einzelne Fahrt; Fehler wird protokolliert (nur IDs), die Fahrt bekommt `autoSkipReason`, die Schleife läuft weiter.
  3. `planFuerMorgenLauf` am Anfang des Laufs setzen (oder in der `Job`-Tabelle), nicht erst am Ende.
  4. Zeitstempel „letzter erfolgreicher Lauf“ je Cron und Mandant; fehlt er länger als 15 Minuten → Alarm an den Inhaber (nach M-03 per SMS).
  5. `Promise.all` über Mandanten durch `allSettled` ersetzen: ein Mandant blockiert nicht die anderen.
- **Betroffene Dateien:** `src/core/disposition/automatischDisponieren.ts`, `src/core/disposition/planFuerMorgen.ts`, `src/app/api/cron/automodus/route.ts`, `src/app/api/cron/planFuerMorgen/route.ts`, `prisma/schema.prisma`.
- **Erledigt damit:** S2-010, R2-3 „planFuerMorgen setzt sein ‚heute schon gelaufen‘-Flag nie, wenn die Schleife wirft“, S3-011. Siehe auch M-04 (Zuweisung selbst) und V-002 (Verdacht, Vercel-Überlappung).
- **Nachweis:** Test: Fahrt 3 von 5 wirft → Fahrten 4 und 5 werden trotzdem bearbeitet; zwei parallele Läufe → genau einer arbeitet; Laufprotokoll-Zeile vorhanden.
- **Status:** BEHOBEN (Behebung Durchgang 3). Ergänzung aus Prüfbericht Durchgang 3 (gleiches Doppellauf-Muster in `serienVerlaengern`, S3-011) noch nicht erneut gegen die neue Sperre geprüft.

#### M-17 Automodus-Bedingungen für Vorausplanung neu fassen (GPS-Frische gilt nur für Sofortfahrten)
- **Problem:** Die Nachtautomatik verlangt für jede zweite Fahrt eines Fahrzeugs eine GPS-Position, die höchstens 10 Minuten alt ist – um 3 Uhr nachts, für Fahrten am nächsten Morgen. Das ist nie erfüllbar, weil die Fahrer-App nur bei geöffnetem Browser GPS sendet. Ergebnis: nachts wird fast nur die erste Fahrt je Fahrzeug disponiert, morgens liegt derselbe Berg wie ohne System in „Braucht Sie“. Die Demo umgeht das mit künstlichen GPS-Zeilen.
- **Zu tun:**
  1. Unterscheidung Sofort-Disposition (Fahrt in < 60 Minuten: GPS-Frische gilt) und Vorausplanung (Fahrt später: Startort ist Betriebshof bzw. Zielort der vorherigen geplanten Fahrt, kein GPS nötig).
  2. `docs/05` Bedingung 3 entsprechend präzisieren; Demo-Umgehung in `betriebSimulieren.ts` entfernen.
- **Betroffene Dateien:** `src/core/disposition/automatischDisponieren.ts`, `src/core/disposition/planFuerMorgen.ts`, `src/core/demo/betriebSimulieren.ts`, `docs/05-disposition.md`.
- **Erledigt damit:** S2-003.
- **Nachweis:** Test: 3 Fahrten für morgen auf ein Fahrzeug ohne GPS-Daten → alle drei im Automodus disponiert, sofern die übrigen Bedingungen erfüllt sind; Fahrt in 30 Minuten ohne GPS → weiterhin `autoSkipReason`.
- **Status:** TEILWEISE (Behebung Durchgang 3). GPS-Bedingung für Vorausplanung korrigiert. Offen: docs/05 präzisieren, Demo-GPS-Umgehung – RÜCKFRAGE, siehe Entscheidungsbündel Punkt 6.

#### M-18 Nachtschichten über Mitternacht abbilden
- **Problem:** Eine Schicht 22:00–06:00 wird mit Ende *vor* Beginn gespeichert. Nachts findet das System deshalb nie einen Fahrer im Dienst – genau dann, wenn der Automodus arbeiten soll.
- **Zu tun:**
  1. Liegt die Endzeit vor der Startzeit, endet die Schicht am Folgetag (`tagVerschieben` aus `week.ts`).
  2. Validierung `end > start` nach dieser Umrechnung; Formular zeigt „bis 06:00 (Folgetag)“.
  3. Alle Kandidatenfilter und `findeAktiveSchicht` mit einer Mitternachtsschicht testen.
- **Betroffene Dateien:** `src/app/dispo/fahrer/actions.ts`, `src/core/drivers/validation.ts`, `src/core/shifts/dauer.ts`, `src/app/dispo/fahrer/FahrerClient.tsx`.
- **Erledigt damit:** S2-004. Siehe auch M-37 (CHECK-Constraint auf Datenbankebene).
- **Nachweis:** Reproduktionstest aus Durchgang 1: Muster 22:00–06:00 → `findeAktiveSchicht` um 02:00 liefert die Schicht.
- **Status:** BEHOBEN (Behebung Durchgang 3).

#### M-19 Stornieren nur vor der Abholung, abhängig vom Status
- **Problem:** Eine Fahrt lässt sich stornieren, während der Fahrgast schon im Fahrzeug sitzt – aus der Dispo-Oberfläche, aus der DSGVO-Löschung und über die KI am Telefon. Die Fahrt verschwindet dann einfach vom Handy des Fahrers, mit derselben Meldung wie ein Storno vor Abholung.
- **Zu tun:**
  1. Übergänge `UNTERWEGS → STORNIERT` und `AN_BORD → STORNIERT` aus der Übergangstabelle entfernen; stattdessen „Fahrt abgebrochen“ als eigener Vorgang nur für das Büro, mit eigener Push-Meldung und Rückfrage.
  2. Voice-Agent: Storno nur für Fahrten mit Status `ERFASST`/`VORGESCHLAGEN`/`DISPONIERT`; sonst Weiterleitung an einen Menschen.
  3. Dispo-Oberfläche: Storno-Knopf bei laufender Fahrt ausblenden bzw. deutlich anders beschriften.
- **Betroffene Dateien:** `src/core/rides/stornieren.ts`, `src/core/rides/status.ts`, `src/app/dispo/fahrten/TripModal.tsx`, `src/core/passengers/loeschung.ts`, `src/core/voice/werkzeuge.ts`.
- **Erledigt damit:** R3-3 „Stornieren ist aus jedem Status erlaubt, auch AN_BORD“.
- **Nachweis:** Test: `fahrtStornieren` bei `AN_BORD` → abgelehnt; Voice-Werkzeug bei `UNTERWEGS` → Hinweis „bitte an Mitarbeiter“.
- **Status:** BEHOBEN (Behebung Durchgang 3), unter der Annahme 9c (eigener Zustand „Fahrt abbrechen“ statt neuem Status) – noch nicht vom Auftraggeber bestätigt.

#### M-20 Umplanen und Umbesetzen aufräumen: Vorschlag bleibt Vorschlag, alte Zuweisung wird gelöscht, Probleme werden bereinigt, nur eine Push
- **Problem:** Wer im Zeitstrahl einen noch unbestätigten Vorschlag nur leicht in der Zeit verschiebt, macht ihn ungefragt zur festen Zuweisung – der Bestätigungsschritt entfällt, der Fahrer bekommt „Neue Fahrt“. Fällt ein Fahrer aus oder wird eine Fahrt geändert, bleiben Fahrzeug und Fahrer an der Fahrt stehen: die Fahrt klebt visuell am falschen Wagen, der Konfliktcheck hält das Fahrzeug für belegt, der Fahrer sieht die Fahrt weiter mit irreführender Meldung. Die Problemliste einer Fahrt wächst nur, wird nie bereinigt – Fahrten hängen dauerhaft in „Braucht Sie“ mit längst überholtem Grund. Bei kombinierter Zeit-und-Fahrer-Änderung bekommt derselbe Fahrer erst „geändert“, dann „entzogen“.
- **Zu tun:**
  1. `fahrtVerschieben`: Verschieben eines `VORGESCHLAGEN`-Chips ändert nur die Zeit und rechnet den Vorschlag neu; `fahrzeugZuweisen` nur bei Zeilenwechsel oder ausdrücklicher Bestätigung.
  2. `fahrerFaelltAusKern` und `fahrtAendern` setzen `vehicleId`/`driverId`/`driverAckAt` auf `null` (wie `fahrzeugZuweisungAufheben`); nach Adress-/Zeitänderung läuft `fahrtPruefen` erneut.
  3. `problems[]` wird bei jeder Neuprüfung komplett neu berechnet, nicht ergänzt; `fahrtAendern` behandelt Status `PROBLEM` und führt zurück in die Vorschlagspipeline.
  4. Eine Änderung = eine Push: `fahrtAendern` und `fahrzeugZuweisen` sammeln Benachrichtigungen und schicken pro Fahrer genau eine passende Meldung („entzogen“ schlägt „geändert“).
  5. Push-Text bei Entzug korrekt („Fahrt 09:30 wurde dir entzogen“), nicht „geändert, App öffnen“.
- **Betroffene Dateien:** `src/app/dispo/fahrten/actions.ts` (`fahrtVerschieben`), `src/app/dispo/fahrten/Zeitstrahl.tsx`, `src/core/rides/fahrerAusfall.ts`, `src/core/rides/aendern.ts`, `src/core/disposition/zuweisen.ts`, `src/core/disposition/vorschlagSpeichern.ts`, `src/core/rides/erfassen.ts`.
- **Erledigt damit:** R2-4 „Reine Zeit-Verschiebung eines unbestätigten Vorschlags macht ihn ungefragt zur echten Zuweisung“, R2-5 „fahrerFaelltAusKern räumt vehicleId/driverId nie ab“, R2-6 „problems[] ist (fast) nur additiv“, R2-9 „Widersprüchliche Doppel-Push bei kombinierter Zeit+Fahrzeug-Verschiebung“, S3-004. Siehe auch M-34 (Bearbeiten in der Oberfläche), M-67 (`fahrtStatusSetzen` umgeht diese Regeln) und M-69 (Verdacht: „Fahrzeug ändern“ im Fahrt-Fenster).
- **Nachweis:** Tests: Zeitverschiebung eines Vorschlags → Status bleibt `VORGESCHLAGEN`, keine Push; Fahrerausfall → `vehicleId === null`; Fahrt mit altem „Fahrer fällt aus“-Problem nach Neubesetzung → `problems` leer; kombinierte Änderung → genau eine Push je Fahrer.
- **Status:** BEHOBEN (Behebung Durchgang 3), unter den Annahmen 9d – noch nicht vom Auftraggeber bestätigt.

#### M-21 Zentrale Telefonnormalisierung beim Schreiben (E.164)
- **Problem:** Telefonnummern aus Oberfläche und Import werden unverändert gespeichert („0171 2345678“), die KI sucht aber nur das Normalformat („+491712345678“). Kein einziger im Büro angelegter oder importierter Stammkunde wird am Telefon erkannt; jeder Anruf legt eine Dublette ohne Genehmigung an, der Automodus disponiert nichts. Die Normalisierungsfunktion selbst ist fehlerhaft (bestätigt): „0049 171 …“ wird zu „+490491…“, eine niederländische Nummer wird deutsch.
- **Zu tun:**
  1. `telefonNormalisieren` auf eine Bibliothek nach E.164-Standard (internationales Rufnummernformat) umbauen, z. B. `libphonenumber-js`, mit Standardland DE.
  2. Normalisierung beim **Schreiben** in `fahrgastSpeichern`, `fahrgaesteImportieren`, `fahrerEinladen`, `fahrerImportieren` und in der KI; Suche ebenfalls über den normalisierten Wert.
  3. Migration, die alle vorhandenen `Passenger.phones` und Fahrer-Rufnummern einmalig normalisiert.
- **Betroffene Dateien:** `src/core/passengers/validation.ts`, `src/core/voice/werkzeuge.ts`, `src/app/dispo/fahrgaeste/actions.ts`, `src/app/dispo/fahrten/actions.ts`, `src/lib/telefon.ts` (bzw. Ort von `telefonNormalisieren`), `prisma/migrations/`.
- **Erledigt damit:** S2-013 (live bestätigt), V-006 (bestätigt). Siehe auch M-35 (Fahrer-Rufnummer je Mandant).
- **Nachweis:** Tests für alle Formate aus Durchgang 2 („0049 171 …“, „+49 (0) 171 …“, „0031…“) ergeben die korrekte E.164-Nummer; Datenbanktest: Fahrgast über Oberfläche mit „0171 2345678“ gespeichert → KI-Suche findet ihn.
- **Status:** BEHOBEN (Behebung Durchgang 3).

#### M-22 Serien beenden, pausieren und ändern
- **Problem:** Eine Dialyse-Serie läuft nach Anlage unverändert bis zum Enddatum weiter – auch nach Umzug, Zentrumswechsel oder Tod. Es gibt weder in der Oberfläche noch für die KI eine Funktion, eine Serie zu beenden oder anzupassen; nachts entstehen immer neue Fahrten. Einziger Ausweg ist, jeden Termin einzeln zu stornieren oder den Fahrgast zu löschen.
- **Zu tun:**
  1. Funktionen `serieBeenden(ab Datum)`, `seriePausieren(von, bis)` und `serieAendern(Vorlage)` in `core/rides/serie.ts`; Beenden storniert alle künftigen Fahrten der Serie.
  2. Oberfläche: Serien beim Fahrgast anzeigen mit „Beenden“/„Ändern“.
  3. KI-Werkzeug `serie_beenden` mit Identitätsprüfung (M-13).
- **Betroffene Dateien:** `src/core/rides/serie.ts`, `src/app/dispo/fahrgaeste/**`, `src/core/voice/werkzeuge.ts`, `src/providers/voice/vapi.ts`.
- **Erledigt damit:** S2-005, R2-10 „Serien (RideSeries) haben keine Bearbeiten/Vorzeitig-Stoppen-Funktion“.
- **Nachweis:** Test: Serie beenden → künftige Fahrten `STORNIERT`, `serienVerlaengern` erzeugt keine neuen.
- **Status:** BEHOBEN (Behebung Durchgang 3), unter der Annahme 9e – noch nicht vom Auftraggeber bestätigt.

#### M-23 Registrierung und Rufnummern-Zuordnung absichern, Mehrzeilen-Schreibvorgänge in Transaktionen
- **Problem:** Jeder kann ohne Bestätigung beliebig viele Fahrdienste anlegen und jede beliebige Rufnummer als „seine“ KI-Nummer eintragen – wer schneller ist als der echte Kunde, erhält dessen Anrufe samt Fahrgastdaten. Zwei gleichzeitige Registrierungen mit derselben E-Mail hinterlassen zwei Firmen und einen Nutzer (bestätigt). Dasselbe Muster „mehrere Zeilen ohne Transaktion“ steckt in `fahrerEinladen` (Nutzer ohne Fahrerprofil) und `fahrtErfassen` (halbe Fahrt als `ENTWURF`).
- **Zu tun:**
  1. Rufnummern werden nur vom Dispona-Betreiber einem Mandanten zugewiesen (Admin-Werkzeug), nicht vom Kunden frei eingetragen.
  2. Registrierung: E-Mail-Bestätigung vor Freischaltung, Ratenbegrenzung, Formatprüfung; `tenant.create` + `user.create` in einer Transaktion; zweite Anfrage → verständliche Fehlermeldung statt 500.
  3. `fahrerEinladen` und `fahrtErfassen` (Hin- und Rückfahrt, Suggestion) ebenfalls in `$transaction`.
- **Betroffene Dateien:** `src/app/(auth)/registrieren/actions.ts`, `src/app/einrichtung/[schritt]/actions.ts`, `src/core/voice/mandant.ts`, `src/app/dispo/fahrer/actions.ts`, `src/core/rides/erfassen.ts`.
- **Erledigt damit:** S2-011 (live bestätigt, verschärft), S3-020 (live bestätigt), S4-009 (live bestätigt). Siehe auch M-04.
- **Nachweis:** Test: zwei parallele `firmaRegistrieren` mit gleicher E-Mail → 1 Tenant, 1 User, zweiter Aufruf mit klarer Meldung; `kiNummerSpeichern` ohne Betreiber-Rolle → abgelehnt.
- **Status:** TEILWEISE (Behebung Durchgang 3). Registrierung atomar, Ratenbegrenzung ergänzt. Offen: wer Rufnummern zuordnet, E-Mail-Bestätigung – RÜCKFRAGE, siehe Entscheidungsbündel Punkt 2.

#### M-48 Serienfahrten mit Startdatum anlegen
- **Problem:** Serien haben kein Startdatum; jede Serie beginnt heute bzw. am nächsten passenden Wochentag, auch wenn der Fahrgast erst in zwei Wochen beginnt; ein Enddatum in der Vergangenheit wird trotzdem mit „Serie angelegt“ bestätigt (S2-018).
- **Zu tun:** Feld „ab“ (Startdatum) im Serien-Schema, am Telefon-Werkzeug `serie_anlegen` und im Formular ergänzen; Terminerzeugung erst ab diesem Datum; `bis` muss ≥ „ab“/heute sein, sonst Rückfrage statt stiller Bestätigung.
- **Betroffene Dateien:** `src/core/rides/validation.ts`, `src/core/rides/serie.ts`, `src/providers/voice/vapi.ts`, `src/app/dispo/DispoClient.tsx`, `src/core/voice/werkzeuge.ts`.
- **Erledigt damit:** S2-018.
- **Nachweis:** Test „Serie ab +14 Tage, Mo/Mi/Fr“ → erste Fahrt am Startdatum, keine davor; Test „bis in der Vergangenheit“ → abgelehnt statt „0 Fahrten erzeugt“.
- **Status:** OFFEN. Am 31.10.2026 ausdrücklich **nicht** zur Behebung beauftragt (Entscheidung Auftraggeber: nur M-46/M-47).

#### M-49 Stornierte Fahrten im Zeitstrahl und in den Kennzahlen als storniert erkennbar machen
- **Problem:** Storno ändert nur den Status; Fahrzeug/Fahrer bleiben zugeordnet, der Zeitstrahl kennt keinen eigenen Darstellungszustand für Endzustände und zeigt stornierte Fahrten wie geplante; „Fahrten heute“ zählt sie mit (S2-023).
- **Zu tun:** Storno räumt Fahrzeug/Fahrer ab (wie beim Fahrerausfall, M-20); `zustandFuerFahrt()` bekommt einen eigenen Fall für „storniert“; Kennzahl „Fahrten heute“ filtert aktive Status.
- **Betroffene Dateien:** `src/core/rides/stornieren.ts`, `src/core/rides/status.ts`, `src/app/dispo/fahrten/actions.ts`, `src/app/dispo/fahrten/Zeitstrahl.tsx`, `src/core/rides/transportfarbe.ts`.
- **Erledigt damit:** S2-023.
- **Nachweis:** Test, dass eine stornierte Fahrt danach kein Fahrzeug mehr zugeordnet hat und im Zeitstrahl als „storniert“ statt „geplant“ erscheint.
- **Status:** OFFEN. Am 31.10.2026 ausdrücklich **nicht** zur Behebung beauftragt (Entscheidung Auftraggeber: nur M-46/M-47).

#### M-50 Fahrgast-Import robust: deutsche Datumsformate, Zeichensatz-Wahl, Dubletten, Transaktion je Zeile
- **Problem:** `new Date("03.05.1941")` vertauscht Tag und Monat; `new Date("25.12.1950")` bricht den Import mitten in der Datei ab; Excel-„CSV“ in Windows-1252 zerstört Umlaute; keine Dublettenprüfung, kein Rückgängig (S2-021).
- **Zu tun:** Explizites Datumsformat TT.MM.JJJJ beim Parsen statt `new Date(string)`; Fehler je Zeile sammeln statt abzubrechen; Zeichensatz-Auswahl oder -Erkennung vor dem Parsen; einfache Dublettenprüfung; Import in einer Transaktion oder mit Rückgängig.
- **Betroffene Dateien:** `src/app/dispo/fahrgaeste/actions.ts`, `src/core/passengers/validation.ts`, `src/components/CsvImport.tsx`.
- **Erledigt damit:** S2-021.
- **Nachweis:** Test mit „03.05.1941“/„25.12.1950“ in einer Datei → beide korrekt gespeichert, kein Abbruch; Test mit Windows-1252-Bytes → Umlaute korrekt; zweiter Import derselben Datei → keine neuen Dubletten.
- **Status:** OFFEN. Am 31.10.2026 ausdrücklich **nicht** zur Behebung beauftragt (Entscheidung Auftraggeber: nur M-46/M-47).

#### M-51 Fahrer-App zeigt das Datum je Fahrt, unterscheidet heute und morgen eindeutig
- **Problem:** Liste und Push zeigen nur Uhrzeiten; eine Fahrt von morgen erscheint als „nächste Fahrt“ mit „Zum Fahrgast fahren“, „Heute N Fahrten“ zählt auch morgige, `laufendeSchicht` fällt auf die Schicht von morgen zurück (S2-022).
- **Zu tun:** Datum (oder „Heute“/„Morgen“) an jeder Fahrt und im Push-Vollbild anzeigen; Kennzahl „Heute“ nur für heutige Fahrten; `laufendeSchicht` nie auf eine künftige Schicht zurückfallen lassen.
- **Betroffene Dateien:** `src/app/fahrer/FahrerClient.tsx`, `src/app/fahrer/GesehenUeberlagerung.tsx`, `src/app/fahrer/actions.ts`.
- **Erledigt damit:** S2-022.
- **Nachweis:** Rendering-Probe mit einer Fahrt heute und einer morgen → beide mit unterscheidbarem Datum; „Schicht starten“ nicht für die Schicht von morgen möglich.
- **Status:** OFFEN. Am 31.10.2026 ausdrücklich **nicht** zur Behebung beauftragt (Entscheidung Auftraggeber: nur M-46/M-47).

#### M-52 Serverregion EU/Frankfurt festschreiben
- **Problem:** `vercel.json` und `next.config.ts` legen keine Function-Region fest; Vercel-Standard ist USA; widerspricht CLAUDE.md und `docs/08` („nur Server in der EU“) (S2-024).
- **Zu tun:** Region (`fra1`) im Vercel-Projekt bzw. in der Konfiguration festlegen; Neon-Region prüfen und in `docs/12` eintragen (Doku-Änderung nur mit Freigabe).
- **Betroffene Dateien:** `vercel.json`, `next.config.ts`, `docs/12-betrieb.md` (Freigabe nötig).
- **Erledigt damit:** S2-024.
- **Nachweis:** Eintrag der Region in der Konfiguration bzw. im Vercel-Dashboard; Eintrag in `docs/12`.
- **Status:** OFFEN. Entscheidung beim Auftraggeber: Vercel-Projekteinstellung auf EU/Frankfurt setzen – siehe Entscheidungsbündel.

#### M-66 Fahrer-SMS und -Push ohne frei vergebene Ortsnamen (kein Fahrgastname über das Wohnort-Label)
- **Problem:** Die Texte „Neue Fahrt …“ an Fahrer (SMS und Push) enthalten den gespeicherten Namen des Abhol- und Zielorts (der Teil vor dem ersten Komma). Dieser Name ist freier Text; Wohnorte heißen in Bestandsdaten teils „Wohnung <Nachname>“. Damit kann der Fahrgastname auf dem Sperrbildschirm des Fahrerhandys und beim SMS-Anbieter landen – entgegen der Projektregel „Push/SMS an Fahrer nur Uhrzeit und Ort, kein Name“. Anonymisiert wird das Label bisher erst bei einer Fahrgast-Löschung (M-10).
- **Zu tun:**
  1. Fahrer-Texte nicht mehr aus dem frei vergebenen Ortsnamen bilden; bei Wohnorten (Typ `WOHNUNG`) höchstens Ortstyp oder Straße/Ort aus den strukturierten Feldern verwenden (Vorschlag Behebung: Ortstyp statt Label). Welche Angabe der Fahrer sieht, ist sichtbares Produktverhalten – Variante beim Beauftragen mit dem Auftraggeber festlegen.
  2. Test, dass ein Ort „Wohnung <Name>“ in keinem Fahrer-Text erscheint, für alle Aufrufstellen von `neueFahrtText`.
- **Betroffene Dateien:** `src/core/notify/texte.ts` (`neueFahrtText`, `kurzOrt`), `src/core/notify/eskalation.ts`, `src/core/rides/fahrerBenachrichtigen.ts`.
- **Erledigt damit:** B3-A2 (Behebungsprotokoll Durchgang 3, „Auf dem Weg aufgefallen“ Nr. 2; dort Vorschlag 8), S2-025 (Berger Durchgang 4, Top-3-Befund 3, erster Teil – bestätigt mit den Beispielen „Wohnung Müller“/„Müller, Hans“). Siehe auch M-10 (Löschung), M-09 (Logs).
- **Gegengelesen (Projektleitung, 31.10.2026, Stand `aa4e6e7`):** `neueFahrtText` setzt `kurzOrt(label)` ein; Aufrufe in `eskalation.ts` und `fahrerBenachrichtigen.ts` übergeben `pickupPlace.label`/`dropoffPlace.label`. Die Löschfunktion vermerkt selbst, dass Wohnort-Namen den Fahrgastnamen tragen können. Beobachtung bestätigt.
- **Priorität:** P2 – vor dem Pilot (Datenschutz, Verstoß gegen eine feste Projektregel). Vom Auftraggeber so vorgeschlagen und akzeptiert; Einstufung nach Gegenlesen beibehalten; durch Berger Durchgang 4 (S2-025) unabhängig bestätigt.
- **Nachweis:** Test mit Wohnort-Label „Wohnung Testname“ → Text an den Fahrer enthält „Testname“ nicht.
- **Status:** OFFEN.

*(M-67 ist nach Durchgang 4 (S3-034) nach P1 – Pilot-Blocker hochgestuft und dorthin verschoben; siehe oben, direkt vor diesem Abschnitt.)*

#### M-74 KI liest unbekannten Anrufern volle Adresse und Ortsbezeichnung ungeprüft vor (Durchgang 4, neu)
- **Problem:** Nennt ein Anrufer am Telefon eine Adresse oder eine Ortsbezeichnung wie „Hauptstraße 5“ oder „Wohnung Müller“, liest die KI Bezeichnung und volle Adresse vor – ohne vorher zu prüfen, ob der Anrufer überhaupt zu diesem Fahrgast/Ort gehört. Damit kann ein unbekannter Anrufer, der nur eine Adresse rät oder von woanders kennt, Ortsbezeichnungen (die laut M-66/S2-025 Fahrgastnamen tragen können) und volle Adressen weiterer Fahrgäste abfragen.
- **Zu tun:** Die Adress-/Ortsauskunft am Telefon muss an eine bestätigte Identität gebunden werden (ähnliches Muster wie M-13 – Identitätsbindung über die echte Anrufernummer), bevor eine volle Adresse oder ein Ortsname vorgelesen wird; genaue Lösung mit dem Auftraggeber abstimmen.
- **Betroffene Dateien:** vermutlich `src/core/voice/werkzeuge.ts` (`ort_suchen`/Adressauskunft), `src/core/notify/voicePrompt.ts` (genaue Dateien erst beim Beheben zu bestätigen).
- **Erledigt damit:** S2-026 (Berger Durchgang 4, Top-3-Befund 3, zweiter Teil). Siehe auch M-13 (Identitätsbindung), M-66 (Ortsnamen als Fahrgastname).
- **Priorität:** P2 – vor dem Pilot (Berger: S2; Datenschutzlücke am Telefon ohne Identitätsprüfung).
- **Status:** OFFEN. Noch nicht beauftragt.

#### M-75 Durchgang 4, Befund S2-027 – Kurztitel nicht übergeben
- **Problem:** Nicht im Detail vorliegend. Berger nennt diese Kennung im Prüfauftrag ohne Kurztitel oder Einzelheiten; der volle Befund steht nur im Chat-Verlauf der auftraggebenden Sitzung.
- **Zu tun:** Vollständigen Bericht (Fundort, Beweis, Lösungsvorschlag) nachtragen, dann diese Maßnahme ausfüllen.
- **Erledigt damit:** S2-027 (Berger Durchgang 4).
- **Priorität:** P2 – vor dem Pilot (Standardzuordnung nach Schweregrad-Code S2, vorläufig – kann sich nach Vorliegen der Einzelheiten ändern).
- **Status:** OFFEN (Details ausstehend).

#### M-76 Durchgang 4, Befund S2-028 – Kurztitel nicht übergeben
- **Problem:** Nicht im Detail vorliegend. Berger nennt diese Kennung im Prüfauftrag ohne Kurztitel oder Einzelheiten; der volle Befund steht nur im Chat-Verlauf der auftraggebenden Sitzung.
- **Zu tun:** Vollständigen Bericht (Fundort, Beweis, Lösungsvorschlag) nachtragen, dann diese Maßnahme ausfüllen.
- **Erledigt damit:** S2-028 (Berger Durchgang 4).
- **Priorität:** P2 – vor dem Pilot (Standardzuordnung nach Schweregrad-Code S2, vorläufig).
- **Status:** OFFEN (Details ausstehend).

#### M-77 Durchgang 4, Befund S2-029 – Kurztitel nicht übergeben
- **Problem:** Nicht im Detail vorliegend. Berger nennt diese Kennung im Prüfauftrag ohne Kurztitel oder Einzelheiten; der volle Befund steht nur im Chat-Verlauf der auftraggebenden Sitzung.
- **Zu tun:** Vollständigen Bericht (Fundort, Beweis, Lösungsvorschlag) nachtragen, dann diese Maßnahme ausfüllen.
- **Erledigt damit:** S2-029 (Berger Durchgang 4).
- **Priorität:** P2 – vor dem Pilot (Standardzuordnung nach Schweregrad-Code S2, vorläufig).
- **Status:** OFFEN (Details ausstehend).

### P3 – in den ersten Pilotwochen

#### M-24 Öffentliche Seite `/live` ohne Gesprächstranskripte
- **Problem:** Die Demo-Seite `/live` liefert ohne Anmeldung entschlüsselte Gesprächsprotokolle und den Tagesplan des Demo-Mandanten. Heute sind das simulierte Daten; sobald die beworbene Demo-Nummer freigeschaltet wird, liest jeder Website-Besucher die Gespräche echter Anrufer.
- **Zu tun:**
  1. `liveTranskriptLaden` entfernen oder durch eine anonymisierte, fest hinterlegte Beispielfassung ersetzen.
  2. Demo-Mandant technisch von echten Rufnummern trennen (keine echte Nummer darf auf den Demo-Mandanten zeigen).
- **Betroffene Dateien:** `src/app/live/actions.ts`, `src/app/live/page.tsx`.
- **Erledigt damit:** S3-025 (live bestätigt). Siehe auch V-010 (Verdacht).
- **Nachweis:** Aufruf von `/live` ohne Sitzung enthält kein Transkript; `grep decrypt src/app/live` leer.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-25 Abrechnungsexport: Fehlfahrten, Markierung erst nach Download, keine Formeln in CSV
- **Problem:** Der Export enthält nur erledigte Fahrten, keine Fehlfahrten (bei vielen Kassen abrechenbar). Die Fahrten werden als „exportiert“ markiert, bevor die Datei fertig ist – bricht der Download ab, fehlen sie im Standardexport. Fahrgastnamen, die mit `=`, `+`, `-` oder `@` beginnen, werden in Excel als Formel ausgeführt (Formelinjektion, bestätigt).
- **Zu tun:**
  1. `NICHT_ANGETROFFEN` als eigene Zeile mit Kennzeichen „Fehlfahrt“ aufnehmen.
  2. `exportedAt` erst setzen, wenn die Datei vollständig erzeugt ist (oder per Bestätigungs-Klick „Export übernommen“); Export-Protokoll mit laufender Nummer.
  3. Zellen mit führendem Formelzeichen durch `'` entschärfen, in Export und Import.
- **Betroffene Dateien:** `src/app/api/export/abrechnung/route.ts`, `src/core/export/abrechnung.ts`, `src/app/dispo/fahrgaeste/actions.ts` (Import).
- **Erledigt damit:** S3-008, S3-015 (live bestätigt).
- **Nachweis:** Test: Fahrgast „=HYPERLINK(…)“ → CSV-Zelle beginnt mit `'`; Export-Abbruch → `exportedAt` bleibt `null`.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-26 Zeitrechnung überall über `week.ts` (Europe/Berlin statt Server-Zeitzone)
- **Problem:** An sieben Stellen wird „heute“ mit der Zeitzone des Servers (UTC auf Vercel) berechnet statt mit Berlin. Tagesgrenzen liegen 1–2 Stunden falsch; an Umstellungstagen fehlt eine Stunde im Tagesplan (Doppelbelegung möglich) oder eine Stunde zählt doppelt; Export und Auswertung zeigen falsche Tagessummen.
- **Zu tun:**
  1. Alle `new Date(y, m, d)`/`setDate(+1)`-Konstruktionen durch `berlinerMitternacht`/`tagVerschieben` aus `src/core/shifts/week.ts` ersetzen.
  2. Lint-Regel gegen `setDate(`/`setHours(` außerhalb `week.ts`.
- **Betroffene Dateien:** `src/core/disposition/automatischDisponieren.ts`, `src/core/disposition/vorschlagSpeichern.ts`, `src/core/disposition/planFuerMorgen.ts`, `src/app/api/export/abrechnung/route.ts`, `src/app/dispo/fahrten/actions.ts`, `src/app/dispo/fahrer/actions.ts`, `src/app/dispo/auswertung/actions.ts`.
- **Erledigt damit:** S3-001.
- **Nachweis:** Tests mit `TZ=UTC` für 25.10.2026 und 28.03.2027: Tagesfenster exakt 25 bzw. 23 Stunden, Fahrt um 00:30 Berlin zählt zum richtigen Tag.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.
- **Ergänzung aus Behebungsprotokoll Durchgang 3 (B3-A4, aufgenommen 31.10.2026):** Die Behebung bestätigt, dass die Stellen nach ihrem Lauf weiterhin bestehen, u. a. `automatischDisponieren.ts` (`getFullYear()` für „frühere Fahrt heute“), `planFuerMorgen.ts` und `vorschlagSpeichern.ts` (`setDate(+1)`), `src/app/dispo/fahrer/actions.ts` (`schichtenFuerWoche`, `setDate(+7)`); gegengelesen am Stand `aa4e6e7`. Neue Funktionen aus Behebung 3 rechnen über `week.ts`. Keine eigene Maßnahme, weil inhaltlich identisch mit M-26.

#### M-27 Prisma-Wiederholung nur für Lesezugriffe
- **Problem:** Bei Verbindungsabbruch wiederholt die Datenbankschicht automatisch jeden Befehl, auch Schreibbefehle. Hat die Datenbank den ersten Befehl schon ausgeführt, entsteht eine zweite Fahrt oder ein zweites Ereignis.
- **Zu tun:**
  1. Wiederholung nur für `findMany`/`findUnique`/`findFirst`/`count`.
  2. Für Schreibzugriffe stattdessen klare Fehlermeldung an den Aufrufer; wo nötig Idempotenz-Schlüssel (z. B. `callId` + Fahrtzeit).
- **Betroffene Dateien:** `src/lib/prisma.ts`.
- **Erledigt damit:** S3-002.
- **Nachweis:** Test: simulierter `ECONNRESET` bei `ride.create` → genau ein Versuch, Fehler wird geworfen; bei `findMany` → bis zu drei Versuche.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-28 Endprüfung der Zuweisung vervollständigen: Anfahrt, Puffer, Ausstattung, Pause und Ausfall
- **Problem:** Die letzte Prüfung vor der Zuweisung schaut nur, ob sich zwei Zeitfenster überschneiden. Dass das Fahrzeug 25 km Anfahrt zwischen zwei Fahrten braucht, dass eine Rollstuhl- oder Liegendfahrt auf einem PKW ohne Rampe landet (bestätigt), dass der Fahrer in der Pause ist, ausgefallen ist oder seine Schicht vor Fahrtende endet – all das prüft nur die Vorschlagsrechnung, nicht die manuelle Zuweisung per Klick oder Drag. Umgekehrt sperrt eine Mittagspause das Fahrzeug für alle Vorschläge des restlichen Tages.
- **Zu tun:**
  1. `fahrzeugZuweisen` prüft zusätzlich: `erfuelltAusstattung`, Anfahrtszeit zwischen Vorgänger-Ziel und Abholort (Routing oder Luftlinie) plus `folgefahrtPufferMinuten`, Schicht bis Fahrtende, `unavailable`/`onBreak` des Fahrers.
  2. Pause im Kandidatenfilter nur für die Abholzeit bewerten, nicht als Tagesflag.
  3. Bei Verstoß im manuellen Modus: Warnung mit ausdrücklicher Bestätigung („Trotzdem zuweisen“), im Automodus: Ablehnung.
- **Betroffene Dateien:** `src/core/disposition/zuweisen.ts`, `src/core/disposition/kandidaten.ts`, `src/core/disposition/vorschlagen.ts`.
- **Erledigt damit:** S3-014, R1-7 „Fahrzeug-Konfliktprüfung ohne Zeitpuffer“, S3-017 (live bestätigt), S3-007.
- **Nachweis:** Tests: Rollstuhlfahrt auf PKW → `FahrzeugKonfliktError` bzw. Warnung; Fahrt A endet 08:30 Köln-Süd, Fahrt B 08:35 Köln-Nord → Konflikt; Fahrer in Pause um 12:30 bleibt Kandidat für 15:00.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-29 Hin- und Rückfahrt als Paar behandeln
- **Problem:** Hin- und Rückfahrt sind in der Datenbank verknüpft (`returnOfId`), aber die Verknüpfung wird nirgends gelesen. Wird die Hinfahrt storniert oder verschoben, bleibt die Rückfahrt unverändert stehen – der Fahrer fährt zum Dialysezentrum, niemand ist da.
- **Zu tun:**
  1. `fahrtStornieren` fragt bei einer Hinfahrt mit Rückfahrt nach („Rückfahrt auch stornieren?“); KI-Werkzeug storniert beide, wenn der Anrufer den Tag absagt.
  2. `fahrtAendern`/`fahrtVerschieben` zeigt einen Hinweis auf die verknüpfte Rückfahrt; Oberfläche zeigt das Paar.
  3. Fremdschlüssel auf `returnOfId` ergänzen (M-37).
- **Betroffene Dateien:** `src/core/rides/stornieren.ts`, `src/core/rides/aendern.ts`, `src/core/voice/werkzeuge.ts`, `src/app/dispo/fahrten/TripModal.tsx`.
- **Erledigt damit:** R2-7 „Hin-/Rückfahrt-Kopplung (returnOfId) ist nur geschrieben, nirgends gelesen“, S3-005.
- **Nachweis:** Test: Hinfahrt stornieren mit Option „Paar“ → Rückfahrt `STORNIERT`; `grep returnOfId src/core` zeigt Lesezugriffe.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-30 Vorschlagsrechnung aktuell halten: offene Vorschläge mitzählen, Score vor dem Automodus neu berechnen
- **Problem:** Die Fairness-Verteilung zählt nur bestätigte Fahrten, nicht die noch offenen Vorschläge – mehrere kurz nacheinander gebuchte Fahrten landen alle beim selben „unterausgelasteten“ Wagen. Und der Automodus übernimmt Score und Ankunftszeit aus dem Moment der Fahrt-Anlage, auch wenn die Fahrt tagelang gewartet hat.
- **Zu tun:**
  1. Tagesplan für `auslastungDifferenzBerechnen` schließt `VORGESCHLAGEN`-Fahrten mit ihrem vorgeschlagenen Fahrzeug ein.
  2. `pruefeBesterVorschlag` rechnet Score/ETA zum Zeitpunkt der Entscheidung neu (oder der Vorschlag wird verworfen, wenn er älter als X Stunden ist).
- **Betroffene Dateien:** `src/core/disposition/vorschlagSpeichern.ts`, `src/core/disposition/vorschlagen.ts`, `src/core/disposition/automatischDisponieren.ts`.
- **Erledigt damit:** R1-4 „Fairness-Scoring ignoriert noch offene Vorschläge“, R1-5 „Vorschlags-Score/ETA wird nie neu berechnet“.
- **Nachweis:** Test: drei gleichartige Fahrten nacheinander → nicht alle beim selben Fahrzeug; Vorschlag mit veralteten Daten → Neuberechnung sichtbar im Log.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-31 Offline-Warteschlange der Fahrer-App: Fehlerarten unterscheiden, kein Doppelsenden
- **Problem:** Meldungen wie „Fahrgast an Bord“, die unterwegs im Funkloch entstehen, werden später nachgesendet. Schlägt das Nachsenden fehl – egal ob Netzfehler oder echte Ablehnung durch den Server –, wird die Meldung nach einem Versuch stillschweigend gelöscht; die App zeigt weiter den optimistisch gesetzten Status, Abrechnungskilometer werden geschätzt statt gemessen. Zwei offene Tabs senden denselben Eintrag doppelt.
- **Zu tun:**
  1. Fehlerklassen trennen: Netzwerkfehler → erneut versuchen (mit Begrenzung); fachliche Ablehnung (403, ungültiger Übergang) → Eintrag entfernen **und** UI zurückrollen mit Hinweis an den Fahrer.
  2. Warteschlange über das Cross-Tab-`storage`-Event und eine Sperre je Eintrag synchronisieren; Server-Seite idempotent (Status-Update mit Bedingung aus M-04, `problemMelden` mit Dedup-Schlüssel).
- **Betroffene Dateien:** `src/app/fahrer/OfflineSync.tsx`, `src/app/fahrer/warteschlange.ts`, `src/app/fahrer/FahrerClient.tsx`.
- **Erledigt damit:** S3-009, R3-9 „Dauerhafte Fehler werden wie Verbindungsabbrüche behandelt und dann lautlos verworfen“, R3-7 „Offline-Warteschlange: Cross-Tab-Race sendet doppelt“.
- **Nachweis:** Komponententests: 500 → Eintrag bleibt und wird erneut versucht; 403 → Eintrag weg, Status zurückgesetzt, Hinweis sichtbar; zwei Tabs → ein Sendevorgang.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-32 Push-Benachrichtigungen: eindeutiger `tag`, Fehler bei der Anmeldung sichtbar
- **Problem:** Alle Push-Meldungen tragen denselben Schlüssel, so dass die zweite die ungelesene erste im Handy still ersetzt – „Fahrt entzogen“ kann so unsichtbar bleiben. Scheitert die Push-Anmeldung (z. B. weil das Gerät schon bei einem anderen Fahrdienst registriert ist), gibt es keine Fehlermeldung; der Fahrer bleibt dauerhaft ohne Push.
- **Zu tun:**
  1. `pushAnFahrer` vergibt `tag = <kind>-<rideId>`; `sw.js` nutzt ihn.
  2. `PushAktivieren.tsx` mit `try/catch`, verständlicher Fehlertext, Möglichkeit das alte Abonnement zu lösen.
- **Betroffene Dateien:** `public/sw.js`, `src/core/notify/push.ts`, `src/app/fahrer/PushAktivieren.tsx`, `src/lib/db.ts`.
- **Erledigt damit:** R3-5 „Alle Push-Benachrichtigungen teilen denselben tag“, R3-11 „Push-Anmeldung hat keine Fehlerbehandlung für die Mandanten-Kollisionsprüfung“.
- **Nachweis:** Test: zwei Pushs für dieselbe Fahrt haben verschiedene Tags; Mandanten-Kollision → Fehlertext im UI.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.
- **Ergänzung aus Prüfbericht Durchgang 3 (R3-11/V-… höhere Tragweite):** Scheitert die Anmeldung aus irgendeinem Grund, hat der Browser das Abo, der Server nicht; beim nächsten Laden meldet der Browser „aktiv“, der Knopf verschwindet dauerhaft, das Abo wird nie nachgereicht – nicht nur bei Mandanten-Kollision. Beim Umsetzen mitberücksichtigen.

#### M-33 GPS-Erfassung auch bei geöffneter Navigation
- **Problem:** Die App sendet GPS nur, solange ihr Tab im Vordergrund ist. Der eigene Navigations-Knopf öffnet Google Maps und schickt die App in den Hintergrund – genau während der Fahrt veraltet die Position.
- **Zu tun:**
  1. Navigation per Deep-Link in derselben Ansicht anbieten oder nach Rückkehr sofort eine Position senden; Hinweis an den Fahrer, die App geöffnet zu lassen.
  2. Fallback: letzte bekannte Position bei Statuswechsel mitsenden (Statuswechsel passiert ohnehin im Vordergrund).
  3. Prüfen, ob eine native Hülle (Capacitor) mit Hintergrund-GPS für den Pilot nötig ist – Entscheidung mit dem Auftraggeber.
- **Betroffene Dateien:** `src/app/fahrer/GpsTracking.tsx`, `src/app/fahrer/FahrerClient.tsx`.
- **Erledigt damit:** R3-8 „GPS-Meldung hängt am Vordergrund-Tab“.
- **Nachweis:** Gerätetest auf Android und iOS: Position nach Navigation-Rückkehr höchstens 1 Minute alt; Statuswechsel trägt Koordinaten.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-34 Fahrt in der Oberfläche bearbeiten
- **Problem:** Der Disponent kann Adresse, Transportart, Datum oder Unterlagen einer Fahrt nicht ändern. Ein KI-Fehler heißt Storno plus Neuerfassung – zwei verwirrende Pushs an den Fahrer.
- **Zu tun:**
  1. Bearbeiten-Dialog im `TripModal` für Adresse, Zeit, Datum, Transportart, Hinweise; ruft `fahrtAendern` (nach M-20) auf.
  2. Datumswechsel in `fahrtAendern` erlauben.
- **Betroffene Dateien:** `src/app/dispo/fahrten/TripModal.tsx`, `src/app/dispo/fahrten/actions.ts`, `src/core/rides/aendern.ts`.
- **Erledigt damit:** S3-010.
- **Nachweis:** Playwright: Adresse ändern → eine Push „geändert“, kein Storno.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-35 Fahrer-Rufnummer je Mandant eindeutig, nicht plattformweit
- **Problem:** Die technische E-Mail eines Fahrers wird aus seiner Rufnummer gebildet und ist über alle Fahrdienste eindeutig. Ein Teilzeitfahrer, der für zwei Betriebe fährt, lässt sich im zweiten nicht einladen – es gibt nur einen Serverfehler.
- **Zu tun:**
  1. Technische E-Mail um die Mandanten-ID ergänzen oder Fahrer-Login von der E-Mail lösen.
  2. Dublettenprüfung in `fahrerEinladen` mit verständlicher Meldung.
- **Betroffene Dateien:** `src/core/drivers/validation.ts`, `src/app/dispo/fahrer/actions.ts`, `prisma/schema.prisma`.
- **Erledigt damit:** S3-019. Siehe auch M-21.
- **Nachweis:** Test: dieselbe Rufnummer in zwei Mandanten → zwei Fahrer; zweimal im selben Mandanten → Meldung.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-36 „Einmaligen“ Bereinigungs-Cron entfernen
- **Problem:** Eine als einmalig gedachte Aufräum-Route ist als jährlicher Cron eingetragen (1. Januar) und schreibt mandantenübergreifend in die Datenbank. Toter Code mit Zeitplan.
- **Zu tun:**
  1. Route und `vercel.json`-Eintrag löschen.
  2. Regel: einmalige Datenkorrekturen als Migration oder Skript, nie als Cron.
- **Betroffene Dateien:** `src/app/api/cron/brauchtSieBereinigenEinmalig/route.ts`, `vercel.json`.
- **Erledigt damit:** R1-6 „‚Einmaliger‘ Cleanup-Cron ist als Jahres-Cron verdrahtet“, S4-003.
- **Nachweis:** Route existiert nicht mehr, `vercel.json` ohne den Eintrag, Build grün.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-37 Datenbankschema härten: Fremdschlüssel, Indizes, CHECK-Constraints
- **Problem:** Drei Verweise (`Ride.driverId`, `Ride.returnOfId`, `Notification.rideId`) sind freier Text ohne Fremdschlüssel; auf den heißen Abfragepfaden (Fahrzeug-Konfliktprüfung jede Minute, Fahrer-App, Telefonsuche) fehlen Indizes; es gibt keine Datenbankregeln wie „Schichtende nach Schichtbeginn“. Löschfristen löschen deshalb in drei Schritten ohne Transaktion.
- **Zu tun:**
  1. Fremdschlüssel ergänzen (mit passendem `onDelete`), Indizes auf `Ride.vehicleId`, `Ride.driverId`, `Ride.callId`, `RideStatusEvent.rideId`, `Suggestion.rideId`, `Shift.driverId/vehicleId`; GIN-Index auf `Passenger.phones`.
  2. CHECK `Shift.end > Shift.start`; Löschfristen in einer Transaktion.
- **Betroffene Dateien:** `prisma/schema.prisma`, `prisma/migrations/`, `src/core/datenschutz/loeschfristen.ts`.
- **Erledigt damit:** S3-022.
- **Nachweis:** `prisma migrate diff` leer, `psql`-Abfrage auf `pg_constraint`/`pg_indexes` zeigt die neuen Einträge; Tests grün.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-38 Tests verlässlich machen: Playwright reparieren, Typecheck auf frischem Checkout, CI
- **Problem:** Beide Playwright-Klickwege sind rot (veraltete Erwartungen, fester Port, hinterlassene Testfirma in der Datenbank), und `npm run typecheck` schlägt auf einem frischen Checkout fehl. Ohne laufende Prüfungen in einer CI (automatische Prüfung bei jedem Code-Stand) bleiben die Tests Dekoration.
- **Zu tun:**
  1. Erwartungen aktualisieren, Aufräumen auch bei Fehlschlag, Port konfigurierbar.
  2. `next typegen` oder `next-env.d.ts` im Typecheck-Skript erzeugen.
  3. GitHub-Action: lint, typecheck, Vitest mit Datenbank, Playwright.
- **Betroffene Dateien:** `tests/e2e/startseite.spec.ts`, `tests/e2e/einrichtung.spec.ts`, `playwright.config.ts`, `package.json`, `.github/workflows/`.
- **Erledigt damit:** S3-021 (live bestätigt), S4-004.
- **Nachweis:** CI-Lauf grün auf frischem Checkout.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-39 Anrufe zählbar machen für die Abrechnung an den Betreiber
- **Problem:** Die Website verspricht einen Preis „pro angenommenem Anruf“, aber es gibt keine Zähl- oder Prüflogik. Die `Call`-Zeile entsteht vor der Prüfung, ob die KI überhaupt zuständig war; abgebrochene Anrufe und Demo-Anrufe zählen mit. Rechnungsstreit ohne Beleg.
- **Zu tun:**
  1. Feld `abrechenbar` am `Call`, gesetzt nur wenn die KI den Anruf angenommen und mindestens ein Werkzeug ausgeführt hat; Demo-Mandant ausgenommen.
  2. Monatszähler je Mandant, unveränderlich festgeschrieben, in der Oberfläche einsehbar.
- **Betroffene Dateien:** `src/app/api/voice/webhook/route.ts`, `src/core/voice/anruf.ts`, `prisma/schema.prisma`, `src/app/dispo/auswertung/**`.
- **Erledigt damit:** S3-023.
- **Nachweis:** Test: Anruf außerhalb KI-Zeiten → nicht abrechenbar; Monatszähler stimmt mit Zählung der `Call`-Zeilen überein.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.
- **Ergänzung aus Prüfbericht Durchgang 3:** Jeder `assistant-request` legt schon eine `Call`-Zeile an, auch mit ausgeschalteter KI und leerer Weiterleitungsnummer; dazu kann der Gesprächsbericht vor dem Werkzeugaufruf eintreffen und das Ergebnis falsch festschreiben (S4-015, siehe M-61) – beides beim Umsetzen von `abrechenbar` mitberücksichtigen.

#### M-53 `timeZone` an den verbleibenden Datums-/Uhrzeitanzeigen ergänzen
- **Problem:** 14 Stellen rendern Datum/Uhrzeit serverseitig ohne `timeZone`; unter Server-Zeitzone UTC zeigt die Dispo-Seite kurzzeitig den falschen Tag bzw. die falsche Woche, danach einen React-Hydrationsfehler (S3-026).
- **Zu tun:** `toLocale*String(...)` an den genannten Stellen um `{ timeZone: "Europe/Berlin" }` ergänzen, wie in `uhrzeit()` bereits gemacht.
- **Betroffene Dateien:** `src/app/dispo/DispoClient.tsx`, `src/app/dispo/fahrer/FahrerClient.tsx`, `src/app/dispo/auswertung/AuswertungClient.tsx`, `src/app/live/LiveClient.tsx`, `src/app/einrichtung/[schritt]/Schritt7Testanruf.tsx`.
- **Erledigt damit:** S3-026 (siehe auch V-016).
- **Nachweis:** `next start` unter `TZ=UTC` → Kopfzeile zeigt sofort den richtigen Tag, kein Hydrationsfehler in der Playwright-Probe.
- **Status:** OFFEN.

#### M-54 Einheitliches Fehlerkonzept für Server Actions in der Oberfläche
- **Problem:** In 20 Client-Komponenten verschwindet ein Fehler einer Server Action wortlos; Formular oder Knopf springt zurück, keine Meldung (S3-027).
- **Zu tun:** Gemeinsames Ergebnisobjekt `{ok, fehler}` (wie an 4 Stellen schon vorhanden) für alle genannten Actions; jede Aufrufstelle zeigt den Fehler über die vorhandene Fehlerzustand-Komponente (Design-Guide 5.9).
- **Betroffene Dateien:** `src/app/einrichtung/[schritt]/Schritt1Firma.tsx`, `Schritt2Telefon.tsx`, `Schritt6Ki.tsx`, `Schritt8LiveSchalten.tsx`, `EinrichtungLayout.tsx`, `src/app/dispo/fahrten/TripModal.tsx`, `src/app/dispo/fahrzeuge/FahrzeugeClient.tsx`, `src/app/dispo/fahrgaeste/FahrgaesteClient.tsx`, `src/app/dispo/fahrer/FahrerClient.tsx`, `src/app/fahrer/FahrerClient.tsx`, `src/app/fahrer/GpsTracking.tsx`, `src/components/VorschlagAktion.tsx`.
- **Erledigt damit:** S3-027.
- **Nachweis:** Probe mit einer absichtlich scheiternden Action je Komponente → sichtbare Fehlermeldung statt stillem Zurückspringen.
- **Status:** OFFEN.

#### M-55 Einrichtungsassistent prüft fachliche Mindestvoraussetzungen vor „Fertig“
- **Problem:** „Fertig“ und „Später erledigen“ setzen den Abschluss unabhängig davon, ob Fahrzeug, Fahrer, Rufnummer oder Betriebshof überhaupt angelegt sind; Öffnungszeiten werden gespeichert, aber nie ausgewertet; Schrittnummer ist vom Client frei wählbar (S3-028).
- **Zu tun:** Serverseitige Prüfung des tatsächlichen Bestands (mind. 1 Fahrzeug, 1 Fahrer, Rufnummer, Betriebshof) vor „Fertig“; Von/Bis-Prüfung für Öffnungszeiten; KI-Zeitfenster an die Öffnungszeiten koppeln oder die Abweichung im Assistenten erklären.
- **Betroffene Dateien:** `src/app/einrichtung/[schritt]/actions.ts`, `src/core/einrichtung/*`, `src/core/disposition/vorschlagSpeichern.ts`.
- **Erledigt damit:** S3-028.
- **Nachweis:** Test „Fertig ohne Fahrzeug“ → abgelehnt mit verständlicher Meldung statt stillem Abschluss.
- **Status:** OFFEN.

#### M-56 Vorschlagsrechnung: Termin der Vorfahrt nicht als deren Abfahrtszeit behandeln
- **Problem:** Die Vorschlagsrechnung nimmt bei einer Vorfahrt mit Termin den Termin statt die tatsächliche Abholzeit als Startpunkt; Fahrzeuge gelten dadurch bis zu 30 Minuten zu lange als belegt (S3-029).
- **Zu tun:** Startpunkt der Folgeberechnung immer aus Abholzeit + Fahrzeit berechnen, nicht aus der Terminzeit.
- **Betroffene Dateien:** `src/core/disposition/vorschlagen.ts`.
- **Erledigt damit:** S3-029.
- **Nachweis:** Rechenbeispiel aus dem Prüfbericht als Vitest-Fall (Abholung 09:30, Termin 10:00, 20 Min Fahrt → frei ab 09:55, nicht 10:25).
- **Status:** OFFEN.

#### M-57 Routing-Aufrufe mit Zeitlimit; ein gemeinsames Fahrzeitmodell für Vorschlag und Konfliktprüfung
- **Problem:** Der Aufruf an OpenRouteService hat kein Zeitlimit; Vorschlag und Konfliktprüfung/Zeitstrahl schätzen die Fahrzeit mit zwei unabhängigen, widersprüchlichen Modellen (S3-030).
- **Zu tun:** Zeitlimit um den ORS-Aufruf; eine gemeinsame Schätzfunktion für beide Stellen.
- **Betroffene Dateien:** `src/providers/routing/openRouteService.ts`, `src/core/shifts/dauer.ts`, `src/core/disposition/weights.ts`, `src/core/disposition/zuweisen.ts`.
- **Erledigt damit:** S3-030.
- **Nachweis:** Test mit hängendem Mock-Aufruf → Abbruch nach Zeitlimit statt unbegrenztem Warten; Rechenbeispiel mit identischem Ergebnis an beiden Stellen.
- **Status:** OFFEN.

#### M-58 Push-Zustellung: Fehler außer 404/410 auswerten und melden
- **Problem:** Jeder Fehler außer 404/410 (401, 413, 429, Netzwerkfehler) wird verworfen; die Benachrichtigung gilt trotzdem als gesendet, ein Zustellausfall bleibt unbemerkt (S3-031).
- **Zu tun:** Rückgabewert der Zustellung an allen Aufrufstellen auswerten; wiederholte Fehlschläge je Abo erkennen und melden.
- **Betroffene Dateien:** `src/core/notify/push.ts`, `src/core/disposition/zuweisen.ts`, `src/core/rides/aendern.ts`, `src/core/rides/stornieren.ts`.
- **Erledigt damit:** S3-031.
- **Nachweis:** Test mit simuliertem Fehler 401 → Zustellausfall wird vermerkt statt verworfen.
- **Status:** OFFEN.

#### M-59 Fahrer-App: Rückfrage bei „Ich falle aus“, Statuswechsel rückgängig machbar
- **Problem:** „Ich falle aus“ wirkt ohne Rückfrage sofort auf alle Fahrten heute und morgen; kein Statuswechsel lässt sich zurücknehmen; jeder Statuswechsel öffnet zusätzlich Google Maps (S3-032).
- **Zu tun:** Rückfrage vor „Ich falle aus“ (wie beim Stornieren); Korrekturweg für einen Fehltipp; Google-Maps-Öffnen von der reinen Statusmeldung entkoppeln.
- **Betroffene Dateien:** `src/app/fahrer/FahrerClient.tsx`, `src/core/rides/fahrerAusfall.ts`.
- **Erledigt damit:** S3-032.
- **Nachweis:** Probe: „Ich falle aus“ verlangt Bestätigung; ein versehentliches „Erledigt“ lässt sich kurz danach zurücknehmen.
- **Status:** OFFEN.

#### M-60 Pilot-Kennzahlen: Grundgesamtheiten klären, Stornos und Teilanliegen korrekt zählen
- **Problem:** Storno- und Auskunftsanrufe zählen als „nicht vollständig erfasst“; stornierte Fahrten zählen als „disponiert“; „Fahrten heute“ enthält Stornos; die Zielwerte der Oberfläche sind damit praktisch unerreichbar oder irreführend (S3-033).
- **Zu tun:** Grundgesamtheit je Kennzahl fachlich festlegen, Statusfilter ergänzen, `docs/01` entsprechend präzisieren (Freigabe nötig).
- **Betroffene Dateien:** `src/core/auswertung/kennzahlen.ts`, `src/app/dispo/auswertung/actions.ts`, `src/app/dispo/fahrten/actions.ts`.
- **Erledigt damit:** S3-033.
- **Nachweis:** Vitest-Rechenbeispiel aus dem Prüfbericht (4 Anrufe → korrekt 75 % statt 25 %).
- **Status:** OFFEN.

#### M-68 Problemcodes in „Braucht Sie“ als verständlicher Text statt technischer Codes
- **Problem:** In der Liste „Braucht Sie“ der Disposition stehen die Gründe einer Fahrt als technische Codes, z. B. `KEIN_FAHRZEUG`, `GENEHMIGUNG_FEHLT` und neu `FAHRT_ABGEBROCHEN`. Der Disponent muss raten, was zu tun ist.
- **Zu tun:**
  1. Klartext je Problemcode in einer `texte.ts` sammeln (Begriffe aus `docs/DESIGN-GUIDE.md` Abschnitt 8, du-los und sachlich); unbekannte Codes mit neutralem Ersatztext.
  2. Anzeige in `fahrplan.ts` auf diese Texte umstellen; dabei die übrigen Stellen der Büro-Oberfläche aus der Ergänzung zu M-43 (`DispoClient.tsx`, `fahrten/actions.ts`, `TripModal`) mit erledigen.
- **Betroffene Dateien:** `src/app/dispo/fahrten/fahrplan.ts` (Zeile mit `problems.join(", ")`), neue bzw. vorhandene `src/app/dispo/fahrten/texte.ts`.
- **Erledigt damit:** B3-A3 (Behebungsprotokoll Durchgang 3, „Auf dem Weg aufgefallen“ Nr. 3; dort Vorschlag 7). Überschneidet sich mit der Ergänzung zu M-43 (Büro-Oberfläche); M-43 bleibt für die KI-Antworten zuständig, M-68 für die Oberfläche.
- **Gegengelesen (Projektleitung, 31.10.2026, Stand `aa4e6e7`):** `fahrplan.ts` bildet den Grund mit `f.problems.join(", ")`. Beobachtung bestätigt.
- **Priorität:** P3 – erste Pilotwochen (Bedienbarkeit, kein Daten- oder Fahrtrisiko). Vom Auftraggeber so vorgeschlagen und akzeptiert; Einstufung nach Gegenlesen beibehalten.
- **Nachweis:** Test bzw. Probe: Fahrt mit `KEIN_FAHRZEUG` zeigt in „Braucht Sie“ einen deutschen Satz, keinen Großbuchstaben-Code.
- **Status:** OFFEN.

#### M-69 „Fahrzeug ändern“ im Fahrt-Fenster: genau eine passende Meldung je Fahrer prüfen (Verdacht)
- **Problem (unbestätigter Verdacht):** „Fahrzeug ändern“ im Fahrt-Fenster läuft über eine eigene Action, nicht über das in M-20 reparierte Verschieben im Zeitstrahl. Ob bei einem Fahrerwechsel auf diesem Weg ebenfalls genau eine passende Meldung je Fahrer entsteht (alter Fahrer „entzogen“, neuer Fahrer „neu“), hat die Behebung ausdrücklich nicht geprüft.
- **Zu tun:**
  1. Im Prüfdurchgang klären: Fahrt mit Fahrer A über „Fahrzeug ändern“ auf Fahrzeug von Fahrer B → A bekommt genau „entzogen“, B genau „neu“, keine Doppelmeldung.
  2. Nur bei Bestätigung: Weg auf dieselbe Benachrichtigungslogik wie M-20 bringen.
- **Betroffene Dateien:** `src/components/VorschlagAktion.tsx`, `src/app/dispo/fahrten/actions.ts` (`fahrzeugWaehlen`), `src/core/disposition/zuweisen.ts`, `src/core/rides/fahrerBenachrichtigen.ts`.
- **Erledigt damit:** B3-A5 (Behebungsprotokoll Durchgang 3, „Auf dem Weg aufgefallen“ Nr. 5). Siehe auch M-20.
- **Gegengelesen (Projektleitung, 31.10.2026, Stand `aa4e6e7`, nur Stichprobe):** `VorschlagAktion.tsx` ruft `fahrzeugWaehlen` auf, das `fahrzeugZuweisen` aufruft; laut Behebungsprotokoll meldet `fahrzeugZuweisen` inzwischen über `fahrerBenachrichtigen.ts`. Das spricht eher gegen den Verdacht, ist aber nicht geprüft. Das Behebungsprotokoll nennt diesen Punkt im Nachprüfungsauftrag als „Nebenwirkung“ zu M-20 – er ist damit voraussichtlich Teil von Prüfdurchgang 4.
- **Priorität:** P3 – erste Pilotwochen (vorläufig; Doppel- oder Fehlmeldung an Fahrer ist ärgerlich, aber kein Datenschutzproblem). Vom Auftraggeber nicht eigens eingestuft; nach Ergebnis von Prüfdurchgang 4 neu bewerten oder schließen.
- **Nachweis:** Ergebnis des Prüfdurchgangs; bei Bestätigung Test wie in Zu tun 1.
- **Status:** OFFEN (Verdacht, unbestätigt).

#### M-78 Durchgang 4, Befund S3-035 – Kurztitel nicht übergeben
- **Problem:** Nicht im Detail vorliegend. Berger nennt diese Kennung im Prüfauftrag ohne Kurztitel oder Einzelheiten; der volle Befund steht nur im Chat-Verlauf der auftraggebenden Sitzung.
- **Zu tun:** Vollständigen Bericht (Fundort, Beweis, Lösungsvorschlag) nachtragen, dann diese Maßnahme ausfüllen.
- **Erledigt damit:** S3-035 (Berger Durchgang 4).
- **Priorität:** P3 – erste Pilotwochen (Standardzuordnung nach Schweregrad-Code S3, vorläufig).
- **Status:** OFFEN (Details ausstehend).

#### M-79 Durchgang 4, Befund S3-036 – Kurztitel nicht übergeben
- **Problem:** Nicht im Detail vorliegend. Berger nennt diese Kennung im Prüfauftrag ohne Kurztitel oder Einzelheiten; der volle Befund steht nur im Chat-Verlauf der auftraggebenden Sitzung.
- **Zu tun:** Vollständigen Bericht (Fundort, Beweis, Lösungsvorschlag) nachtragen, dann diese Maßnahme ausfüllen.
- **Erledigt damit:** S3-036 (Berger Durchgang 4).
- **Priorität:** P3 – erste Pilotwochen (Standardzuordnung nach Schweregrad-Code S3, vorläufig).
- **Status:** OFFEN (Details ausstehend).

#### M-80 Durchgang 4, Befund S3-037 – Kurztitel nicht übergeben
- **Problem:** Nicht im Detail vorliegend. Berger nennt diese Kennung im Prüfauftrag ohne Kurztitel oder Einzelheiten; der volle Befund steht nur im Chat-Verlauf der auftraggebenden Sitzung.
- **Zu tun:** Vollständigen Bericht (Fundort, Beweis, Lösungsvorschlag) nachtragen, dann diese Maßnahme ausfüllen.
- **Erledigt damit:** S3-037 (Berger Durchgang 4).
- **Priorität:** P3 – erste Pilotwochen (Standardzuordnung nach Schweregrad-Code S3, vorläufig).
- **Status:** OFFEN (Details ausstehend).

#### M-81 Durchgang 4, Befund S3-038 – Kurztitel nicht übergeben
- **Problem:** Nicht im Detail vorliegend. Berger nennt diese Kennung im Prüfauftrag ohne Kurztitel oder Einzelheiten; der volle Befund steht nur im Chat-Verlauf der auftraggebenden Sitzung.
- **Zu tun:** Vollständigen Bericht (Fundort, Beweis, Lösungsvorschlag) nachtragen, dann diese Maßnahme ausfüllen.
- **Erledigt damit:** S3-038 (Berger Durchgang 4).
- **Priorität:** P3 – erste Pilotwochen (Standardzuordnung nach Schweregrad-Code S3, vorläufig).
- **Status:** OFFEN (Details ausstehend).

### P4 – später

#### M-40 Einmal-Codes und Magic-Link-Token gehasht speichern
- **Problem:** Login-Codes und Anmelde-Links stehen im Klartext in der Tabelle `verification`. Wer die Datenbank lesen kann (Backup, Konsole, Entwickler-Rechner), meldet sich als Büro an.
- **Zu tun:** Better-Auth-Option `storeOTP` auf gehashte Speicherung stellen; Magic-Link-Token ebenso hashen.
- **Betroffene Dateien:** `src/lib/auth.ts`.
- **Erledigt damit:** S4-011 (live bestätigt).
- **Nachweis:** `psql`-Abfrage auf `verification` zeigt keine sechsstelligen Codes im Klartext; Login funktioniert weiter.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-41 Sicherheits-Header vervollständigen
- **Problem:** `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors` und `Permissions-Policy` fehlen. Letztere regelt, welche Seiten GPS und Mikrofon nutzen dürfen – für eine App mit GPS wichtig.
- **Zu tun:** Header in `next.config.ts` ergänzen, CSP zunächst im `report-only`-Modus testen.
- **Betroffene Dateien:** `next.config.ts`.
- **Erledigt damit:** S4-012 (live bestätigt).
- **Nachweis:** `curl -I` auf die Startseite zeigt alle drei Header; Fahrer-App und Karte laufen ohne CSP-Fehler in der Konsole.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-42 Platzhalter bereinigen: Push-Kontaktadresse und private E-Mail im Seed
- **Problem:** Der Web-Push-Kontakt lautet `support@fahrdienst-ki.invalid` – Apple und Mozilla verlangen eine erreichbare Adresse, sonst kommt auf dem iPhone womöglich nie eine Push an. Im Seed-Skript steht die echte private E-Mail-Adresse des Auftraggebers im Git.
- **Zu tun:** Echte Support-Adresse als Umgebungsvariable; Seed-E-Mail durch `admin@muster-krankenfahrten.example` ersetzen und aus der Git-Historie bereinigen, falls gewünscht.
- **Betroffene Dateien:** `src/core/notify/push.ts`, `prisma/seed.ts`.
- **Erledigt damit:** S4-005, S4-006. Siehe auch V-007 (Verdacht, iOS-Push).
- **Nachweis:** `grep -r "\.invalid\|hotmail" src prisma` leer; Push-Test auf iPhone.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-43 KI-Antworten ohne technische Codes und IDs
- **Problem:** Die KI bekommt Antworten wie „Fahrt erfasst, aber mit Hinweis: GENEHMIGUNG_FEHLT“ und rohe Fehlermeldungen („OpenRouteService 429“) und liest sie womöglich vor. `rideId`/`passengerId`/`placeId` stehen in jedem Werkzeug-Ergebnis.
- **Zu tun:** Werkzeug-Ergebnisse in `gesprochen` (Klartext für den Anrufer) und `daten` (IDs, nur für das Modell) trennen; Fehler in verständliche Sätze übersetzen.
- **Betroffene Dateien:** `src/core/voice/werkzeuge.ts`, `src/core/voice/voicePrompt.ts`.
- **Erledigt damit:** S4-008.
- **Nachweis:** Test: kein Werkzeug-Ergebnis enthält `_FEHLT`, `429` oder eine cuid im Feld `gesprochen`.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.
- **Ergänzung aus Prüfbericht Durchgang 3 (S4-008):** Dieselben rohen Codes stehen auch in der Oberfläche für den Disponenten (`DispoClient.tsx`, `fahrten/actions.ts`, `TripModal`) – beim Umsetzen auch die Büro-Oberfläche berücksichtigen, nicht nur die KI-Antworten. **Seit 31.10.2026:** Die Büro-Oberfläche ist als eigene Maßnahme M-68 (P3) geführt; M-43 bleibt für die KI-Antworten.

#### M-44 Kleinigkeiten in Stammdaten: Feiertage je Bundesland, Fahrzeug-Deaktivierung, `Approval.maxRides`
- **Problem:** Feiertage sind fest auf NRW gesetzt; Fahrzeuge werden deaktiviert, ohne laufende Schichten zu prüfen; die maximale Fahrtenzahl einer Genehmigung wird nie ausgewertet.
- **Zu tun:** Feld `bundesland` am Mandanten mit Feiertagstabelle; Deaktivieren eines Fahrzeugs prüft offene Schichten und Fahrten; `maxRides` in `fahrtPruefen` zählen.
- **Betroffene Dateien:** `src/core/shifts/feiertageNrw.ts`, `src/app/dispo/fahrzeuge/actions.ts`, `src/core/rides/pruefungen.ts`, `prisma/schema.prisma`.
- **Erledigt damit:** S4-010.
- **Nachweis:** Tests: Feiertag Bayern erkannt; Fahrzeug mit laufender Schicht nicht deaktivierbar; 11. Fahrt bei `maxRides 10` → Problem gemeldet.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-45 Sicherheitsbericht `docs/11` nachprüfen und korrigieren
- **Problem:** Der Sicherheitsbericht enthält mehrere Aussagen, die die Prüfung widerlegt hat (kein Zugriff auf fremde Fahrten, Logs nur in Entwicklung, drei Webhook-Routen, Mandantentest deckt alles ab, Push-Texte ohne Adressen).
- **Zu tun:** Nach Abschluss von M-02, M-09, M-11 und M-14 jeden Punkt des Berichts mit Beleg (Test oder Befehl) neu schreiben.
- **Betroffene Dateien:** `docs/11-sicherheitsbericht.md`.
- **Erledigt damit:** S4-001 (teilweise live bestätigt).
- **Nachweis:** Jeder Punkt im Bericht nennt den Test oder Befehl, der ihn belegt.
- **Status:** OFFEN. In Behebung Durchgang 3 nicht beauftragt (nur P1/P2); noch kein Behebungsversuch.

#### M-61 Gesprächsbericht erst nach allen Werkzeugaufrufen auswerten
- **Problem:** Der Gesprächsbericht kann eintreffen, bevor ein zugehöriger Werkzeugaufruf verarbeitet ist; `Call.outcome` bleibt „ABGEBROCHEN“, obwohl danach eine Fahrt angelegt wurde; parallele gleiche Werkzeugaufrufe legen doppelte Orts-Zeilen an (S4-015).
- **Zu tun:** Outcome erst setzen, wenn alle offenen Werkzeugaufrufe des Anrufs verarbeitet sind; parallele Ortssuchen für dieselbe unbekannte Adresse zusammenführen oder nacheinander verarbeiten.
- **Betroffene Dateien:** `src/app/api/voice/webhook/route.ts`.
- **Erledigt damit:** S4-015.
- **Nachweis:** Test: Gesprächsbericht vor Werkzeugaufruf → Outcome korrekt nach Abschluss aller Aufrufe.
- **Status:** OFFEN.

#### M-62 Projektregeln und Design-Checkliste nachziehen
- **Problem:** Keine `texte.ts` unter mehreren Seiten (Regel „Texte sammeln“); 10px-Schrift im Zeitstrahl (Minimum 11); kein `engines`-Feld; `noUncheckedIndexedAccess` aus; Sie-Form in nach dem 27.10. geänderten Texten (S4-016).
- **Zu tun:** `texte.ts` für die genannten Seiten anlegen, Schriftgröße anheben, `engines` in `package.json` ergänzen, `noUncheckedIndexedAccess` einschalten und entstehende Fehler beheben, Sie-Form-Texte auf du-los/sachlich umstellen.
- **Betroffene Dateien:** diverse (siehe Fundort im Prüfbericht), `package.json`, `tsconfig.json`.
- **Erledigt damit:** S4-016.
- **Nachweis:** Design-Checkliste erneut durchgegangen; Typecheck bleibt grün mit `noUncheckedIndexedAccess`.
- **Status:** OFFEN.

#### M-63 Anmeldeseite: Ratenbegrenzung gegen Benutzer-Enumeration
- **Problem:** Die Server Action zur Anmeldemethode verrät ungebremst, ob eine E-Mail-Adresse bekannt ist und mit welcher Rolle (S4-017).
- **Zu tun:** Ratenbegrenzung (wie bei der Registrierung, M-23) für diese Server Action.
- **Betroffene Dateien:** `src/app/(auth)/anmeldung/actions.ts`.
- **Erledigt damit:** S4-017.
- **Nachweis:** Test: wiederholte Anfrage vom selben Anschluss binnen kurzer Zeit → abgelehnt.
- **Status:** OFFEN.

#### M-64 Vapi-Assistent vollständig konfigurieren; Feiertagshinweis für die gesamte Serienlaufzeit
- **Problem:** Der Transcriber ist ohne Deepgram-Modell/Endpointing konfiguriert, Einstellungen zu Stille/Unterbrechen/Sprechtempo aus `docs/04` fehlen; der Feiertagshinweis einer Serie gilt nur für die ersten 14 Tage, 24./31.12. fehlen in der Feiertagsliste (S4-018).
- **Zu tun:** Vapi-Konfiguration um die in `docs/04` geforderten Einstellungen ergänzen; Feiertagshinweis über die gesamte Serienlaufzeit erzeugen; 24./31.12. in die Feiertagsliste aufnehmen oder als Hinweis kennzeichnen.
- **Betroffene Dateien:** `src/providers/voice/vapi.ts`, `src/core/rides/serie.ts`, `src/core/shifts/feiertageNrw.ts`.
- **Erledigt damit:** S4-018.
- **Nachweis:** Live-Abruf der Assistant-Konfiguration zeigt alle geforderten Felder; Serie über 14 Tage hinaus zeigt den Hinweis weiterhin.
- **Status:** OFFEN.

#### M-65 Neue Adresse in der Fahrterfassung validieren
- **Problem:** „Neue Adresse eingeben“ legt Orte ohne Postleitzahl und mit falsch zerlegtem Label an; die vorhandene Adress-Zerlegung wird dort nicht genutzt (S4-019).
- **Zu tun:** Vorhandene Adress-Zerlegung auch bei „Neue Adresse eingeben“ verwenden; Prüfung für die neuen Felder ergänzen.
- **Betroffene Dateien:** `src/app/dispo/fahrten/OrtAuswahl.tsx`, `src/app/dispo/fahrten/actions.ts`.
- **Erledigt damit:** S4-019.
- **Nachweis:** Test „Hauptstraße 12, 52499 Baesweiler, Deutschland“ → korrekt zerlegt (Straße/PLZ/Ort getrennt).
- **Status:** OFFEN.

#### M-70 Datenbank-Tests räumen auch bei Fehlschlag auf (Testreste „ohne Betriebshof“)
- **Problem:** Der Test „tut nichts, solange kein Betriebshof hinterlegt ist“ in `tests/disposition/planFuerMorgen.test.ts` löscht seinen Test-Mandanten erst nach der Erwartung. Schlägt die Erwartung fehl, bleibt der Mandant in der Testdatenbank liegen (laut Behebung zweimal passiert). Kein Produktionsthema, aber die Testdatenbank wird unzuverlässig.
- **Zu tun:** Aufräumen in `try/finally` bzw. `afterEach`; vorgeschlagen ist eine gemeinsame Test-Hilfe `mitTestMandant()` für alle Datenbank-Tests.
- **Betroffene Dateien:** `tests/disposition/planFuerMorgen.test.ts`, ggf. neue Test-Hilfe unter `tests/`.
- **Erledigt damit:** B3-A6 (Behebungsprotokoll Durchgang 3, „Auf dem Weg aufgefallen“ Nr. 6; dort Vorschlag 9). Siehe auch M-38.
- **Gegengelesen (Projektleitung, 31.10.2026, Stand `aa4e6e7`):** Der Fall legt den Mandanten an und löscht ihn erst nach `expect(...)`, ohne `finally`. Beobachtung bestätigt.
- **Priorität:** P4 – später (Testpflege). Vom Auftraggeber so vorgeschlagen und akzeptiert; Einstufung nach Gegenlesen beibehalten.
- **Nachweis:** Absichtlich rot gemachter Testfall hinterlässt keinen Mandanten „Test-PlanMorgen-OhneDepot …“.
- **Status:** OFFEN.

#### M-71 Seed-Schutz-Test darf den Beispiel-Mandanten der Testdatenbank nicht entfernen
- **Problem:** Laut Behebung entfernt `tests/seed/seedSchutz.test.ts` den Beispiel-Mandanten „Muster Krankenfahrten“ aus der Testdatenbank; wer danach im Browser prüfen will, muss `npm run seed` erneut ausführen. Kein Produktionsthema.
- **Zu tun:** Klären, ob und auf welchem Weg der Beispiel-Mandant beim Testlauf verschwindet; falls ja, Test nur mit eigenen Test-Mandanten arbeiten lassen, sonst Hinweis in der Testanleitung.
- **Betroffene Dateien:** `tests/seed/seedSchutz.test.ts`, `src/lib/seedSchutz.ts`.
- **Erledigt damit:** B3-A7 (Behebungsprotokoll Durchgang 3, „Auf dem Weg aufgefallen“ Nr. 7). Siehe auch M-70, M-38.
- **Gegengelesen (Projektleitung, 31.10.2026, Stand `aa4e6e7`):** Im Stand `aa4e6e7` legt der Test nur eigene Mandanten „PRUEF_fremd …“/„PRUEF_demo …“ an und löscht nur diese; einen Zugriff auf „Muster Krankenfahrten“ habe ich im Testcode nicht gefunden. **Nicht bestätigt** – möglicherweise Wirkung eines früheren Zwischenstands oder über einen anderen Weg. Beim nächsten Testlauf beobachten.
- **Priorität:** P4 – später (Testpflege). Vom Auftraggeber so vorgeschlagen und akzeptiert; beibehalten.
- **Nachweis:** Nach `npm test` ist der Beispiel-Mandant in der Testdatenbank unverändert vorhanden.
- **Status:** OFFEN (nicht bestätigt).

#### M-82 Durchgang 4, Befund S4-020 – Kurztitel nicht übergeben
- **Problem:** Nicht im Detail vorliegend. Berger nennt diese Kennung im Prüfauftrag ohne Kurztitel oder Einzelheiten; der volle Befund steht nur im Chat-Verlauf der auftraggebenden Sitzung.
- **Zu tun:** Vollständigen Bericht (Fundort, Beweis, Lösungsvorschlag) nachtragen, dann diese Maßnahme ausfüllen.
- **Erledigt damit:** S4-020 (Berger Durchgang 4).
- **Priorität:** P4 – später (Standardzuordnung nach Schweregrad-Code S4, vorläufig).
- **Status:** OFFEN (Details ausstehend).

#### M-83 Durchgang 4, Befund S4-021 – Kurztitel nicht übergeben
- **Problem:** Nicht im Detail vorliegend. Berger nennt diese Kennung im Prüfauftrag ohne Kurztitel oder Einzelheiten; der volle Befund steht nur im Chat-Verlauf der auftraggebenden Sitzung.
- **Zu tun:** Vollständigen Bericht (Fundort, Beweis, Lösungsvorschlag) nachtragen, dann diese Maßnahme ausfüllen.
- **Erledigt damit:** S4-021 (Berger Durchgang 4).
- **Priorität:** P4 – später (Standardzuordnung nach Schweregrad-Code S4, vorläufig).
- **Status:** OFFEN (Details ausstehend).

#### M-84 Durchgang 4, Befund S4-022 – Kurztitel nicht übergeben
- **Problem:** Nicht im Detail vorliegend. Berger nennt diese Kennung im Prüfauftrag ohne Kurztitel oder Einzelheiten; der volle Befund steht nur im Chat-Verlauf der auftraggebenden Sitzung.
- **Zu tun:** Vollständigen Bericht (Fundort, Beweis, Lösungsvorschlag) nachtragen, dann diese Maßnahme ausfüllen.
- **Erledigt damit:** S4-022 (Berger Durchgang 4).
- **Priorität:** P4 – später (Standardzuordnung nach Schweregrad-Code S4, vorläufig).
- **Status:** OFFEN (Details ausstehend).

#### M-85 Durchgang 4, Befund S4-023 – Kurztitel nicht übergeben
- **Problem:** Nicht im Detail vorliegend. Berger nennt diese Kennung im Prüfauftrag ohne Kurztitel oder Einzelheiten; der volle Befund steht nur im Chat-Verlauf der auftraggebenden Sitzung.
- **Zu tun:** Vollständigen Bericht (Fundort, Beweis, Lösungsvorschlag) nachtragen, dann diese Maßnahme ausfüllen.
- **Erledigt damit:** S4-023 (Berger Durchgang 4).
- **Priorität:** P4 – später (Standardzuordnung nach Schweregrad-Code S4, vorläufig).
- **Status:** OFFEN (Details ausstehend).

## Vor dem Pilot extern klären

Diese Verdachte sind nicht bestätigt und lassen sich nur mit Zugang zu externen Konten oder Geräten prüfen. V-005 und V-006 wurden in Durchgang 2 bestätigt und stecken in M-14 bzw. M-21. V-017 bis V-020 (Berger Durchgang 4) liegen nur als Kennung vor, ohne übergebenen Prüfauftrag/Zugang; nachtragen, sobald der vollständige Bericht vorliegt.

| Verdacht | Prüfauftrag | Benötigter Zugang |
|---|---|---|
| V-001 | Nach `next build` prüfen, ob die Server Action `fahrplanFuerMandantLaden` von außen aufrufbar ist (teilweise bestätigt: registriert, ID nicht im öffentlichen Bundle); unabhängig davon die Funktion nach `src/core/` verschieben (mit M-02). | Build-Ausgabe, kein externer Zugang |
| V-002 | Im Vercel-Konto prüfen, ob der Plan vier Minuten-Crons erlaubt und ob Cron-Läufe sich überlappen (Logs); M-16 baut die Sperre unabhängig davon ein. | Vercel |
| V-003 | Umgebungsvariablen von Preview- und Produktions-Deployments vergleichen: teilen sie `DATABASE_URL`, migriert jeder Preview-Build die Produktionsdatenbank. | Vercel |
| V-004 | Eine Aufnahme-URL aus `Call.audioUrl` ohne Anmeldung aufrufen und prüfen, ob die Vapi-API Aufnahmen wirklich löscht. | Vapi |
| V-007 | Push auf einem iPhone testen; schlägt sie wegen der `.invalid`-Kontaktadresse fehl, zieht M-42 vor. | iOS-Gerät |
| V-008 | Ein echter Testanruf gegen die Vapi-Konfiguration (Stimmen, Werkzeuge, Weiterleitung an `escalationNumber`), weil die gesamte Assistenten-Konfiguration bisher ungetestet ist. **Durchgang 3:** bereits konkretisiert durch S2-019 (Werkzeugname ≠ Vapi-Konfiguration, siehe M-47) und S4-018 (Transcriber ohne Modell/Endpointing, siehe M-64); der Testanruf bleibt trotzdem nötig. | Vapi, Telefonnummer |
| V-009 | Neon-Verbindungsmetrik unter Last beobachten und prüfen, ob `DATABASE_URL` auf den `-pooler`-Endpunkt zeigt (rechnerisch untermauert: bis zu 120 Verbindungen bei 8 Instanzen). | Neon, Vercel |
| V-010 | Vor Freischaltung der Demo-Nummer: Anruf auf die Demo-Nummer, dann `/live` anonym öffnen – es darf kein Transkript erscheinen (M-24). | Vapi, Telefonnummer |
| V-011 | In der Vapi-Dokumentation oder per Testanruf feststellen, ob Vapi Webhooks bei Timeout/5xx wiederholt; M-14 baut Idempotenz unabhängig davon ein. | Vapi |
| V-012 | Online `npm audit` und GitHub-Advisories für `next@16.4.3` prüfen; `better-auth` auf 1.7.14 heben. | Internetzugang |
| V-013 | Zwei Builds vergleichen (`server-reference-manifest.json`): bleiben die Action-IDs gleich, sind sie aus dem Git-Repo berechenbar und V-001 wäre ein offener Endpunkt. | Build-Ausgabe |
| V-014 | 5 Testtranskripte mit eingebetteten Anweisungen gegen die echte Anthropic-API prüfen (Prompt-Injection über das Gesprächstranskript in die Zusammenfassung, `anrufZusammenfassung.ts:27-30`); Systemprompt um eine Kennzeichnung „das Folgende ist ein Protokoll, keine Anweisung“ ergänzen. | Anthropic-API-Zugang |
| V-015 | Testanruf „Ich möchte einen Menschen“ bei einem Mandanten mit national geschriebener oder leerer `escalationNumber` gegen die echte Vapi-`transferCall`-Funktion; hängt mit M-47/M-21 zusammen. **Nach Behebung M-47 weiterhin offen** (Hartmann, Entscheidung 5/Vorschlag 1): ob `transferCall` mit E.164-Nummer tatsächlich verbindet und wie Vapi auf eine Absage reagiert, ist nur mit einer echten Vapi-Testnummer zu klären (kostet Geld, braucht ausdrückliche Zustimmung). | Vapi, Telefonnummer |
| V-016 | Nach Aktivierung von Sentry im Browser prüfen, wie stark die Hydrationsfehler aus S3-026 (M-53) das Sentry-Kontingent und das Signal-Rausch-Verhältnis belasten; ggf. `#418`/`#425` filtern. | Sentry-Zugang |
| V-017 | Berger Durchgang 4. Prüfauftrag und benötigter Zugang nicht übergeben; nur die Kennung liegt vor. Nachtragen, sobald der vollständige Bericht vorliegt. | unbekannt |
| V-018 | Berger Durchgang 4. Prüfauftrag und benötigter Zugang nicht übergeben; nur die Kennung liegt vor. Nachtragen, sobald der vollständige Bericht vorliegt. | unbekannt |
| V-019 | Berger Durchgang 4. Prüfauftrag und benötigter Zugang nicht übergeben; nur die Kennung liegt vor. Nachtragen, sobald der vollständige Bericht vorliegt. | unbekannt |
| V-020 | Berger Durchgang 4. Prüfauftrag und benötigter Zugang nicht übergeben; nur die Kennung liegt vor. Nachtragen, sobald der vollständige Bericht vorliegt. | unbekannt |

## Was gut ist und bleiben soll

1. **`withTenant()` als Mandantenkern:** filtert Lesen und Schreiben konsequent und prüft bei `findUnique`/`update`/`delete` die Eigentümerschaft; `tests/db-tenant.test.ts` läuft mit Datenbank grün. Es fehlt nur die Fremdschlüsselprüfung (M-11).
2. **Verschlüsselung und Datensparsamkeit:** Transkripte liegen AES-256-GCM-verschlüsselt in der Datenbank (live geprüft); Sentry ist ohne PII, ohne Replay, ohne Bodies konfiguriert.
3. **Zeitlogik in `src/core/shifts/week.ts`** ist sommerzeitfest und getestet; Serienzeiten bleiben über DST-Wechsel, 29.02. und Jahreswechsel korrekt, Feiertage werden erkannt. Fehler entstehen nur dort, wo diese Hilfsfunktionen umgangen werden (M-26).
4. **Zentrale Statusübergänge** über `fahrtStatusAendern` mit Übergangsmatrix, Event- und Audit-Zeile; die sequentielle Konfliktprüfung in `fahrzeugZuweisen` arbeitet zuverlässig – es fehlt nur die Sperre (M-04).
5. **Anmeldung:** Magic-Link einmalig und 10 Minuten gültig, Logout löscht die Server-Sitzung, Ratenbegrenzung bei Codes, `HttpOnly; SameSite=Lax`, Passwort-Login abgeschaltet, fremde `callbackURL` abgelehnt.
6. **Cron- und Webhook-Endpunkte „fail closed“:** ohne oder mit falschem Geheimnis 401, falsche Methode 405; HSTS, nosniff und Referrer-Policy gesetzt.
7. **Migrationen und Schema deckungsgleich** (`migrate diff` leer, `migrate status` aktuell); `Call.providerCallId unique` hat im Paralleltest tatsächlich eine doppelte Anruf-Zeile verhindert; 200/200 Tests grün mit Datenbank in 3,3 s.
8. **Bewusst geprüft und in Ordnung** (docs/13): Doppelbuchungsprüfung je Fahrgast, Begrenzung der `VehicleLocation`-Tabelle, gezielter `KEIN_FAHRZEUG`-Filter, keine Doppelzählung im Fairness-Tagesplan, Push-404/410-Bereinigung nur der toten Subscription, Mehrgeräte-Push, Mandantentrennung aller geprüften Cron-Routen und Actions.

## Anhang: Zuordnung aller Befunde

| Kennung | Quelle | Original-Titel (gekürzt) | Maßnahme |
|---|---|---|---|
| R1-1 | docs/13 Runde 1 | Cron-Race bei parallelen Automodus-Durchläufen | M-04 (siehe auch M-16) |
| R1-2 | docs/13 Runde 1 | Doppelbuchungs-Ausnahme filtert nach Zeitwert statt Fahrt-Identität | M-07 |
| R1-3 | docs/13 Runde 1 | Rückfahrt über Mitternacht landet auf dem falschen Kalendertag | M-07 |
| R1-4 | docs/13 Runde 1 | Fairness-Scoring ignoriert noch offene Vorschläge | M-30 |
| R1-5 | docs/13 Runde 1 | Vorschlags-Score/ETA wird nie neu berechnet | M-30 |
| R1-6 | docs/13 Runde 1 | „Einmaliger“ Cleanup-Cron ist als Jahres-Cron verdrahtet | M-36 |
| R1-7 | docs/13 Runde 1 | Fahrzeug-Konfliktprüfung ohne Zeitpuffer | M-28 |
| R2-1 | docs/13 Runde 2 | Stiller Fahrzeug-Doppelbuchungs-Race (TOCTOU) in fahrzeugZuweisen | M-04 |
| R2-2 | docs/13 Runde 2 | Schreiben-vor-Status-Prüfung erzeugt „Split-Brain“-Datensatz | M-04 |
| R2-3 | docs/13 Runde 2 | planFuerMorgen setzt „heute schon gelaufen“-Flag nie, wenn die Schleife wirft | M-16 |
| R2-4 | docs/13 Runde 2 | Reine Zeit-Verschiebung eines unbestätigten Vorschlags wird zur echten Zuweisung | M-20 |
| R2-5 | docs/13 Runde 2 | fahrerFaelltAusKern räumt vehicleId/driverId nie ab | M-20 |
| R2-6 | docs/13 Runde 2 | problems[] ist (fast) nur additiv | M-20 |
| R2-7 | docs/13 Runde 2 | Hin-/Rückfahrt-Kopplung (returnOfId) nur geschrieben, nirgends gelesen | M-29 |
| R2-8 | docs/13 Runde 2 | Eskalations-SMS-Dedup für immer an rideId gebunden | M-15 |
| R2-9 | docs/13 Runde 2 | Widersprüchliche Doppel-Push bei Zeit+Fahrzeug-Verschiebung | M-20 (siehe auch M-32) |
| R2-10 | docs/13 Runde 2 | Serien haben keine Bearbeiten/Vorzeitig-Stoppen-Funktion | M-22 |
| R2-11 | docs/13 Runde 2 | Voice-Agent-Werkzeuge prüfen keine Fahrgast-Eigentümerschaft der rideId | M-13 |
| R3-1 | docs/13 Runde 3 | Fahrer kann über Server-Action jeden beliebigen Status setzen | M-05 |
| R3-2 | docs/13 Runde 3 | TOCTOU: Eigentümerprüfung und Schreiben getrennt – alter Fahrer schreibt in Fahrt des neuen | M-04 |
| R3-3 | docs/13 Runde 3 | Stornieren aus jedem Status erlaubt, auch AN_BORD | M-19 |
| R3-4 | docs/13 Runde 3 | Keine Fahrer-Deaktivierung/Offboarding | M-12 |
| R3-5 | docs/13 Runde 3 | Alle Push-Benachrichtigungen teilen denselben tag | M-32 |
| R3-6 | docs/13 Runde 3 | Rolle wird in /fahrer-Server-Actions nie erneut geprüft | M-02 (siehe auch M-05) |
| R3-7 | docs/13 Runde 3 | Offline-Warteschlange: Cross-Tab-Race sendet doppelt | M-31 |
| R3-8 | docs/13 Runde 3 | GPS-Meldung hängt am Vordergrund-Tab | M-33 |
| R3-9 | docs/13 Runde 3 | Dauerhafte Fehler wie Verbindungsabbrüche behandelt und lautlos verworfen | M-31 |
| R3-10 | docs/13 Runde 3 | Service-Worker-Cache mit Fahrgast-PII überlebt Ein-Tages-Frist | M-08 |
| R3-11 | docs/13 Runde 3 | Push-Anmeldung ohne Fehlerbehandlung bei Mandanten-Kollision | M-32 |
| S1-001 | Berger 1 | Abrechnungs-Export ohne Rollenprüfung (live bestätigt) | M-02 |
| S1-002 | Berger 1 | SMS-Platzhalter, Fahrer-Anmelde-Link nie versendet (live bestätigt) | M-03 |
| S1-003 | Berger 1 | ort_suchen liefert Teilstring-Treffer als „sichere“ Adresse | M-06 |
| S1-004 | Berger 1 | Fahrzeugzuweisung ohne Sperre/Transaktion (live bestätigt) | M-04 |
| S1-005 | Berger 1 | Rückfahrt ohne Zeit wird stillschweigend verworfen | M-07 |
| S2-001 | Berger 1 | Server Actions der Disposition ohne Rollenprüfung | M-02 |
| S2-002 | Berger 1 | fahrgast_suchen prüft Telefonnummer nicht gegen Anrufernummer | M-13 |
| S2-003 | Berger 1 | Automodus verlangt GPS „jetzt“ für Fahrten morgen | M-17 |
| S2-004 | Berger 1 | Nachtschichten nicht abbildbar | M-18 |
| S2-005 | Berger 1 | Serien können weder beendet noch geändert werden | M-22 |
| S2-006 | Berger 1 | Fahrgast-/Ortssuche liest nur erste 200/300 Zeilen | M-06 |
| S2-007 | Berger 1 | Geocoding ohne regionalen Bezug | M-06 |
| S2-008 | Berger 1 | withTenant() prüft Fremdschlüssel nicht (live bestätigt) | M-11 |
| S2-009 | Berger 1 | Telefonnummern und Adressen im Server-Protokoll (live bestätigt) | M-09 |
| S2-010 | Berger 1 | Nächtliche Automatik ohne Fehlererkennung | M-16 |
| S2-011 | Berger 1 | Rufnummer-zu-Mandant frei wählbar, Registrierung öffentlich (live bestätigt, verschärft) | M-23 |
| S3-001 | Berger 1 | Zeitrechnung mit Server-Zeitzone an mehreren Stellen | M-26 |
| S3-002 | Berger 1 | Prisma-Wiederholung wiederholt auch Schreibzugriffe | M-27 |
| S3-003 | Berger 1 | Zwei Geocoding-Endpunkte ohne Anmeldung | M-02 |
| S3-004 | Berger 1 | fahrtAendern lässt Fahrzeug/Fahrer stehen, irreführende Push, keine Neuprüfung | M-20 |
| S3-005 | Berger 1 | Storno einer Hinfahrt lässt Rückfahrt stehen | M-29 |
| S3-006 | Berger 1 | Eskalations-SMS nach 2 Minuten für jede Fahrt | M-15 |
| S3-007 | Berger 1 | Kandidatenfilter: Pause sperrt Tag, Schichtende, manuelle Zuweisung ignoriert Pause/Ausfall | M-28 |
| S3-008 | Berger 1 | Abrechnungsexport: keine Fehlfahrten, Markierung vor Download | M-25 |
| S3-009 | Berger 1 | Offline-Warteschlange verwirft fehlgeschlagene Meldungen | M-31 |
| S3-010 | Berger 1 | Keine Bearbeitung von Adresse/Transportart/Datum in der Oberfläche | M-34 |
| S3-011 | Berger 1 | Plan für morgen: Laufmarkierung erst nach dem Lauf | M-16 |
| S3-012 | Berger 1 | Zusammenfassung und Anrufernummer unverschlüsselt und unbefristet (live bestätigt, verschärft) | M-10 |
| S3-013 | Berger 1 | migrate deploy im Build, Demo-Mandant in Produktionsdatenbank | M-01 |
| S3-014 | Berger 1 | Doppelbuchungsprüfung ohne Anfahrt zwischen zwei Fahrten | M-28 |
| S4-001 | Berger 1 | Sicherheitsbericht enthält unzutreffende Aussagen (teilweise live bestätigt) | M-45 |
| S4-002 | Berger 1 | .env.example nennt falsche Variablen | M-03 |
| S4-003 | Berger 1 | vercel.json plant Einmal-Cron jährlich | M-36 |
| S4-004 | Berger 1 | typecheck schlägt auf frischem Checkout fehl | M-38 |
| S4-005 | Berger 1 | Private E-Mail des Auftraggebers im Seed | M-42 |
| S4-006 | Berger 1 | VAPID-Kontakt .invalid | M-42 |
| S4-007 | Berger 1 | Geheimnisvergleich nicht zeitkonstant, kein Replay-Schutz (live bestätigt) | M-14 |
| S4-008 | Berger 1 | KI liest technische Codes und IDs vor | M-43 |
| S4-009 | Berger 1 | Mehrzeilen-Schreiben ohne Transaktion (live bestätigt) | M-23 (siehe auch M-04) |
| S4-010 | Berger 1 | Feiertage fest NRW, Fahrzeug-Deaktivierung, Approval.maxRides | M-44 |
| S1-006 | Berger 2 | npm run seed löscht Betriebsdaten aller Mandanten (live bestätigt) | M-01 |
| S2-012 | Berger 2 | Service Worker cacht Fahrgastdaten und Export unbegrenzt (live bestätigt) | M-08 |
| S2-013 | Berger 2 | Telefonnummern aus Oberfläche/Import nicht normalisiert (live bestätigt) | M-21 |
| S2-014 | Berger 2 | Wiederholter Webhook legt Fahrt erneut an (live bestätigt) | M-14 |
| S2-015 | Berger 2 | Parallele widersprüchliche Statuswechsel beide angenommen (live bestätigt) | M-04 |
| S2-016 | Berger 2 | Fahrgast-Löschung lässt gesundheitsnahe Daten stehen (live bestätigt) | M-10 |
| S2-017 | Berger 2 | Eskalation je Fahrt statt je Zuweisung (live bestätigt) | M-15 |
| S3-015 | Berger 2 | CSV-Export: Formelinjektion (live bestätigt) | M-25 |
| S3-016 | Berger 2 | Fehlerbehandlung an den Rändern: 500 statt 400, kein Body-Limit (live bestätigt) | M-14 |
| S3-017 | Berger 2 | Zuweisung prüft Ausstattung nicht (live bestätigt) | M-28 |
| S3-018 | Berger 2 | 12-Stunden-Grenze gilt nicht für API-Routen (live bestätigt) | M-02 |
| S3-019 | Berger 2 | Fahrer-Rufnummer plattformweit eindeutig | M-35 |
| S3-020 | Berger 2 | Registrierung: verwaiste Mandanten, kein E-Mail-Format (live bestätigt) | M-23 |
| S3-021 | Berger 2 | Playwright-Klickwege tot, keine CI (live bestätigt) | M-38 |
| S3-022 | Berger 2 | Schema: keine CHECKs, fehlende FKs und Indizes | M-37 |
| S3-023 | Berger 2 | Keine Zähl-/Abrechnungslogik für „pro Anruf“ | M-39 |
| S3-024 | Berger 2 | Roh-Transkript landet in Call.summary (live bestätigt) | M-10 |
| S3-025 | Berger 2 | /live liefert Transkripte ohne Anmeldung (live bestätigt) | M-24 |
| S4-011 | Berger 2 | Einmal-Codes im Klartext (live bestätigt) | M-40 |
| S4-012 | Berger 2 | Sicherheits-Header unvollständig (live bestätigt) | M-41 |
| S4-013 | Berger 2 | Ohne RESEND_API_KEY kein Büro-Login, Fehler nur im Log (live bestätigt) | M-03 |
| S4-014 | Berger 2 | Fahrer-Statuswechsel akzeptiert jeden Zielstatus, GPS ungeprüft | M-05 |
| V-005 | Berger 1 → bestätigt in Berger 2 | ORS-Aufrufe je Serie: 504 in einem Webhook | M-14 |
| V-006 | Berger 1 → bestätigt in Berger 2 | Telefonnormalisierung fehlerhaft | M-21 |
| S1-007 | Berger 3 | KI erhält kein Datum/keine Uhrzeit; Fahrten in der Vergangenheit ohne Hinweis | M-46 |
| S2-018 | Berger 3 | Serienfahrten haben kein Startdatum | M-48 |
| S2-019 | Berger 3 | Weiterleitung an einen Menschen technisch nicht angebunden | M-47 |
| S2-020 | Berger 3 | Uhrzeit-/Datumsargumente der KI-Werkzeuge ungeprüft | M-46 |
| S2-021 | Berger 3 | Import: Geburtsdatum vertauscht, Abbruch mitten in der Datei | M-50 |
| S2-022 | Berger 3 | Fahrer-App zeigt Fahrten von morgen ohne Datum | M-51 |
| S2-023 | Berger 3 | Stornierte Fahrten bleiben zugeordnet, Zeitstrahl zeigt „geplant“ | M-49 |
| S2-024 | Berger 3 | Keine Festlegung der Serverregion (EU) | M-52 |
| S3-026 | Berger 3 | Zeitzonenfehler bei Server-Rendering, Hydrationsfehler | M-53 |
| S3-027 | Berger 3 | Fehler von Server Actions in 20 Komponenten verschluckt | M-54 |
| S3-028 | Berger 3 | Einrichtungsassistent prüft nichts Fachliches | M-55 |
| S3-029 | Berger 3 | Vorschlagsrechnung nimmt Termin der Vorfahrt als deren Startzeit | M-56 |
| S3-030 | Berger 3 | Routing ohne Zeitlimit, zwei inkonsistente Fahrzeitmodelle | M-57 |
| S3-031 | Berger 3 | Push-Fehler außer 404/410 verworfen | M-58 |
| S3-032 | Berger 3 | „Ich falle aus“ ohne Rückfrage, kein Rückgängig | M-59 |
| S3-033 | Berger 3 | Pilot-Kennzahlen systematisch verzerrt | M-60 |
| S4-015 | Berger 3 | Gesprächsbericht vor Werkzeugaufruf, parallele Werkzeugaufrufe | M-61 |
| S4-016 | Berger 3 | Projektregeln/Design-Checkliste nicht eingehalten | M-62 |
| S4-017 | Berger 3 | Anmeldeseite: Benutzer-Enumeration ohne Ratenbegrenzung | M-63 |
| S4-018 | Berger 3 | Vapi-Assistent ohne geforderte Einstellungen, Feiertagshinweis unvollständig | M-64 |
| S4-019 | Berger 3 | „Neue Adresse eingeben“ ohne PLZ/Validierung | M-65 |
| B3-A1 | Behebung 3, Aufgefallen Nr. 1 | `fahrtStatusSetzen` offene Büro-Action ohne Oberfläche, umgeht M-20 | M-67 |
| B3-A2 | Behebung 3, Aufgefallen Nr. 2 | Ortsnamen („Wohnung <Name>“) in Fahrer-SMS/-Push | M-66 |
| B3-A3 | Behebung 3, Aufgefallen Nr. 3 | Problemcodes als Rohtext in „Braucht Sie“ | M-68 (siehe auch M-43) |
| B3-A4 | Behebung 3, Aufgefallen Nr. 4 | Zeitrechnung mit Server-Zeitzone an bekannten Stellen | M-26 (Ergänzung, keine neue Maßnahme) |
| B3-A5 | Behebung 3, Aufgefallen Nr. 5 | „Fahrzeug ändern“ im Fahrt-Fenster: Meldung je Fahrer ungeprüft | M-69 |
| B3-A6 | Behebung 3, Aufgefallen Nr. 6 | Testreste „ohne Betriebshof“ bei rotem Lauf | M-70 |
| B3-A7 | Behebung 3, Aufgefallen Nr. 7 | Seed-Schutz-Test entfernt Beispiel-Mandanten der Test-DB | M-71 |
| S1-008 | Berger 4 | Manuelle Zuweisung ohne Schichtprüfung, ausgefallene/deaktivierte Fahrer bekommen Fahrten zurück | M-72 |
| S1-009 | Berger 4 | Verkürzte Serienpause/zurückgenommene Serienänderung löscht Termine dauerhaft | M-73 |
| S2-025 | Berger 4 | Fahrgastname über Ortsnamen in Fahrer-SMS/-Push (bestätigt M-66) | M-66 |
| S2-026 | Berger 4 | KI liest unbekannten Anrufern volle Adresse/Ortsbezeichnung ungeprüft vor | M-74 |
| S2-027 | Berger 4 | Kurztitel nicht übergeben | M-75 |
| S2-028 | Berger 4 | Kurztitel nicht übergeben | M-76 |
| S2-029 | Berger 4 | Kurztitel nicht übergeben | M-77 |
| S3-034 | Berger 4 | `fahrtStatusSetzen` ist eine echte, nutzbare Hintertür um alle Dispositionsregeln (bestätigt und verschärft M-67, hochgestuft auf P1) | M-67 |
| S3-035 | Berger 4 | Kurztitel nicht übergeben | M-78 |
| S3-036 | Berger 4 | Kurztitel nicht übergeben | M-79 |
| S3-037 | Berger 4 | Kurztitel nicht übergeben | M-80 |
| S3-038 | Berger 4 | Kurztitel nicht übergeben | M-81 |
| S4-020 | Berger 4 | Kurztitel nicht übergeben | M-82 |
| S4-021 | Berger 4 | Kurztitel nicht übergeben | M-83 |
| S4-022 | Berger 4 | Kurztitel nicht übergeben | M-84 |
| S4-023 | Berger 4 | Kurztitel nicht übergeben | M-85 |

**Zählung:** docs/13: 29 Kennungen (R1-1…R1-7, R2-1…R2-11, R3-1…R3-11) → 29 zugeordnet. Berger 1: 40 Kennungen (S1-001…S1-005, S2-001…S2-011, S3-001…S3-014, S4-001…S4-010) → 40 zugeordnet. Berger 2: 22 Kennungen (S1-006, S2-012…S2-017, S3-015…S3-025, S4-011…S4-014) → 22 zugeordnet. Berger 3: 21 Kennungen (S1-007, S2-018…S2-024, S3-026…S3-033, S4-015…S4-019) → 21 zugeordnet. Berger 4: 20 Kennungen (S1-008, S1-009, S2-025…S2-029, S3-034…S3-038, S4-020…S4-023) → 20 zugeordnet (9 mit vollem Befund, 11 als Platzhalter „Kurztitel nicht übergeben“). Dazu 2 bestätigte Verdachte (V-005, V-006) in Maßnahmen, 18 offene Verdachte (V-001…V-004, V-007…V-020) im Abschnitt „Vor dem Pilot extern klären“ (davon V-017…V-020 ebenfalls nur als Kennung, ohne übergebenen Prüfauftrag). **Alle 132 Befunde und 20 Verdachte sind genau einmal zugeordnet.** Zusätzlich Behebungsprotokoll Durchgang 3: 7 Beobachtungen (B3-A1…B3-A7) → 7 zugeordnet (6 neue Maßnahmen M-66…M-71, B3-A4 als Ergänzung zu M-26).
