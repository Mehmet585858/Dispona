# Maßnahmenliste Dispona – Stand 30.10.2026

Diese Liste führt drei Prüfberichte zu einer einzigen Reparaturliste ohne Dubletten zusammen.

**Quellen**

| Quelle | Inhalt | Befunde | Verdachte |
|---|---|---|---|
| `docs/13-dispositionspruefung.md` | Drei interne Prüfrunden der Dispositionslogik, des Umplanens und der Fahrer-App. Die Befunde heißen hier R1-1 bis R1-7 (Runde 1), R2-1 bis R2-11 (Runde 2) und R3-1 bis R3-11 (Runde 3), in der Reihenfolge des Dokuments. | 29 | – |
| `docs/pruefberichte/2026-10-30-berger-durchgang-1.md` | Externer Prüfbericht K. Berger, Durchgang 1 (Code-Prüfung ohne Datenbank). | 40 (S1-001 bis S4-010) | 9 (V-001 bis V-009) |
| `docs/pruefberichte/2026-10-30-berger-durchgang-2.md` | Externer Prüfbericht K. Berger, Durchgang 2 (gegen echte Datenbank und laufenden Server). Enthält zusätzlich eine Nachprüfung von 12 Befunden aus Durchgang 1. | 22 (S1-006, S2-012 bis S2-017, S3-015 bis S3-025, S4-011 bis S4-014) | 4 (V-010 bis V-013) |
| **Summe** | | **91 Befunde** | **13 Verdachte** |

**So wurde gezählt**

- Jeder der 91 Befunde ist genau einer Maßnahme zugeordnet (Anhang). Befunde mit derselben Ursache bilden zusammen eine Maßnahme. Wo ein Befund zu zwei Maßnahmen passt, steht er bei der Maßnahme, die die Ursache behebt; die zweite ist als „siehe auch“ vermerkt.
- Nach der Zusammenführung bleiben **45 Maßnahmen**: 7 × P1, 16 × P2, 16 × P3, 6 × P4.
- Zwei Verdachte wurden in Durchgang 2 bestätigt (V-005, V-006) und zählen deshalb als Befund in einer Maßnahme. Die übrigen 11 Verdachte stehen im Abschnitt „Vor dem Pilot extern klären“.
- „live bestätigt“ heißt: Durchgang 2 hat den Fehler gegen eine echte Datenbank oder einen laufenden Server nachgestellt, nicht nur im Code gelesen.

**So sind die Prioritäten zu lesen**

| Priorität | Bedeutung | Regel |
|---|---|---|
| P1 | Pilot-Blocker. Ohne diese Reparaturen darf kein echter Fahrdienst das System nutzen. | enthält mindestens einen S1-Befund oder einen „Kritisch“-Befund |
| P2 | Vor dem Pilot erledigen. | höchste Schwere S2 oder „Hoch“ |
| P3 | In den ersten Pilotwochen erledigen. | höchste Schwere S3 oder „Mittel“ |
| P4 | Später. | höchste Schwere S4 oder „Niedrig“ |

Innerhalb einer Priorität stehen zuerst Maßnahmen, die Datenverlust oder einen Datenschutzverstoß verhindern, dann Maßnahmen gegen Betriebsgefahr für Fahrten (Fahrt fällt aus, falsche Adresse, Doppelbuchung), dann der Rest.

## Auf einen Blick

| Priorität | Anzahl Maßnahmen | Was dahinter steckt |
|---|---|---|
| P1 – Pilot-Blocker | 7 | Ein Entwickler-Befehl löscht alle Kundendaten, jeder Fahrer kann alle Fahrgastdaten herunterladen, Alarm-SMS und Fahrer-Login existieren nicht, Fahrzeuge werden doppelt vergeben, Fahrer können am Büro vorbei stornieren, die KI schickt Fahrer zur falschen Adresse und verliert Rückfahrten. |
| P2 – vor dem Pilot | 16 | Fahrgastdaten im Handy-Cache und im Server-Protokoll, unvollständige Löschung, Mandantengrenze bei Fremdschlüsseln, kein Fahrer-Offboarding, Identität am Telefon nicht geprüft, doppelte Fahrten durch Webhook-Wiederholung, stummer Alarmweg, Nachtautomatik ohne Fehlererkennung und ohne erfüllbare Bedingungen, Nachtschichten, Umplanen, Stammkundenerkennung, Serien, Registrierung. |
| P3 – erste Pilotwochen | 16 | Öffentliche Demo-Seite mit Transkripten, Exportlücken, Zeitzonenfehler, doppelte Schreibzugriffe bei Verbindungsabbruch, unvollständige Endprüfung der Zuweisung, Hin-/Rückfahrt-Kopplung, Vorschlagsqualität, Fahrer-App-Robustheit, Tests und Datenbankschema. |
| P4 – später | 6 | Einmal-Codes im Klartext, fehlende Sicherheits-Header, Platzhalter-Adressen, technische Codes in KI-Antworten, Feiertage/Kleinigkeiten, veralteter Sicherheitsbericht. |

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

#### M-05 Fahrer-Server-Actions absichern: nur erlaubte Status, geprüfte GPS-Werte
- **Problem:** Die Funktion, mit der ein Fahrer „unterwegs / an Bord / erledigt“ meldet, nimmt jeden beliebigen Status vom Handy an. Ein Fahrer kann damit seine Fahrt stornieren (ohne dass das Büro es merkt) oder in die Warteschlange zurückwerfen. GPS-Werte werden ohne Prüfung gespeichert, und eine nie beendete Schicht sendet tagelang Positionen.
- **Zu tun:**
  1. Feste Liste der erlaubten Ziel-Status für Fahrer (`UNTERWEGS`, `AN_BORD`, `ERLEDIGT`, `NICHT_ANGETROFFEN`) zur Laufzeit prüfen (`zod`-Schema); alles andere ablehnen.
  2. `lat`/`lng` auf gültige Bereiche prüfen (−90…90, −180…180, keine `NaN`).
  3. „Laufende Schicht“ zusätzlich auf das aktuelle Datum begrenzen.
- **Betroffene Dateien:** `src/app/fahrer/actions.ts`, `src/core/rides/status.ts`.
- **Erledigt damit:** R3-1 „Fahrer kann über die Server-Action jeden beliebigen Status setzen“, S4-014.
- **Nachweis:** Test: `fahrtStatusSetzenFahrer(…, "STORNIERT")` → abgelehnt; `gpsPositionMelden(999, NaN)` → abgelehnt.

#### M-06 Adress- und Fahrgastsuche über die Datenbank, exakter Adressabgleich, Geocoding mit Regionsbezug
- **Problem:** Sagt ein Anrufer „Hauptstraße 1“, liefert das System den gespeicherten Ort „Hauptstraße 12“ als *sicher* zurück, weil nur geprüft wird, ob der Text irgendwo enthalten ist. Die KI liest die Adresse dann nicht einmal vor. Fahrgast- und Ortssuche laden nur die ersten 200/300 Zeilen ohne Sortierung – ab mittelgroßem Betrieb werden Stammkunden nicht gefunden und doppelt angelegt. Die Adresssuche im Internet (Geocoding) bekommt keinen Hinweis auf das Einsatzgebiet und findet „Kirchstraße 5“ in der Nachbarstadt.
- **Zu tun:**
  1. Ortsabgleich nur dann „sicher“, wenn Straße, Hausnummer **und** PLZ/Ort übereinstimmen; Teiltreffer → „nicht sicher“, KI liest vor und fragt nach.
  2. Fahrgast- und Ortssuche als Datenbankabfrage (`where` auf Name/Straße mit vorhandenem Index), nicht im Speicher über die ersten 300 Zeilen; Namensähnlichkeit (Levenshtein) nur als Zusatz mit Rückfrage.
  3. `serviceAreaCenter` des Mandanten als `near`-Parameter an `routingProvider.geocode()` übergeben, an allen drei Aufrufstellen.
- **Betroffene Dateien:** `src/core/voice/werkzeuge.ts`, `src/providers/routing/openRouteService.ts`, `src/app/dispo/fahrten/actions.ts`, `src/app/einrichtung/[schritt]/actions.ts`.
- **Erledigt damit:** S1-003, S2-006, S2-007.
- **Nachweis:** Die beiden Reproduktionsfälle aus Durchgang 1 („Hauptstraße 1“, „Aachen“) liefern „nicht sicher“ bzw. keinen Treffer; Test mit 500 Fahrgästen findet Zeile 412.

#### M-07 Rückfahrt richtig anlegen: „Zeit offen“, Mitternacht, Doppelbuchungs-Ausnahme
- **Problem:** Bestellt ein Anrufer „mit Rückfahrt, Zeit weiß ich noch nicht“, wird die Rückfahrt stillschweigend verworfen – die KI meldet trotzdem „Fahrt erfasst“. Bei Serien fehlt die Rückfahrt dann für jeden Termin. Eine Rückfahrt nach Mitternacht landet am Tag der Hinfahrt, also 23 Stunden *vor* der Hinfahrt. Und beim Anlegen der Rückfahrt werden alle Fahrten des Fahrgasts mit exakt derselben Uhrzeit aus der Doppelbuchungsprüfung ausgeblendet, nicht nur die zugehörige Hinfahrt.
- **Zu tun:**
  1. Fachkonzept „Rückfahrt ja, Zeit offen“: Rückfahrt wird mit Kennzeichen `rueckfahrtZeitOffen` angelegt und landet in „Braucht Sie“; `rueckfahrt: true` ohne Zeit darf nicht mehr still durchrutschen (Validierung).
  2. Rückfahrtzeit kleiner als Hinfahrtzeit → Folgetag; Prüfung `rueckfahrt > hinfahrt` in der Validierung.
  3. Doppelbuchungs-Ausnahme über die Fahrt-ID der Hinfahrt (`returnOfId`), nicht über den Zeitwert.
- **Betroffene Dateien:** `src/core/rides/erfassen.ts`, `src/core/rides/validation.ts`, `src/core/rides/pruefungen.ts`, `src/core/rides/serie.ts`, `src/providers/voice/vapi.ts` (Werkzeugschema).
- **Erledigt damit:** S1-005, R1-2 „Doppelbuchungs-Ausnahme filtert nach Zeitwert statt Fahrt-Identität“, R1-3 „Rückfahrt über Mitternacht landet auf dem falschen Kalendertag“.
- **Nachweis:** Tests: `rueckfahrt: true, rueckfahrtzeit: ""` → zwei Fahrten, zweite mit Problem „Zeit offen“; Hinfahrt 23:30 / Rückfahrt 00:15 → Rückfahrt am Folgetag; zweite echte Fahrt zur selben Uhrzeit → `DOPPELBUCHUNG` gemeldet.

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

#### M-09 Keine Telefonnummern und Adressen im Server-Protokoll
- **Problem:** Der SMS-Platzhalter und der Push-Ersatzweg schreiben Fahrer-Handynummer und Abholadresse („Neue Fahrt 06:30 Hauptstraße 12 → Dialyse“) in das Server-Protokoll, auch in Produktion. Das verstößt gegen die Projektregel und gegen den eigenen Sicherheitsbericht.
- **Zu tun:**
  1. Beide Log-Zeilen nur noch bei `istEntwicklung`, und dort ohne Rufnummer/Adresse (nur IDs).
  2. Push-Fallback ohne VAPID-Schlüssel wirft einen Fehler statt den Text zu loggen.
  3. Lint-Regel: kein `console.log` außerhalb `src/lib/logging`.
- **Betroffene Dateien:** `src/providers/sms/index.ts`, `src/core/notify/push.ts`.
- **Erledigt damit:** S2-009 (live bestätigt).
- **Nachweis:** Test mit `NODE_ENV=production` fängt `console.log` ab und erwartet keine Ausgabe mit `+49` oder Ortsnamen.

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

#### M-11 Mandantenprüfung für Fremdschlüssel in `withTenant()`
- **Problem:** `withTenant()` trennt die Mandanten auf der Zieltabelle sauber, prüft aber nicht, ob verknüpfte Zeilen (Fahrgast, Ort, Fahrer, Fahrzeug) zum selben Mandanten gehören. Mit einer fremden ID lässt sich eine Fahrt an den Fahrgast eines anderen Fahrdienstes hängen; Mandant A sieht dann dessen Namen und Geburtsdatum in seiner Fahrtliste, und Einsatzgebiets- und Genehmigungsprüfung werden still übersprungen.
- **Zu tun:**
  1. Bei `create`/`update` über `withTenant()` jede referenzierte ID (`passengerId`, `pickupPlaceId`, `dropoffPlaceId`, `driverId`, `vehicleId`) gegen den Mandanten prüfen; Fremdtreffer → Fehler.
  2. Aufrufer behandeln „nicht gefunden“ als Fehler, nicht als „keine Zusatzdaten“ (`erfassen.ts`, `werkzeuge.ts`, `schichtMusterAnlegen`, `genehmigungSpeichern`, `pushAboSpeichern`).
  3. `tests/db-tenant.test.ts` um Fremdschlüssel- und `include`-Fälle erweitern.
- **Betroffene Dateien:** `src/lib/db.ts`, `src/core/rides/erfassen.ts`, `src/core/voice/werkzeuge.ts`, `src/app/dispo/fahrer/actions.ts`, `src/app/dispo/fahrgaeste/actions.ts`.
- **Erledigt damit:** S2-008 (live bestätigt). Siehe auch M-45 (Sicherheitsbericht Punkt 1).
- **Nachweis:** Datenbanktest: `fahrtErfassen(tenantA, { passengerId: <B> })` → Fehler, keine Fahrt angelegt.

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

#### M-15 Eskalation je Zuweisung statt je Fahrt, nur für zeitnahe Fahrten
- **Problem:** Der Alarm „Fahrer hat nicht bestätigt“ feuert pro Fahrt genau einmal. Wird die Fahrt danach einem anderen Fahrer gegeben, der ebenfalls nicht reagiert, kommt kein zweiter Alarm und kein Inhaber-Alarm – nachts steht niemand vor der Tür. Umgekehrt feuert die SMS schon zwei Minuten nach jeder Zuweisung, auch für Fahrten nächste Woche: beim Plan für morgen gehen 90 SMS auf einmal raus, die Fahrer stumpfen ab.
- **Zu tun:**
  1. Dedup-Schlüssel der Benachrichtigung auf `(rideId, driverId, Zuweisungszeitpunkt)` umstellen, für `KEINE_BESTAETIGUNG_FAHRER` und `KEINE_BESTAETIGUNG_INHABER`; `fahrzeugZuweisen` setzt beim Fahrerwechsel die Eskalation zurück.
  2. Eskalation nur, wenn die Fahrt in weniger als 60 Minuten beginnt (laut `docs/05`), mit 5 Minuten Frist; Fahrten für später werden erst in diesem Fenster geprüft.
  3. Gleiches Muster für `keinFahrzeugAlarmPruefen`.
- **Betroffene Dateien:** `src/core/notify/eskalation.ts`, `src/core/disposition/zuweisen.ts`, `prisma/schema.prisma` (Notification-Index).
- **Erledigt damit:** S2-017 (live bestätigt), R2-8 „Eskalations-SMS-Dedup ist für immer an die rideId gebunden“, S3-006.
- **Nachweis:** Reproduktionstest aus Durchgang 2: Fahrer 1 eskaliert, Umbesetzung auf Fahrer 2, 5 Minuten → `smsAnFahrer` 1 für Fahrer 2; Zuweisung für morgen → keine SMS.

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

#### M-17 Automodus-Bedingungen für Vorausplanung neu fassen (GPS-Frische gilt nur für Sofortfahrten)
- **Problem:** Die Nachtautomatik verlangt für jede zweite Fahrt eines Fahrzeugs eine GPS-Position, die höchstens 10 Minuten alt ist – um 3 Uhr nachts, für Fahrten am nächsten Morgen. Das ist nie erfüllbar, weil die Fahrer-App nur bei geöffnetem Browser GPS sendet. Ergebnis: nachts wird fast nur die erste Fahrt je Fahrzeug disponiert, morgens liegt derselbe Berg wie ohne System in „Braucht Sie“. Die Demo umgeht das mit künstlichen GPS-Zeilen.
- **Zu tun:**
  1. Unterscheidung Sofort-Disposition (Fahrt in < 60 Minuten: GPS-Frische gilt) und Vorausplanung (Fahrt später: Startort ist Betriebshof bzw. Zielort der vorherigen geplanten Fahrt, kein GPS nötig).
  2. `docs/05` Bedingung 3 entsprechend präzisieren; Demo-Umgehung in `betriebSimulieren.ts` entfernen.
- **Betroffene Dateien:** `src/core/disposition/automatischDisponieren.ts`, `src/core/disposition/planFuerMorgen.ts`, `src/core/demo/betriebSimulieren.ts`, `docs/05-disposition.md`.
- **Erledigt damit:** S2-003.
- **Nachweis:** Test: 3 Fahrten für morgen auf ein Fahrzeug ohne GPS-Daten → alle drei im Automodus disponiert, sofern die übrigen Bedingungen erfüllt sind; Fahrt in 30 Minuten ohne GPS → weiterhin `autoSkipReason`.

#### M-18 Nachtschichten über Mitternacht abbilden
- **Problem:** Eine Schicht 22:00–06:00 wird mit Ende *vor* Beginn gespeichert. Nachts findet das System deshalb nie einen Fahrer im Dienst – genau dann, wenn der Automodus arbeiten soll.
- **Zu tun:**
  1. Liegt die Endzeit vor der Startzeit, endet die Schicht am Folgetag (`tagVerschieben` aus `week.ts`).
  2. Validierung `end > start` nach dieser Umrechnung; Formular zeigt „bis 06:00 (Folgetag)“.
  3. Alle Kandidatenfilter und `findeAktiveSchicht` mit einer Mitternachtsschicht testen.
- **Betroffene Dateien:** `src/app/dispo/fahrer/actions.ts`, `src/core/drivers/validation.ts`, `src/core/shifts/dauer.ts`, `src/app/dispo/fahrer/FahrerClient.tsx`.
- **Erledigt damit:** S2-004. Siehe auch M-37 (CHECK-Constraint auf Datenbankebene).
- **Nachweis:** Reproduktionstest aus Durchgang 1: Muster 22:00–06:00 → `findeAktiveSchicht` um 02:00 liefert die Schicht.

#### M-19 Stornieren nur vor der Abholung, abhängig vom Status
- **Problem:** Eine Fahrt lässt sich stornieren, während der Fahrgast schon im Fahrzeug sitzt – aus der Dispo-Oberfläche, aus der DSGVO-Löschung und über die KI am Telefon. Die Fahrt verschwindet dann einfach vom Handy des Fahrers, mit derselben Meldung wie ein Storno vor Abholung.
- **Zu tun:**
  1. Übergänge `UNTERWEGS → STORNIERT` und `AN_BORD → STORNIERT` aus der Übergangstabelle entfernen; stattdessen „Fahrt abgebrochen“ als eigener Vorgang nur für das Büro, mit eigener Push-Meldung und Rückfrage.
  2. Voice-Agent: Storno nur für Fahrten mit Status `ERFASST`/`VORGESCHLAGEN`/`DISPONIERT`; sonst Weiterleitung an einen Menschen.
  3. Dispo-Oberfläche: Storno-Knopf bei laufender Fahrt ausblenden bzw. deutlich anders beschriften.
- **Betroffene Dateien:** `src/core/rides/stornieren.ts`, `src/core/rides/status.ts`, `src/app/dispo/fahrten/TripModal.tsx`, `src/core/passengers/loeschung.ts`, `src/core/voice/werkzeuge.ts`.
- **Erledigt damit:** R3-3 „Stornieren ist aus jedem Status erlaubt, auch AN_BORD“.
- **Nachweis:** Test: `fahrtStornieren` bei `AN_BORD` → abgelehnt; Voice-Werkzeug bei `UNTERWEGS` → Hinweis „bitte an Mitarbeiter“.

#### M-20 Umplanen und Umbesetzen aufräumen: Vorschlag bleibt Vorschlag, alte Zuweisung wird gelöscht, Probleme werden bereinigt, nur eine Push
- **Problem:** Wer im Zeitstrahl einen noch unbestätigten Vorschlag nur leicht in der Zeit verschiebt, macht ihn ungefragt zur festen Zuweisung – der Bestätigungsschritt entfällt, der Fahrer bekommt „Neue Fahrt“. Fällt ein Fahrer aus oder wird eine Fahrt geändert, bleiben Fahrzeug und Fahrer an der Fahrt stehen: die Fahrt klebt visuell am falschen Wagen, der Konfliktcheck hält das Fahrzeug für belegt, der Fahrer sieht die Fahrt weiter mit irreführender Meldung. Die Problemliste einer Fahrt wächst nur, wird nie bereinigt – Fahrten hängen dauerhaft in „Braucht Sie“ mit längst überholtem Grund. Bei kombinierter Zeit-und-Fahrer-Änderung bekommt derselbe Fahrer erst „geändert“, dann „entzogen“.
- **Zu tun:**
  1. `fahrtVerschieben`: Verschieben eines `VORGESCHLAGEN`-Chips ändert nur die Zeit und rechnet den Vorschlag neu; `fahrzeugZuweisen` nur bei Zeilenwechsel oder ausdrücklicher Bestätigung.
  2. `fahrerFaelltAusKern` und `fahrtAendern` setzen `vehicleId`/`driverId`/`driverAckAt` auf `null` (wie `fahrzeugZuweisungAufheben`); nach Adress-/Zeitänderung läuft `fahrtPruefen` erneut.
  3. `problems[]` wird bei jeder Neuprüfung komplett neu berechnet, nicht ergänzt; `fahrtAendern` behandelt Status `PROBLEM` und führt zurück in die Vorschlagspipeline.
  4. Eine Änderung = eine Push: `fahrtAendern` und `fahrzeugZuweisen` sammeln Benachrichtigungen und schicken pro Fahrer genau eine passende Meldung („entzogen“ schlägt „geändert“).
  5. Push-Text bei Entzug korrekt („Fahrt 09:30 wurde dir entzogen“), nicht „geändert, App öffnen“.
- **Betroffene Dateien:** `src/app/dispo/fahrten/actions.ts` (`fahrtVerschieben`), `src/app/dispo/fahrten/Zeitstrahl.tsx`, `src/core/rides/fahrerAusfall.ts`, `src/core/rides/aendern.ts`, `src/core/disposition/zuweisen.ts`, `src/core/disposition/vorschlagSpeichern.ts`, `src/core/rides/erfassen.ts`.
- **Erledigt damit:** R2-4 „Reine Zeit-Verschiebung eines unbestätigten Vorschlags macht ihn ungefragt zur echten Zuweisung“, R2-5 „fahrerFaelltAusKern räumt vehicleId/driverId nie ab“, R2-6 „problems[] ist (fast) nur additiv“, R2-9 „Widersprüchliche Doppel-Push bei kombinierter Zeit+Fahrzeug-Verschiebung“, S3-004. Siehe auch M-34 (Bearbeiten in der Oberfläche).
- **Nachweis:** Tests: Zeitverschiebung eines Vorschlags → Status bleibt `VORGESCHLAGEN`, keine Push; Fahrerausfall → `vehicleId === null`; Fahrt mit altem „Fahrer fällt aus“-Problem nach Neubesetzung → `problems` leer; kombinierte Änderung → genau eine Push je Fahrer.

#### M-21 Zentrale Telefonnormalisierung beim Schreiben (E.164)
- **Problem:** Telefonnummern aus Oberfläche und Import werden unverändert gespeichert („0171 2345678“), die KI sucht aber nur das Normalformat („+491712345678“). Kein einziger im Büro angelegter oder importierter Stammkunde wird am Telefon erkannt; jeder Anruf legt eine Dublette ohne Genehmigung an, der Automodus disponiert nichts. Die Normalisierungsfunktion selbst ist fehlerhaft (bestätigt): „0049 171 …“ wird zu „+490491…“, eine niederländische Nummer wird deutsch.
- **Zu tun:**
  1. `telefonNormalisieren` auf eine Bibliothek nach E.164-Standard (internationales Rufnummernformat) umbauen, z. B. `libphonenumber-js`, mit Standardland DE.
  2. Normalisierung beim **Schreiben** in `fahrgastSpeichern`, `fahrgaesteImportieren`, `fahrerEinladen`, `fahrerImportieren` und in der KI; Suche ebenfalls über den normalisierten Wert.
  3. Migration, die alle vorhandenen `Passenger.phones` und Fahrer-Rufnummern einmalig normalisiert.
- **Betroffene Dateien:** `src/core/passengers/validation.ts`, `src/core/voice/werkzeuge.ts`, `src/app/dispo/fahrgaeste/actions.ts`, `src/app/dispo/fahrten/actions.ts`, `src/lib/telefon.ts` (bzw. Ort von `telefonNormalisieren`), `prisma/migrations/`.
- **Erledigt damit:** S2-013 (live bestätigt), V-006 (bestätigt). Siehe auch M-35 (Fahrer-Rufnummer je Mandant).
- **Nachweis:** Tests für alle Formate aus Durchgang 2 („0049 171 …“, „+49 (0) 171 …“, „0031…“) ergeben die korrekte E.164-Nummer; Datenbanktest: Fahrgast über Oberfläche mit „0171 2345678“ gespeichert → KI-Suche findet ihn.

#### M-22 Serien beenden, pausieren und ändern
- **Problem:** Eine Dialyse-Serie läuft nach Anlage unverändert bis zum Enddatum weiter – auch nach Umzug, Zentrumswechsel oder Tod. Es gibt weder in der Oberfläche noch für die KI eine Funktion, eine Serie zu beenden oder anzupassen; nachts entstehen immer neue Fahrten. Einziger Ausweg ist, jeden Termin einzeln zu stornieren oder den Fahrgast zu löschen.
- **Zu tun:**
  1. Funktionen `serieBeenden(ab Datum)`, `seriePausieren(von, bis)` und `serieAendern(Vorlage)` in `core/rides/serie.ts`; Beenden storniert alle künftigen Fahrten der Serie.
  2. Oberfläche: Serien beim Fahrgast anzeigen mit „Beenden“/„Ändern“.
  3. KI-Werkzeug `serie_beenden` mit Identitätsprüfung (M-13).
- **Betroffene Dateien:** `src/core/rides/serie.ts`, `src/app/dispo/fahrgaeste/**`, `src/core/voice/werkzeuge.ts`, `src/providers/voice/vapi.ts`.
- **Erledigt damit:** S2-005, R2-10 „Serien (RideSeries) haben keine Bearbeiten/Vorzeitig-Stoppen-Funktion“.
- **Nachweis:** Test: Serie beenden → künftige Fahrten `STORNIERT`, `serienVerlaengern` erzeugt keine neuen.

#### M-23 Registrierung und Rufnummern-Zuordnung absichern, Mehrzeilen-Schreibvorgänge in Transaktionen
- **Problem:** Jeder kann ohne Bestätigung beliebig viele Fahrdienste anlegen und jede beliebige Rufnummer als „seine“ KI-Nummer eintragen – wer schneller ist als der echte Kunde, erhält dessen Anrufe samt Fahrgastdaten. Zwei gleichzeitige Registrierungen mit derselben E-Mail hinterlassen zwei Firmen und einen Nutzer (bestätigt). Dasselbe Muster „mehrere Zeilen ohne Transaktion“ steckt in `fahrerEinladen` (Nutzer ohne Fahrerprofil) und `fahrtErfassen` (halbe Fahrt als `ENTWURF`).
- **Zu tun:**
  1. Rufnummern werden nur vom Dispona-Betreiber einem Mandanten zugewiesen (Admin-Werkzeug), nicht vom Kunden frei eingetragen.
  2. Registrierung: E-Mail-Bestätigung vor Freischaltung, Ratenbegrenzung, Formatprüfung; `tenant.create` + `user.create` in einer Transaktion; zweite Anfrage → verständliche Fehlermeldung statt 500.
  3. `fahrerEinladen` und `fahrtErfassen` (Hin- und Rückfahrt, Suggestion) ebenfalls in `$transaction`.
- **Betroffene Dateien:** `src/app/(auth)/registrieren/actions.ts`, `src/app/einrichtung/[schritt]/actions.ts`, `src/core/voice/mandant.ts`, `src/app/dispo/fahrer/actions.ts`, `src/core/rides/erfassen.ts`.
- **Erledigt damit:** S2-011 (live bestätigt, verschärft), S3-020 (live bestätigt), S4-009 (live bestätigt). Siehe auch M-04.
- **Nachweis:** Test: zwei parallele `firmaRegistrieren` mit gleicher E-Mail → 1 Tenant, 1 User, zweiter Aufruf mit klarer Meldung; `kiNummerSpeichern` ohne Betreiber-Rolle → abgelehnt.

### P3 – in den ersten Pilotwochen

#### M-24 Öffentliche Seite `/live` ohne Gesprächstranskripte
- **Problem:** Die Demo-Seite `/live` liefert ohne Anmeldung entschlüsselte Gesprächsprotokolle und den Tagesplan des Demo-Mandanten. Heute sind das simulierte Daten; sobald die beworbene Demo-Nummer freigeschaltet wird, liest jeder Website-Besucher die Gespräche echter Anrufer.
- **Zu tun:**
  1. `liveTranskriptLaden` entfernen oder durch eine anonymisierte, fest hinterlegte Beispielfassung ersetzen.
  2. Demo-Mandant technisch von echten Rufnummern trennen (keine echte Nummer darf auf den Demo-Mandanten zeigen).
- **Betroffene Dateien:** `src/app/live/actions.ts`, `src/app/live/page.tsx`.
- **Erledigt damit:** S3-025 (live bestätigt). Siehe auch V-010 (Verdacht).
- **Nachweis:** Aufruf von `/live` ohne Sitzung enthält kein Transkript; `grep decrypt src/app/live` leer.

#### M-25 Abrechnungsexport: Fehlfahrten, Markierung erst nach Download, keine Formeln in CSV
- **Problem:** Der Export enthält nur erledigte Fahrten, keine Fehlfahrten (bei vielen Kassen abrechenbar). Die Fahrten werden als „exportiert“ markiert, bevor die Datei fertig ist – bricht der Download ab, fehlen sie im Standardexport. Fahrgastnamen, die mit `=`, `+`, `-` oder `@` beginnen, werden in Excel als Formel ausgeführt (Formelinjektion, bestätigt).
- **Zu tun:**
  1. `NICHT_ANGETROFFEN` als eigene Zeile mit Kennzeichen „Fehlfahrt“ aufnehmen.
  2. `exportedAt` erst setzen, wenn die Datei vollständig erzeugt ist (oder per Bestätigungs-Klick „Export übernommen“); Export-Protokoll mit laufender Nummer.
  3. Zellen mit führendem Formelzeichen durch `'` entschärfen, in Export und Import.
- **Betroffene Dateien:** `src/app/api/export/abrechnung/route.ts`, `src/core/export/abrechnung.ts`, `src/app/dispo/fahrgaeste/actions.ts` (Import).
- **Erledigt damit:** S3-008, S3-015 (live bestätigt).
- **Nachweis:** Test: Fahrgast „=HYPERLINK(…)“ → CSV-Zelle beginnt mit `'`; Export-Abbruch → `exportedAt` bleibt `null`.

#### M-26 Zeitrechnung überall über `week.ts` (Europe/Berlin statt Server-Zeitzone)
- **Problem:** An sieben Stellen wird „heute“ mit der Zeitzone des Servers (UTC auf Vercel) berechnet statt mit Berlin. Tagesgrenzen liegen 1–2 Stunden falsch; an Umstellungstagen fehlt eine Stunde im Tagesplan (Doppelbelegung möglich) oder eine Stunde zählt doppelt; Export und Auswertung zeigen falsche Tagessummen.
- **Zu tun:**
  1. Alle `new Date(y, m, d)`/`setDate(+1)`-Konstruktionen durch `berlinerMitternacht`/`tagVerschieben` aus `src/core/shifts/week.ts` ersetzen.
  2. Lint-Regel gegen `setDate(`/`setHours(` außerhalb `week.ts`.
- **Betroffene Dateien:** `src/core/disposition/automatischDisponieren.ts`, `src/core/disposition/vorschlagSpeichern.ts`, `src/core/disposition/planFuerMorgen.ts`, `src/app/api/export/abrechnung/route.ts`, `src/app/dispo/fahrten/actions.ts`, `src/app/dispo/fahrer/actions.ts`, `src/app/dispo/auswertung/actions.ts`.
- **Erledigt damit:** S3-001.
- **Nachweis:** Tests mit `TZ=UTC` für 25.10.2026 und 28.03.2027: Tagesfenster exakt 25 bzw. 23 Stunden, Fahrt um 00:30 Berlin zählt zum richtigen Tag.

#### M-27 Prisma-Wiederholung nur für Lesezugriffe
- **Problem:** Bei Verbindungsabbruch wiederholt die Datenbankschicht automatisch jeden Befehl, auch Schreibbefehle. Hat die Datenbank den ersten Befehl schon ausgeführt, entsteht eine zweite Fahrt oder ein zweites Ereignis.
- **Zu tun:**
  1. Wiederholung nur für `findMany`/`findUnique`/`findFirst`/`count`.
  2. Für Schreibzugriffe stattdessen klare Fehlermeldung an den Aufrufer; wo nötig Idempotenz-Schlüssel (z. B. `callId` + Fahrtzeit).
- **Betroffene Dateien:** `src/lib/prisma.ts`.
- **Erledigt damit:** S3-002.
- **Nachweis:** Test: simulierter `ECONNRESET` bei `ride.create` → genau ein Versuch, Fehler wird geworfen; bei `findMany` → bis zu drei Versuche.

#### M-28 Endprüfung der Zuweisung vervollständigen: Anfahrt, Puffer, Ausstattung, Pause und Ausfall
- **Problem:** Die letzte Prüfung vor der Zuweisung schaut nur, ob sich zwei Zeitfenster überschneiden. Dass das Fahrzeug 25 km Anfahrt zwischen zwei Fahrten braucht, dass eine Rollstuhl- oder Liegendfahrt auf einem PKW ohne Rampe landet (bestätigt), dass der Fahrer in der Pause ist, ausgefallen ist oder seine Schicht vor Fahrtende endet – all das prüft nur die Vorschlagsrechnung, nicht die manuelle Zuweisung per Klick oder Drag. Umgekehrt sperrt eine Mittagspause das Fahrzeug für alle Vorschläge des restlichen Tages.
- **Zu tun:**
  1. `fahrzeugZuweisen` prüft zusätzlich: `erfuelltAusstattung`, Anfahrtszeit zwischen Vorgänger-Ziel und Abholort (Routing oder Luftlinie) plus `folgefahrtPufferMinuten`, Schicht bis Fahrtende, `unavailable`/`onBreak` des Fahrers.
  2. Pause im Kandidatenfilter nur für die Abholzeit bewerten, nicht als Tagesflag.
  3. Bei Verstoß im manuellen Modus: Warnung mit ausdrücklicher Bestätigung („Trotzdem zuweisen“), im Automodus: Ablehnung.
- **Betroffene Dateien:** `src/core/disposition/zuweisen.ts`, `src/core/disposition/kandidaten.ts`, `src/core/disposition/vorschlagen.ts`.
- **Erledigt damit:** S3-014, R1-7 „Fahrzeug-Konfliktprüfung ohne Zeitpuffer“, S3-017 (live bestätigt), S3-007.
- **Nachweis:** Tests: Rollstuhlfahrt auf PKW → `FahrzeugKonfliktError` bzw. Warnung; Fahrt A endet 08:30 Köln-Süd, Fahrt B 08:35 Köln-Nord → Konflikt; Fahrer in Pause um 12:30 bleibt Kandidat für 15:00.

#### M-29 Hin- und Rückfahrt als Paar behandeln
- **Problem:** Hin- und Rückfahrt sind in der Datenbank verknüpft (`returnOfId`), aber die Verknüpfung wird nirgends gelesen. Wird die Hinfahrt storniert oder verschoben, bleibt die Rückfahrt unverändert stehen – der Fahrer fährt zum Dialysezentrum, niemand ist da.
- **Zu tun:**
  1. `fahrtStornieren` fragt bei einer Hinfahrt mit Rückfahrt nach („Rückfahrt auch stornieren?“); KI-Werkzeug storniert beide, wenn der Anrufer den Tag absagt.
  2. `fahrtAendern`/`fahrtVerschieben` zeigt einen Hinweis auf die verknüpfte Rückfahrt; Oberfläche zeigt das Paar.
  3. Fremdschlüssel auf `returnOfId` ergänzen (M-37).
- **Betroffene Dateien:** `src/core/rides/stornieren.ts`, `src/core/rides/aendern.ts`, `src/core/voice/werkzeuge.ts`, `src/app/dispo/fahrten/TripModal.tsx`.
- **Erledigt damit:** R2-7 „Hin-/Rückfahrt-Kopplung (returnOfId) ist nur geschrieben, nirgends gelesen“, S3-005.
- **Nachweis:** Test: Hinfahrt stornieren mit Option „Paar“ → Rückfahrt `STORNIERT`; `grep returnOfId src/core` zeigt Lesezugriffe.

#### M-30 Vorschlagsrechnung aktuell halten: offene Vorschläge mitzählen, Score vor dem Automodus neu berechnen
- **Problem:** Die Fairness-Verteilung zählt nur bestätigte Fahrten, nicht die noch offenen Vorschläge – mehrere kurz nacheinander gebuchte Fahrten landen alle beim selben „unterausgelasteten“ Wagen. Und der Automodus übernimmt Score und Ankunftszeit aus dem Moment der Fahrt-Anlage, auch wenn die Fahrt tagelang gewartet hat.
- **Zu tun:**
  1. Tagesplan für `auslastungDifferenzBerechnen` schließt `VORGESCHLAGEN`-Fahrten mit ihrem vorgeschlagenen Fahrzeug ein.
  2. `pruefeBesterVorschlag` rechnet Score/ETA zum Zeitpunkt der Entscheidung neu (oder der Vorschlag wird verworfen, wenn er älter als X Stunden ist).
- **Betroffene Dateien:** `src/core/disposition/vorschlagSpeichern.ts`, `src/core/disposition/vorschlagen.ts`, `src/core/disposition/automatischDisponieren.ts`.
- **Erledigt damit:** R1-4 „Fairness-Scoring ignoriert noch offene Vorschläge“, R1-5 „Vorschlags-Score/ETA wird nie neu berechnet“.
- **Nachweis:** Test: drei gleichartige Fahrten nacheinander → nicht alle beim selben Fahrzeug; Vorschlag mit veralteten Daten → Neuberechnung sichtbar im Log.

#### M-31 Offline-Warteschlange der Fahrer-App: Fehlerarten unterscheiden, kein Doppelsenden
- **Problem:** Meldungen wie „Fahrgast an Bord“, die unterwegs im Funkloch entstehen, werden später nachgesendet. Schlägt das Nachsenden fehl – egal ob Netzfehler oder echte Ablehnung durch den Server –, wird die Meldung nach einem Versuch stillschweigend gelöscht; die App zeigt weiter den optimistisch gesetzten Status, Abrechnungskilometer werden geschätzt statt gemessen. Zwei offene Tabs senden denselben Eintrag doppelt.
- **Zu tun:**
  1. Fehlerklassen trennen: Netzwerkfehler → erneut versuchen (mit Begrenzung); fachliche Ablehnung (403, ungültiger Übergang) → Eintrag entfernen **und** UI zurückrollen mit Hinweis an den Fahrer.
  2. Warteschlange über das Cross-Tab-`storage`-Event und eine Sperre je Eintrag synchronisieren; Server-Seite idempotent (Status-Update mit Bedingung aus M-04, `problemMelden` mit Dedup-Schlüssel).
- **Betroffene Dateien:** `src/app/fahrer/OfflineSync.tsx`, `src/app/fahrer/warteschlange.ts`, `src/app/fahrer/FahrerClient.tsx`.
- **Erledigt damit:** S3-009, R3-9 „Dauerhafte Fehler werden wie Verbindungsabbrüche behandelt und dann lautlos verworfen“, R3-7 „Offline-Warteschlange: Cross-Tab-Race sendet doppelt“.
- **Nachweis:** Komponententests: 500 → Eintrag bleibt und wird erneut versucht; 403 → Eintrag weg, Status zurückgesetzt, Hinweis sichtbar; zwei Tabs → ein Sendevorgang.

#### M-32 Push-Benachrichtigungen: eindeutiger `tag`, Fehler bei der Anmeldung sichtbar
- **Problem:** Alle Push-Meldungen tragen denselben Schlüssel, so dass die zweite die ungelesene erste im Handy still ersetzt – „Fahrt entzogen“ kann so unsichtbar bleiben. Scheitert die Push-Anmeldung (z. B. weil das Gerät schon bei einem anderen Fahrdienst registriert ist), gibt es keine Fehlermeldung; der Fahrer bleibt dauerhaft ohne Push.
- **Zu tun:**
  1. `pushAnFahrer` vergibt `tag = <kind>-<rideId>`; `sw.js` nutzt ihn.
  2. `PushAktivieren.tsx` mit `try/catch`, verständlicher Fehlertext, Möglichkeit das alte Abonnement zu lösen.
- **Betroffene Dateien:** `public/sw.js`, `src/core/notify/push.ts`, `src/app/fahrer/PushAktivieren.tsx`, `src/lib/db.ts`.
- **Erledigt damit:** R3-5 „Alle Push-Benachrichtigungen teilen denselben tag“, R3-11 „Push-Anmeldung hat keine Fehlerbehandlung für die Mandanten-Kollisionsprüfung“.
- **Nachweis:** Test: zwei Pushs für dieselbe Fahrt haben verschiedene Tags; Mandanten-Kollision → Fehlertext im UI.

#### M-33 GPS-Erfassung auch bei geöffneter Navigation
- **Problem:** Die App sendet GPS nur, solange ihr Tab im Vordergrund ist. Der eigene Navigations-Knopf öffnet Google Maps und schickt die App in den Hintergrund – genau während der Fahrt veraltet die Position.
- **Zu tun:**
  1. Navigation per Deep-Link in derselben Ansicht anbieten oder nach Rückkehr sofort eine Position senden; Hinweis an den Fahrer, die App geöffnet zu lassen.
  2. Fallback: letzte bekannte Position bei Statuswechsel mitsenden (Statuswechsel passiert ohnehin im Vordergrund).
  3. Prüfen, ob eine native Hülle (Capacitor) mit Hintergrund-GPS für den Pilot nötig ist – Entscheidung mit dem Auftraggeber.
- **Betroffene Dateien:** `src/app/fahrer/GpsTracking.tsx`, `src/app/fahrer/FahrerClient.tsx`.
- **Erledigt damit:** R3-8 „GPS-Meldung hängt am Vordergrund-Tab“.
- **Nachweis:** Gerätetest auf Android und iOS: Position nach Navigation-Rückkehr höchstens 1 Minute alt; Statuswechsel trägt Koordinaten.

#### M-34 Fahrt in der Oberfläche bearbeiten
- **Problem:** Der Disponent kann Adresse, Transportart, Datum oder Unterlagen einer Fahrt nicht ändern. Ein KI-Fehler heißt Storno plus Neuerfassung – zwei verwirrende Pushs an den Fahrer.
- **Zu tun:**
  1. Bearbeiten-Dialog im `TripModal` für Adresse, Zeit, Datum, Transportart, Hinweise; ruft `fahrtAendern` (nach M-20) auf.
  2. Datumswechsel in `fahrtAendern` erlauben.
- **Betroffene Dateien:** `src/app/dispo/fahrten/TripModal.tsx`, `src/app/dispo/fahrten/actions.ts`, `src/core/rides/aendern.ts`.
- **Erledigt damit:** S3-010.
- **Nachweis:** Playwright: Adresse ändern → eine Push „geändert“, kein Storno.

#### M-35 Fahrer-Rufnummer je Mandant eindeutig, nicht plattformweit
- **Problem:** Die technische E-Mail eines Fahrers wird aus seiner Rufnummer gebildet und ist über alle Fahrdienste eindeutig. Ein Teilzeitfahrer, der für zwei Betriebe fährt, lässt sich im zweiten nicht einladen – es gibt nur einen Serverfehler.
- **Zu tun:**
  1. Technische E-Mail um die Mandanten-ID ergänzen oder Fahrer-Login von der E-Mail lösen.
  2. Dublettenprüfung in `fahrerEinladen` mit verständlicher Meldung.
- **Betroffene Dateien:** `src/core/drivers/validation.ts`, `src/app/dispo/fahrer/actions.ts`, `prisma/schema.prisma`.
- **Erledigt damit:** S3-019. Siehe auch M-21.
- **Nachweis:** Test: dieselbe Rufnummer in zwei Mandanten → zwei Fahrer; zweimal im selben Mandanten → Meldung.

#### M-36 „Einmaligen“ Bereinigungs-Cron entfernen
- **Problem:** Eine als einmalig gedachte Aufräum-Route ist als jährlicher Cron eingetragen (1. Januar) und schreibt mandantenübergreifend in die Datenbank. Toter Code mit Zeitplan.
- **Zu tun:**
  1. Route und `vercel.json`-Eintrag löschen.
  2. Regel: einmalige Datenkorrekturen als Migration oder Skript, nie als Cron.
- **Betroffene Dateien:** `src/app/api/cron/brauchtSieBereinigenEinmalig/route.ts`, `vercel.json`.
- **Erledigt damit:** R1-6 „‚Einmaliger‘ Cleanup-Cron ist als Jahres-Cron verdrahtet“, S4-003.
- **Nachweis:** Route existiert nicht mehr, `vercel.json` ohne den Eintrag, Build grün.

#### M-37 Datenbankschema härten: Fremdschlüssel, Indizes, CHECK-Constraints
- **Problem:** Drei Verweise (`Ride.driverId`, `Ride.returnOfId`, `Notification.rideId`) sind freier Text ohne Fremdschlüssel; auf den heißen Abfragepfaden (Fahrzeug-Konfliktprüfung jede Minute, Fahrer-App, Telefonsuche) fehlen Indizes; es gibt keine Datenbankregeln wie „Schichtende nach Schichtbeginn“. Löschfristen löschen deshalb in drei Schritten ohne Transaktion.
- **Zu tun:**
  1. Fremdschlüssel ergänzen (mit passendem `onDelete`), Indizes auf `Ride.vehicleId`, `Ride.driverId`, `Ride.callId`, `RideStatusEvent.rideId`, `Suggestion.rideId`, `Shift.driverId/vehicleId`; GIN-Index auf `Passenger.phones`.
  2. CHECK `Shift.end > Shift.start`; Löschfristen in einer Transaktion.
- **Betroffene Dateien:** `prisma/schema.prisma`, `prisma/migrations/`, `src/core/datenschutz/loeschfristen.ts`.
- **Erledigt damit:** S3-022.
- **Nachweis:** `prisma migrate diff` leer, `psql`-Abfrage auf `pg_constraint`/`pg_indexes` zeigt die neuen Einträge; Tests grün.

#### M-38 Tests verlässlich machen: Playwright reparieren, Typecheck auf frischem Checkout, CI
- **Problem:** Beide Playwright-Klickwege sind rot (veraltete Erwartungen, fester Port, hinterlassene Testfirma in der Datenbank), und `npm run typecheck` schlägt auf einem frischen Checkout fehl. Ohne laufende Prüfungen in einer CI (automatische Prüfung bei jedem Code-Stand) bleiben die Tests Dekoration.
- **Zu tun:**
  1. Erwartungen aktualisieren, Aufräumen auch bei Fehlschlag, Port konfigurierbar.
  2. `next typegen` oder `next-env.d.ts` im Typecheck-Skript erzeugen.
  3. GitHub-Action: lint, typecheck, Vitest mit Datenbank, Playwright.
- **Betroffene Dateien:** `tests/e2e/startseite.spec.ts`, `tests/e2e/einrichtung.spec.ts`, `playwright.config.ts`, `package.json`, `.github/workflows/`.
- **Erledigt damit:** S3-021 (live bestätigt), S4-004.
- **Nachweis:** CI-Lauf grün auf frischem Checkout.

#### M-39 Anrufe zählbar machen für die Abrechnung an den Betreiber
- **Problem:** Die Website verspricht einen Preis „pro angenommenem Anruf“, aber es gibt keine Zähl- oder Prüflogik. Die `Call`-Zeile entsteht vor der Prüfung, ob die KI überhaupt zuständig war; abgebrochene Anrufe und Demo-Anrufe zählen mit. Rechnungsstreit ohne Beleg.
- **Zu tun:**
  1. Feld `abrechenbar` am `Call`, gesetzt nur wenn die KI den Anruf angenommen und mindestens ein Werkzeug ausgeführt hat; Demo-Mandant ausgenommen.
  2. Monatszähler je Mandant, unveränderlich festgeschrieben, in der Oberfläche einsehbar.
- **Betroffene Dateien:** `src/app/api/voice/webhook/route.ts`, `src/core/voice/anruf.ts`, `prisma/schema.prisma`, `src/app/dispo/auswertung/**`.
- **Erledigt damit:** S3-023.
- **Nachweis:** Test: Anruf außerhalb KI-Zeiten → nicht abrechenbar; Monatszähler stimmt mit Zählung der `Call`-Zeilen überein.

### P4 – später

#### M-40 Einmal-Codes und Magic-Link-Token gehasht speichern
- **Problem:** Login-Codes und Anmelde-Links stehen im Klartext in der Tabelle `verification`. Wer die Datenbank lesen kann (Backup, Konsole, Entwickler-Rechner), meldet sich als Büro an.
- **Zu tun:** Better-Auth-Option `storeOTP` auf gehashte Speicherung stellen; Magic-Link-Token ebenso hashen.
- **Betroffene Dateien:** `src/lib/auth.ts`.
- **Erledigt damit:** S4-011 (live bestätigt).
- **Nachweis:** `psql`-Abfrage auf `verification` zeigt keine sechsstelligen Codes im Klartext; Login funktioniert weiter.

#### M-41 Sicherheits-Header vervollständigen
- **Problem:** `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors` und `Permissions-Policy` fehlen. Letztere regelt, welche Seiten GPS und Mikrofon nutzen dürfen – für eine App mit GPS wichtig.
- **Zu tun:** Header in `next.config.ts` ergänzen, CSP zunächst im `report-only`-Modus testen.
- **Betroffene Dateien:** `next.config.ts`.
- **Erledigt damit:** S4-012 (live bestätigt).
- **Nachweis:** `curl -I` auf die Startseite zeigt alle drei Header; Fahrer-App und Karte laufen ohne CSP-Fehler in der Konsole.

#### M-42 Platzhalter bereinigen: Push-Kontaktadresse und private E-Mail im Seed
- **Problem:** Der Web-Push-Kontakt lautet `support@fahrdienst-ki.invalid` – Apple und Mozilla verlangen eine erreichbare Adresse, sonst kommt auf dem iPhone womöglich nie eine Push an. Im Seed-Skript steht die echte private E-Mail-Adresse des Auftraggebers im Git.
- **Zu tun:** Echte Support-Adresse als Umgebungsvariable; Seed-E-Mail durch `admin@muster-krankenfahrten.example` ersetzen und aus der Git-Historie bereinigen, falls gewünscht.
- **Betroffene Dateien:** `src/core/notify/push.ts`, `prisma/seed.ts`.
- **Erledigt damit:** S4-005, S4-006. Siehe auch V-007 (Verdacht, iOS-Push).
- **Nachweis:** `grep -r "\.invalid\|hotmail" src prisma` leer; Push-Test auf iPhone.

#### M-43 KI-Antworten ohne technische Codes und IDs
- **Problem:** Die KI bekommt Antworten wie „Fahrt erfasst, aber mit Hinweis: GENEHMIGUNG_FEHLT“ und rohe Fehlermeldungen („OpenRouteService 429“) und liest sie womöglich vor. `rideId`/`passengerId`/`placeId` stehen in jedem Werkzeug-Ergebnis.
- **Zu tun:** Werkzeug-Ergebnisse in `gesprochen` (Klartext für den Anrufer) und `daten` (IDs, nur für das Modell) trennen; Fehler in verständliche Sätze übersetzen.
- **Betroffene Dateien:** `src/core/voice/werkzeuge.ts`, `src/core/voice/voicePrompt.ts`.
- **Erledigt damit:** S4-008.
- **Nachweis:** Test: kein Werkzeug-Ergebnis enthält `_FEHLT`, `429` oder eine cuid im Feld `gesprochen`.

#### M-44 Kleinigkeiten in Stammdaten: Feiertage je Bundesland, Fahrzeug-Deaktivierung, `Approval.maxRides`
- **Problem:** Feiertage sind fest auf NRW gesetzt; Fahrzeuge werden deaktiviert, ohne laufende Schichten zu prüfen; die maximale Fahrtenzahl einer Genehmigung wird nie ausgewertet.
- **Zu tun:** Feld `bundesland` am Mandanten mit Feiertagstabelle; Deaktivieren eines Fahrzeugs prüft offene Schichten und Fahrten; `maxRides` in `fahrtPruefen` zählen.
- **Betroffene Dateien:** `src/core/shifts/feiertageNrw.ts`, `src/app/dispo/fahrzeuge/actions.ts`, `src/core/rides/pruefungen.ts`, `prisma/schema.prisma`.
- **Erledigt damit:** S4-010.
- **Nachweis:** Tests: Feiertag Bayern erkannt; Fahrzeug mit laufender Schicht nicht deaktivierbar; 11. Fahrt bei `maxRides 10` → Problem gemeldet.

#### M-45 Sicherheitsbericht `docs/11` nachprüfen und korrigieren
- **Problem:** Der Sicherheitsbericht enthält mehrere Aussagen, die die Prüfung widerlegt hat (kein Zugriff auf fremde Fahrten, Logs nur in Entwicklung, drei Webhook-Routen, Mandantentest deckt alles ab, Push-Texte ohne Adressen).
- **Zu tun:** Nach Abschluss von M-02, M-09, M-11 und M-14 jeden Punkt des Berichts mit Beleg (Test oder Befehl) neu schreiben.
- **Betroffene Dateien:** `docs/11-sicherheitsbericht.md`.
- **Erledigt damit:** S4-001 (teilweise live bestätigt).
- **Nachweis:** Jeder Punkt im Bericht nennt den Test oder Befehl, der ihn belegt.

## Vor dem Pilot extern klären

Diese Verdachte sind nicht bestätigt und lassen sich nur mit Zugang zu externen Konten oder Geräten prüfen. V-005 und V-006 wurden in Durchgang 2 bestätigt und stecken in M-14 bzw. M-21.

| Verdacht | Prüfauftrag | Benötigter Zugang |
|---|---|---|
| V-001 | Nach `next build` prüfen, ob die Server Action `fahrplanFuerMandantLaden` von außen aufrufbar ist (teilweise bestätigt: registriert, ID nicht im öffentlichen Bundle); unabhängig davon die Funktion nach `src/core/` verschieben (mit M-02). | Build-Ausgabe, kein externer Zugang |
| V-002 | Im Vercel-Konto prüfen, ob der Plan vier Minuten-Crons erlaubt und ob Cron-Läufe sich überlappen (Logs); M-16 baut die Sperre unabhängig davon ein. | Vercel |
| V-003 | Umgebungsvariablen von Preview- und Produktions-Deployments vergleichen: teilen sie `DATABASE_URL`, migriert jeder Preview-Build die Produktionsdatenbank. | Vercel |
| V-004 | Eine Aufnahme-URL aus `Call.audioUrl` ohne Anmeldung aufrufen und prüfen, ob die Vapi-API Aufnahmen wirklich löscht. | Vapi |
| V-007 | Push auf einem iPhone testen; schlägt sie wegen der `.invalid`-Kontaktadresse fehl, zieht M-42 vor. | iOS-Gerät |
| V-008 | Ein echter Testanruf gegen die Vapi-Konfiguration (Stimmen, Werkzeuge, Weiterleitung an `escalationNumber`), weil die gesamte Assistenten-Konfiguration bisher ungetestet ist. | Vapi, Telefonnummer |
| V-009 | Neon-Verbindungsmetrik unter Last beobachten und prüfen, ob `DATABASE_URL` auf den `-pooler`-Endpunkt zeigt (rechnerisch untermauert: bis zu 120 Verbindungen bei 8 Instanzen). | Neon, Vercel |
| V-010 | Vor Freischaltung der Demo-Nummer: Anruf auf die Demo-Nummer, dann `/live` anonym öffnen – es darf kein Transkript erscheinen (M-24). | Vapi, Telefonnummer |
| V-011 | In der Vapi-Dokumentation oder per Testanruf feststellen, ob Vapi Webhooks bei Timeout/5xx wiederholt; M-14 baut Idempotenz unabhängig davon ein. | Vapi |
| V-012 | Online `npm audit` und GitHub-Advisories für `next@16.4.3` prüfen; `better-auth` auf 1.7.14 heben. | Internetzugang |
| V-013 | Zwei Builds vergleichen (`server-reference-manifest.json`): bleiben die Action-IDs gleich, sind sie aus dem Git-Repo berechenbar und V-001 wäre ein offener Endpunkt. | Build-Ausgabe |

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

**Zählung:** docs/13: 29 Kennungen (R1-1…R1-7, R2-1…R2-11, R3-1…R3-11) → 29 zugeordnet. Berger 1: 40 Kennungen (S1-001…S1-005, S2-001…S2-011, S3-001…S3-014, S4-001…S4-010) → 40 zugeordnet. Berger 2: 22 Kennungen (S1-006, S2-012…S2-017, S3-015…S3-025, S4-011…S4-014) → 22 zugeordnet. Dazu 2 bestätigte Verdachte (V-005, V-006) in Maßnahmen, 11 offene Verdachte (V-001…V-004, V-007…V-013) im Abschnitt „Vor dem Pilot extern klären“. **Alle 91 Befunde und 13 Verdachte sind genau einmal zugeordnet.**
