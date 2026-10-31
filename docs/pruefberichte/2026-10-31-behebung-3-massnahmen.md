# Behebungsprotokoll Dispona – Durchgang 3 (Maßnahmenliste P1/P2) – 31.10.2026 – Bearbeitung: L. Hartmann

Bezug: `docs/pruefberichte/2026-10-30-massnahmenliste.md`, Maßnahmen M-01 bis M-23 (alle P1 und P2). P3/P4 nicht beauftragt. Grundlage sind außerdem die Befunde aus `docs/pruefberichte/2026-10-30-berger-durchgang-1.md`, `…-durchgang-2.md` und `docs/13-dispositionspruefung.md` (Kennungen R1-x … R3-x), soweit sie diesen Maßnahmen zugeordnet sind (Anhang der Maßnahmenliste). Der Lauf wurde einmal durch ein Nutzungslimit unterbrochen: M-01 bis M-07, M-09, M-10, M-12 und M-21 stammen aus dem ersten Teil, alles Übrige aus der Fortsetzung. Beide Teile sind hier zusammengefasst.

## Ergebnis in einem Satz
Alle 23 Maßnahmen sind bearbeitet: 16 vollständig behoben, 7 teilweise – jeweils mit einer offenen Entscheidung von dir (SMS-Anbieter, Rufnummern/Registrierung, Umfang der Löschung, Offline-Tagesplan, Demo-Umgehung, getrennte Demo-Datenbank, Webhook-Signatur und Routing-Grenzen); jede Behebung hat mindestens einen dauerhaften Test, der vorher rot war, und ein neuer Prüfdurchgang lohnt sich jetzt.

## Zahlen
Bearbeitet: 23 | BEHOBEN: 16 | TEILWEISE: 7 | NICHT REPRODUZIERT: 0 | WIDERSPRUCH: 0 | RÜCKFRAGE: 9 (innerhalb der TEILWEISE-Maßnahmen und zu Annahmen, siehe unten) | ZURÜCKGESTELLT: 0
Neue Regressionstests im gesamten Maßnahmen-Lauf: 149 Testfälle (249 → 398), davon 74 in der Fortsetzung (324 → 398); 140 Testnamen tragen eine Kennung (M-xx oder Sx-xxx).
Commits im Maßnahmen-Lauf: 28 (je Maßnahme mindestens einer, Betreff mit Kennung; dazu fünf Nachträge) + dieses Protokoll | Geänderte Dateien: 127 (+6 514 / −1 141 Zeilen) | Neue Migrationen: 8
Nullpunkt vor Beginn des Maßnahmen-Laufs (Ende Behebung 2): Tests 249/249 grün, Lint grün, Typecheck grün (nach `npx next typegen`).
Nullpunkt bei der Fortsetzung: Tests 324/324 grün – **aber** im ersten Lauf 6 rot in `tests/sicherheit/sitzung.test.ts` (reihenfolgeabhängig, siehe M-02-Nachtrag), zwei Wiederholungen grün; Lint 0 Fehler / 1 Warnung (ungenutzter Import aus M-07); Typecheck grün.
Nach Abschluss: Tests 398/398 grün (73 Dateien), dreimal in zufälliger Dateireihenfolge wiederholt (`--sequence.shuffle.files`, Seeds 11/22/33) jeweils 398/398; Lint 0 Fehler / 0 Warnungen; Typecheck grün; `prisma migrate status` aktuell, `prisma migrate diff` (Datenbank ↔ Schema) leer; frische Datenbank nur aus den Migrationen aufgebaut → Diff leer, 13 Mandanten-Trigger vorhanden.
Umgebung: lokale Postgres 16 (`/tmp/pgdata`, DB `dispona_test`), `.env` nur lokal (in `.gitignore`), `next build` grün, `next start` auf Port 3001 für Live-Proben, danach beendet. Externe Dienste (Vapi, SMS, Neon, Resend, OpenRouteService) nicht angesprochen – das Routing lief ohne Schlüssel über die Luftlinien-Schätzung. Alle `PRUEF_`/`Test-`-Daten entfernt; in der Test-DB liegt nur noch die Beispielfirma „Muster Krankenfahrten“ aus `npm run seed`. `git status` sauber, nichts gepusht.

## Für den Auftraggeber (ohne Fachjargon)
Repariert ist jetzt unter anderem: Die Datenbank selbst verhindert, dass eine Fahrt auf den Fahrgast eines anderen Fahrdienstes zeigt. Die KI am Telefon gibt nur noch Auskunft oder storniert, wenn sie weiß, mit wem sie spricht (echte Anrufernummer oder Name + Geburtsdatum). Die Nachtautomatik bleibt nicht mehr an einer einzelnen kaputten Fahrt hängen, läuft nie doppelt und meldet sich bei dir, wenn sie ausfällt. Nachtschichten über Mitternacht funktionieren. Eine laufende Fahrt lässt sich nicht mehr „wegstornieren“. Umplanen erzeugt keine widersprüchlichen Meldungen mehr. Serien wie Dialyse lassen sich beenden, pausieren und ändern – im Büro und am Telefon.
Ausprobieren: `npm test` (398 automatische Prüfungen); in der Disposition beim Fahrgast den neuen Abschnitt „Serienfahrten“ öffnen; im Fahrt-Fenster einer laufenden Fahrt steht jetzt „Fahrt abbrechen“ statt „Stornieren“; im Schichtplan eine Schicht 22:00–06:00 anlegen (Hinweis „Bis 06:00 am Folgetag.“).
Du musst entscheiden (Details im nächsten Abschnitt): SMS-Anbieter, wer Rufnummern zuweist und ob die Registrierung eine E-Mail-Bestätigung bekommt, wie weit die Fahrgast-Löschung geht, ob der Tagesplan offline auf dem Fahrerhandy bleiben darf, ob die Demo eine eigene Datenbank bekommt und ob die Demo ihre GPS-Hilfe behält. Außerdem bitte ich um eine kurze Bestätigung meiner fünf fachlichen Annahmen (unten, Punkt 9).

## Entscheidungen des Auftraggebers nötig

1. **SMS-Anbieter (M-03, Befund S1-002).** Fahrer-Anmelde-Link und alle Nachtalarme (auch der neue Cron-Ausfall-Alarm aus M-16) laufen über SMS. Ohne Anbieter scheitert der Versand in Produktion laut und nachvollziehbar (Fehler an der Benachrichtigung, 503 an der Anmeldung). **Empfehlung:** EU-Anbieter (z. B. seven.io, Sipgate) vor dem Pilot anbinden, ca. 0,5–1 Tag plus laufende Kosten. Ohne SMS kein Pilot.
2. **Rufnummern und Registrierung (M-23 Punkt 1/2, Befund S2-011).** Gesichert sind jetzt: E.164-Format, klare Meldung bei schon vergebener Nummer, atomare Registrierung und neu eine Ratenbegrenzung (5 je Anschluss, 100 plattformweit pro Stunde). Offen: Wer darf eine Rufnummer einem Fahrdienst zuordnen, und braucht die Registrierung eine E-Mail-Bestätigung? **Empfehlung:** Zuordnung nur durch dich als Betreiber und E-Mail-Bestätigung vor Freischaltung; beides ändert den Einrichtungsablauf sichtbar.
3. **Umfang der Fahrgast-Löschung (M-10, Befund S2-016).** Gelöscht werden Hinweise, Zusammenfassung, Anrufernummer, Transkript, Aufnahme, Serienvorlage, GPS-Punkte, Wohnort-Name; stehen bleiben Adressen, Zeiten, km, Beförderungsart (Abrechnung, Aufbewahrungspflicht). **Empfehlung:** mit dem Datenschutzbeauftragten festlegen, ob Adressen nach erfolgter Abrechnung plus Frist anonymisiert werden. Außerdem gehört die Zusammenfassungs-KI in die Unterauftragnehmer-Liste von `docs/08` (M-10 Punkt 4) – Änderung an `docs/` nur mit deiner Freigabe.
4. **Offline-Tagesplan auf dem Fahrerhandy (M-08 Punkt 1).** Die Maßnahme verlangt „nie Seiten mit Fahrgastdaten cachen“; `docs/08` beschreibt dagegen bewusst einen „Zwischenspeicher auf dem Handy nur für den Tag“ (Funkloch). Umgesetzt ist: Export und Dispo nie im Cache, Abmelden löscht alles, der Tagesplan verschwindet bei jedem Aufwachen der App nach Tageswechsel. **Empfehlung:** Offline-Tagesplan behalten (Betriebssicherheit im Funkloch), Nachweis-Formulierung der Maßnahme entsprechend anpassen. Alternative: kein Offline-Tagesplan – dann sieht der Fahrer im Funkloch nichts.
5. **Demo-Mandant und Build-Ablauf (M-01 Punkt 3, Befund S3-013).** Demo und Produktion teilen sich die Datenbank, und `npm run build` führt `prisma migrate deploy` aus. Infrastrukturänderung mit Kosten → nicht umgesetzt. **Empfehlung:** eigene Datenbank für die Demo und Migrationen als bewusster Schritt vor dem Deploy.
6. **GPS-Hilfe der Demo (M-17 Punkt 2).** Die Demo erzeugt alle 5 Minuten künstliche GPS-Zeilen. Nach M-17 ist das für Vorausplanung nicht mehr nötig, die Demo erzeugt aber fast nur Fahrten 10–80 Minuten im Voraus (Sofort-Disposition, dort gilt GPS weiterhin). Entfernen würde die öffentliche Live-Demo sichtbar verschlechtern (Fahrten bleiben „Vorgeschlagen“). **Empfehlung:** behalten; sie bildet ein Fahrzeug mit geöffneter App nach. Gleichzeitig bitte `docs/05` Bedingung 3 präzisieren („GPS-Frische nur bei Abholung in < 60 Minuten“) – Freigabe für die Doku-Änderung nötig.
7. **Webhook-Signatur und Routing-Grenzen (M-14 Punkte 3/4).** Der Geheimnisvergleich ist jetzt zeitkonstant; ein Schutz gegen Wiederholung (HMAC mit Zeitstempel) hängt davon ab, ob Vapi das anbietet (Verdacht V-011, extern zu klären). Nicht umgesetzt: Begrenzung der Routing-Aufrufe je Kandidat und eine Meldung, wenn OpenRouteService bei Überlast (429) still auf Luftlinie zurückfällt – das braucht eine Durchreichung durch die Vorschlagsrechnung (ca. 1 Tag). **Empfehlung:** vor dem Pilot, sobald ein ORS-Konto mit Kontingent feststeht.
8. **Spezifikation widersprüchlich (M-15).** `docs/02` nennt die Fahrer-SMS nach 2 Minuten, `docs/05` nach 5 Minuten bei Fahrten in < 60 Minuten. Umgesetzt nach `docs/05` und Maßnahme (5 Minuten, nur zeitnahe Fahrten). **Empfehlung:** `docs/02` angleichen (Freigabe nötig).
9. **Meine fachlichen Annahmen, wo die Spezifikation schweigt (bitte bestätigen oder korrigieren):**
   a) M-07: „Rückfahrt ja, Zeit offen“ legt die Rückfahrt mit Platzhalter (Hinfahrt + 4 h) an, Problem `RUECKFAHRT_ZEIT_OFFEN`, landet in „Braucht Sie“.
   b) M-15: Fahrer-SMS und – nachts – Inhaber-Alarm gehen im selben Lauf nach 5 Minuten ohne Bestätigung raus (Inhaber vorher ebenfalls nach 5 Minuten).
   c) M-19: „Fahrt abbrechen“ setzt eine laufende Fahrt auf `PROBLEM` mit Vermerk `FAHRT_ABGEBROCHEN` statt eines neuen Status; der Fahrer bekommt eine eigene Meldung.
   d) M-20: Ein neuer Hinweis allein (z. B. „Rollator“) lässt die Fahrt beim Fahrer (Meldung „geändert“); Zeit, Orte, Transportart oder Begleitung lösen die Zuweisung und planen neu. Bei „Ich falle aus“ behalten bereits laufende Fahrten ihr Fahrzeug.
   e) M-22: Änderungen an einer Serie gelten ab heute für alle noch nicht begonnenen Fahrten; Probleme-Fahrten der Serie bleiben beim Büro.

## Maßnahmen (Reihenfolge wie in der Maßnahmenliste)

### [M-01] Seed und Demo-Reset nur lokal und mandantenbezogen – Status: TEILWEISE (RÜCKFRAGE Punkt 3)
Befunde: S1-006 → behoben; S3-013 → offen (Entscheidung 5).
Reproduktion: `tests/seed/seedSchutz.test.ts` („S1-006: Seed-Löschung trifft nur den Demo-Mandanten …“, „… bricht bei einer entfernten Datenbank ab“), `tests/demo/aufraeumen.test.ts` (M-01: kein Standard-Mandant) – vorher rot, jetzt grün (6/6).
Geändert: Punkte 1/2 mit S1-006 (`prisma/seed.ts`, `src/lib/seedSchutz.ts`); Punkt 4: `src/core/demo/aufraeumen.ts`, `src/app/api/cron/demoZuruecksetzen/route.ts` – `demoZuruecksetzen(tenantId)` ohne Standardwert.
Offen: Punkt 3 (eigene Demo-Datenbank, `migrate deploy` aus dem Build) – Infrastruktur/Kosten.
Commits: `2d90fc0` (S1-006), `3efd351` M-01

### [M-02] Zentrale Rollen- und Sitzungsprüfung – Status: BEHOBEN (+ Nachtrag)
Befunde: S1-001, S2-001, S3-003, S3-018, R3-6 → behoben; V-001 (fahrplanFuerMandantLaden als offene Action) mitbehoben.
Reproduktion: `tests/export/abrechnungRoute.test.ts` (FAHRER → 403, ohne Sitzung → 401), `tests/sicherheit/sitzung.test.ts` (13 h alte Büro-Sitzung → 401), `tests/sicherheit/serverActions.test.ts` (jede exportierte Funktion jeder `"use server"`-Datei braucht eine Rollenprüfung) – 30/30 grün.
Geändert: `src/lib/session.ts` (`requireBueroSession`, `requireAdminSession`, `requireFahrerSession`, Sitzungsalter), alle Dispo-/Einrichtungs-/Fahrer-Actions, `src/proxy.ts`, `src/app/dispo/fahrten/fahrplan.ts` (aus der Action-Datei verschoben).
Nachtrag (Fortsetzung): Mein eigener M-02-Test war reihenfolgeabhängig (vitest `isolate:false`: `session.ts` blieb an den `@/lib/auth`-Mock der ersten Testdatei gebunden). Reproduziert mit `--sequence.shuffle.files` (Seeds 1–4: 5–10 rot), behoben durch den gemeinsamen Sitzungsspeicher `tests/hilfen/sitzungsMock.ts`; sechs gemischte Läufe grün. Kein Test gelockert.
Ausbreitung: neue Actions dieses Laufs (`fahrtAbbrechen`, `serienLaden`, `serieBeendenAktion`, `seriePausierenAktion`, `serieAendernAktion`) laufen über `requireBueroSession` und werden vom Quelltext-Test erfasst.
Commits: `215d386`, `3a07638` (S1-001), `763e8d0` M-02, `9cf65ff` M-02 (Nachtrag)

### [M-03] Echter SMS-Versand, Fahrer-Link, Büro-Mail – Status: TEILWEISE (RÜCKFRAGE SMS-Anbieter)
Befunde: S1-002 → teilweise (Versandweg gebaut, Anbieter fehlt); S4-013, S4-002 → behoben.
Reproduktion: `tests/lib/umgebung.test.ts` (Start in Produktion ohne Pflichtschlüssel scheitert), `tests/providers/sms.test.ts`, `tests/notify/anmeldeLink.test.ts`, `tests/notify/eskalation.test.ts` („S1-002: scheitert der SMS-Versand …“) – grün.
Geändert: `src/lib/umgebung.ts` + `src/instrumentation.ts` (Pflichtvariablen), `src/lib/anmeldeCode.ts` (503 statt „Code gesendet“), `src/lib/anmeldeLink.ts`, `.env.example`.
Offen: Punkte 1, 2 (echter Anbieter) und 5 (Gerätetest) – Entscheidung 1.
Commits: `041fc8c`, `4bfa70a` (S1-002), `d479595` M-03

### [M-04] Zuweisung und Statuswechsel in einer Transaktion – Status: BEHOBEN
Befunde: S1-004, S2-015, R1-1, R2-1, R2-2, R3-2 → behoben.
Reproduktion: `tests/disposition/zuweisenParallel.test.ts`, `tests/disposition/zuweisenAtomar.test.ts`, `tests/rides/status.test.ts` – 16/16 grün (parallele Zuweisung: genau eine geht durch; paralleler Statuswechsel: genau ein Ereignis; alter Fahrer nach Umbesetzung: abgelehnt).
Geändert: `src/core/disposition/zuweisen.ts` (Transaktion + `pg_advisory_xact_lock`, Statusprüfung vor dem Schreiben), `src/core/rides/status.ts` (bedingtes Update, `tx`, `erwarteterDriverId`), `src/app/fahrer/actions.ts`, `src/lib/db.ts` (Eigentumsprüfung im where, transaktionsfest).
Nicht umgesetzt (optional laut Maßnahme): Postgres-`EXCLUDE`-Constraint gegen überlappende Zeitfenster – Vorschlag 4.
Commits: `75a643a`, `f329c86`, `11448a3` M-04

### [M-05] Fahrer-Actions absichern – Status: BEHOBEN
Befunde: R3-1, S4-014 → behoben.
Reproduktion: `tests/fahrer/actions.test.ts` (`STORNIERT` vom Handy → abgelehnt; GPS 999/NaN → abgelehnt; Schicht von letzter Woche sendet nicht) – 7/7 grün.
Geändert: `src/app/fahrer/actions.ts`, `src/core/drivers/validation.ts`, `src/core/rides/status.ts` (`fahrerStatusSchema`).
Commit: `a91e7ee` M-05

### [M-06] Adress- und Fahrgastsuche über die Datenbank – Status: BEHOBEN
Befunde: S1-003, S2-006, S2-007 → behoben.
Reproduktion: `tests/places/suche.test.ts`, `tests/voice/ortSuchen.test.ts` („Hauptstraße 1“ → nicht sicher; „Aachen“ → kein sicherer Treffer; Geocoding mit Einsatzgebiet), `tests/passengers/sucheDb.test.ts` (500 Fahrgäste, Zeile 412 gefunden) – 12/12 grün.
Commit: `6d32a7f` M-06

### [M-07] Rückfahrt richtig anlegen – Status: BEHOBEN (Annahme 9a) (+ Nachtrag)
Befunde: S1-005, R1-2, R1-3 → behoben.
Reproduktion: `tests/rides/erfassen.test.ts` (7/7: Rückfahrt ohne Zeit → zwei Fahrten, Problem „Zeit offen“; 23:30/00:15 → Folgetag; echte zweite Fahrt zur gleichen Uhrzeit → DOPPELBUCHUNG).
Nachtrag: ungenutzter Import (Lint-Warnung) entfernt.
Commits: `83fe14f` M-07, `7d3c0c9` M-07 (Nachtrag)

### [M-08] Service Worker nur App-Hülle, löscht beim Abmelden – Status: TEILWEISE (RÜCKFRAGE Offline-Tagesplan, Entscheidung 4)
Befunde: S2-012 → behoben; R3-10 → behoben im Rahmen dessen, was eine Web-App kann (siehe unten).
Reproduktion: `tests/fahrer/serviceWorker.test.ts` (lädt `public/sw.js` in einer vm-Nachbildung: Export und Dispo nicht abgefangen; neu M-08: Push, Tipp auf die Benachrichtigung, `periodicsync` und Nachricht der Seite löschen den Vortag), `tests/fahrer/geraeteDaten.test.ts` (Abmelden löscht Caches und Warteschlange; neu M-08: `alteTagesCachesLoeschen` löscht nur andere Tage) – vorher 5 rot, jetzt 11/11 grün.
Ursache (bestätigt): Löschung des Vortags nur bei `install/activate/fetch`, also nur beim nächsten Seitenaufruf.
Geändert (Fortsetzung): `public/sw.js` – Aufräumen bei jedem Aufwachen (Push, Benachrichtigungs-Tipp, `periodicsync`, `message`), ein Fehler beim Aufräumen verhindert nie die Push-Anzeige; `src/app/fahrer/geraeteDaten.ts` – `alteTagesCachesLoeschen()`; `src/app/fahrer/ServiceWorkerRegistrar.tsx` – Aufräumen beim Start, alle 15 Minuten, beim Zurückholen in den Vordergrund, `periodicSync`-Anmeldung wo vorhanden.
Grenze: Wird das Handy nach dem Tageswechsel weder geöffnet noch per Push geweckt, bleibt der Tagesplan bis dahin liegen – ein Service Worker kann keinen eigenen Wecker stellen. Abmelden und Deaktivieren (M-12) löschen bzw. sperren weiterhin sofort.
Nicht prüfbar: echtes Gerät, Playwright (keine Browser installiert).
Commits: `6c2d0b1` (S2-012), `f08f318` M-08

### [M-09] Keine Telefonnummern/Adressen im Server-Log – Status: BEHOBEN
Befund: S2-009 → behoben.
Reproduktion: `tests/notify/push.test.ts`, `tests/providers/sms.test.ts`, `tests/sicherheit/logging.test.ts` (Lint-Regel `no-console` für `src/`, einziger Entwicklungs-Logger) – grün.
Ausbreitung (Fortsetzung): alle neuen Logzeilen dieses Laufs (`console.error` in Cron-Lauf, Automodus, Plan für morgen, Erfassen, Webhook-Hintergrundaufgabe) enthalten nur IDs und die Fehlerart (`TypeError`, Prisma-Code), nie den Fehlertext – Test „Laufprotokoll“ prüft, dass ein Name aus einer Fehlermeldung nicht im Log landet.
Commits: `4d94c97` (S2-009), `e3692a9` M-09; Sicherheitsbericht Punkt 5 vom Auftraggeber korrigiert (`c712981`)

### [M-10] Löschkonzept – Status: TEILWEISE (RÜCKFRAGE Umfang/Doku, Entscheidung 3)
Befunde: S2-016 → teilweise (Umfang offen); S3-012, S3-024 → behoben.
Reproduktion: `tests/passengers/loeschung.test.ts`, `tests/datenschutz/loeschfristen.test.ts`, `tests/notify/anrufZusammenfassung.test.ts` (Zusammenfassung verschlüsselt, ohne KI-Schlüssel nur Hinweis statt Transkript) – 13/13 grün.
Offen: Punkt 4 (`docs/08` Unterauftragnehmer) und die Anonymisierung von Adressen nach Abrechnung.
Commits: `b884f60` (S2-016), `e33d2fc` M-10

### [M-11] Mandantenprüfung für Fremdschlüssel – Status: BEHOBEN (+ HÄRTUNG)
Befund: S2-008 → behoben, jetzt an der Wurzel.
Reproduktion: `tests/db-tenant.test.ts`, neuer Block „Fremdschlüssel über die Mandantengrenze (M-11)“ (5 Fälle: `withTenant(A).ride.create` mit Fahrgast/Ort von B; `update`/`updateMany` auf Fahrzeug/Fahrer von B; Schicht, Genehmigung, Push-Abo, Wohnort; roher Client; eigene Zeilen in derselben Transaktion + `include`) – vorher 5 rot (u. a. sah A über `include` Fahrgäste von B), jetzt grün; `tests/rides/fremdeReferenzen.test.ts` weiterhin grün.
Ursache (bestätigt): Die Prüfung aus Behebung 2 griff nur, wo ein Aufrufer `referenzenPruefen()` aufrief; `withTenant()` selbst ließ fremde IDs durch. Eine Prüfung im Prisma-Hook über einen zweiten Client sieht Zeilen derselben Transaktion nicht (Problem aus M-04).
Geändert: `prisma/migrations/20261031130000_mandant_fremdschluessel/migration.sql` – Trigger-Funktion `dispona_mandant_referenzen_pruefen` und Trigger auf 13 Tabellen (Ride, Shift, VehicleLocation, PushSubscription, Driver, Passenger.homePlaceId, Approval, RideStatusEvent, RideSeries, Suggestion, VoiceToolCall, Notification, AuditLog): Schreiben scheitert, wenn die referenzierte Zeile einem anderen Mandanten gehört (SQLSTATE 23503). `src/lib/db.ts` – `withTenant()` übersetzt das in `FremdeReferenzError` („Fahrgast nicht gefunden.“).
Bestandsdaten: nichts umgeschrieben; UPDATE prüft nur bei Änderung der betroffenen Spalten; die Migration meldet per NOTICE nur die Anzahl etwaiger alter Fremdreferenzen.
Beweis: frische Datenbank aus den Migrationen → `migrate diff` leer, 13 Trigger; `npm run seed` läuft.
Achtung für den lokalen Workaround aus `CLAUDE.md`: Wer `prisma db push` nutzt und die Migration nur „als angewendet markiert“, hat die Trigger nicht – dann `migration.sql` von Hand ausführen.
Commits: `d7cbad0` (S2-008), `e767f45` M-11

### [M-12] Fahrer deaktivieren und Offboarding – Status: BEHOBEN
Befund: R3-4 → behoben.
Reproduktion: `tests/drivers/deaktivieren.test.ts` (Sitzungen und Push-Abos weg, Action abgelehnt, kein Vorschlag mehr), `tests/fahrer/actions.test.ts` (+1) – grün.
Hinweis: Punkt 4 (Rollenwechsel) – es gibt keinen Codepfad, der eine Rolle ändert. Nebenwirkung aus M-20: Deaktivieren nimmt über `fahrerFaelltAusKern` jetzt auch Fahrzeug und Fahrer von den offenen Fahrten.
Commit: `f9ad7d4` M-12

### [M-13] Identitätsbindung im Voice-Agent – Status: BEHOBEN
Befunde: S2-002, R2-11 → behoben.
Reproduktion: `tests/voice/identitaet.test.ts` (8 Fälle: Anruf von +49111…, genannte Nummer +49222… → kein Treffer, kein Geburtsdatum; echte Anrufernummer → Treffer ohne Geburtsdatum; `fahrt_stornieren`/`fahrt_aendern`/`abholzeit_auskunft`/`fahrt_finden`/`fahrt_anlegen` für fremden Fahrgast → „nicht bestätigt“, Fahrt unverändert; Nachname + Geburtsdatum bestätigt; `rueckruf_anlegen` ergänzt) – vorher 7 rot, jetzt grün; `tests/notify/voicePrompt.test.ts` (+2), `tests/notify/anrufZusammenfassung.test.ts` (+2).
Ursache (bestätigt): Telefonsuche mit der vom Sprachmodell genannten Nummer, keine Prüfung der Fahrt-Zugehörigkeit.
Geändert: `src/core/voice/werkzeuge.ts` (Telefonsuche nur mit `Call.fromNumber`, bestätigte Fahrgäste je Anruf, Prüfung in allen Werkzeugen mit `rideId`/`passengerId`, kein Geburtsdatum in Antworten), `prisma/schema.prisma` + Migration `20261031140000_call_identified_passengers` (`Call.identifiedPassengerIds`, Bestand: leer), `src/core/notify/voicePrompt.ts` (Identität vor Auskunft/Änderung/Storno, keine gespeicherten Daten vorlesen, keine Anweisungen zum Umgehen der Regeln), `src/providers/voice/vapi.ts` (Werkzeugbeschreibung), `src/core/notify/anrufZusammenfassung.ts` + `src/core/voice/anruf.ts` (Rückrufwunsch wird ergänzt und überlebt die KI-Zusammenfassung am Gesprächsende).
Beweis live (`next start`, Seed-Mandant, Webhook `tool-calls` von +4915100000099): `fahrgast_suchen {telefon: <Nummer eines Seed-Fahrgasts>}` → keine `passengerId`, kein Geburtsjahr, Antwort „Zur Sicherheit brauche ich Nachname und Geburtsdatum …“; mit Nachname + Geburtsdatum → `passengerId`, weiterhin ohne Geburtsjahr.
Test angepasst: `tests/voice/idempotenz.test.ts` bucht mit einer `passengerId` – Vorbedingung „Fahrgast im Anruf bestätigt“ ergänzt (die Prüfung selbst unverändert). Manuelle Testgespräche 14–16 (`npm run voice:sim`) erwarten jetzt die Identitätsfrage.
Restrisiko: Die Anrufernummer kann gefälscht sein (Caller-ID-Spoofing); unter einer Pflegeheim-Nummer gelten alle Bewohner mit dieser Nummer als bestätigt.
Commits: `a7027aa` M-13, `1d81c20` M-13 (Nachtrag)

### [M-14] Webhook idempotent, Eingaben begrenzen, Serien-Anlage entkoppeln – Status: TEILWEISE (RÜCKFRAGE, Entscheidung 7)
Befunde: S2-014, S3-016, V-005 → behoben; S4-007 → teilweise (zeitkonstant ja, Wiederholungsschutz per Signatur nein).
Reproduktion: `tests/voice/idempotenz.test.ts`, `tests/voice/webhookRoute.test.ts` (aus S2-014); neu `tests/sicherheit/geheimnis.test.ts` (3: Vergleich, Bearer, Quelltext ohne `===`/`!==` gegen Geheimnisse) und `tests/voice/serieWebhook.test.ts` („0 Routing-Aufrufe im Webhook, Termine erst in der Hintergrundaufgabe“) – vorher rot (Modul fehlte; 6 Routing-Aufrufe schon bei einem Fahrzeug), jetzt grün.
Geändert: `src/lib/geheimnis.ts` (`geheimnisGleich` mit SHA-256 + `timingSafeEqual`, `bearerErlaubt`), alle 8 Cron-Routen und `src/providers/voice/vapi.ts`; `src/core/rides/serie.ts` (`termineSofort: false`, `serieTermineErzeugen`), `src/core/voice/werkzeuge.ts` (Hintergrund-Ausführer), `src/app/api/voice/webhook/route.ts` (`after()` aus `next/server`, Fehler nur mit IDs; der tägliche Cron holt fehlende Termine nach).
Beweis live: Webhook mit falschem Geheimnis → 401, kaputtes JSON → 400; Cron ohne/mit falschem Geheimnis → 401.
Offen: HMAC/Zeitstempel (Anbieter), Routing-Grenze je Kandidat, 429-Rückfall als Problem.
Commits: `ae0a5f7` (S2-014), `ccd9bf2` M-14

### [M-15] Eskalation je Zuweisung, nur für zeitnahe Fahrten – Status: BEHOBEN (Annahme 9b)
Befunde: S2-017, R2-8, S3-006 → behoben.
Reproduktion: neuer Block in `tests/notify/eskalation.test.ts` (4: Zuweisung für morgen → keine SMS; Fahrt in 30 Min, seit 3 Min disponiert → noch keine; früh zugewiesene Fahrt → Frist ab Eintritt ins 60-Minuten-Fenster; Kein-Fahrzeug-Alarm erneut nach zwischenzeitlicher Disponierung) – vorher 4 rot, jetzt grün.
Geändert: `src/core/notify/eskalation.ts` – nur DISPONIERT mit Abholung in < 60 Min; Frist `driverAckMinutes` ab Zuweisung bzw. Fenstereintritt; Kein-Fahrzeug-Alarm je Episode.
Tests angepasst (begründet): drei bestehende Tests hatten die überholte Regel fest eingebaut (SMS 2 Minuten nach jeder Zuweisung, Abholung in 3 Stunden) – genau das, was S3-006 bemängelt. Umgestellt auf Abholung in 30 Minuten und Frist 5 Minuten; die geprüfte Eigenschaft (eine SMS, keine zweite, neuer Fahrer bekommt sie) ist unverändert.
Commits: `35581a7` (S2-017), `933160d` M-15

### [M-16] Cron-Läufe: Sperre, Fehlerisolierung, Protokoll, Alarm – Status: BEHOBEN
Befunde: S2-010, R2-3, S3-011 → behoben; V-002 (Überlappung) durch die Sperre unabhängig vom Vercel-Plan abgedeckt.
Reproduktion: `tests/disposition/cronLauf.test.ts` (9: Eintrag 3 von 5 wirft → 4 und 5 bearbeitet; zwei parallele Läufe → genau einer arbeitet; Laufprotokoll mit Fehlerart und gelöster Sperre; „Plan für morgen“ atomar vor dem Lauf beansprucht; `planFuerMorgenBerechnen` mit Routing-Fehler bei Fahrt 3 → 4 und 5 geplant, Fahrt 3 mit Vermerk; Alarm nach > 15 Min ohne Erfolg genau einmal; kein Alarm bei frischem Lauf oder Automodus aus; Alarm bei fehlgeschlagenem „Plan für morgen“; ein Mandant wirft → andere laufen) – vorher rot (Gegenprobe mit altem `planFuerMorgen.ts`: „PRUEF Routing kaputt“ bricht ab), jetzt grün.
Geändert: Tabelle `CronLauf` (Migration `20261031150000_cron_lauf`), `src/core/betrieb/cronLauf.ts` (`cronLaufMitSperre` mit Ablauf-Sperre statt Advisory-Lock – hält auch hinter dem Neon-Pooler; `jeEintragIsoliert`; `fuerAlleMandanten`; `planFuerMorgenBeanspruchen`; `cronUeberwachen`), `automatischDisponieren.ts`/`planFuerMorgen.ts` (Fehler einer Fahrt → `autoSkipReason` „Technischer Fehler …“), Routen `automodus`, `eskalation`, `planFuerMorgen`, `serienVerlaengern`, `loeschfristen`, `src/core/notify/texte.ts` (Alarmtext ohne Fahrtdaten), `src/lib/db.ts`/`src/lib/seedSchutz.ts` (neue Tabelle).
Beweis live: `GET /api/cron/automodus` und `/api/cron/eskalation` mit Geheimnis → je Mandant `{"status":"ok", "lauf":{"status":"gelaufen",…}, "ueberwachung":{…}}`.
Test angepasst: `tests/disposition/planFuerMorgen.test.ts` vergleicht das Ergebnisobjekt exakt – um das neue Feld `fehler: 0` ergänzt.
Grenze: Fällt der Zeitplaner ganz aus, läuft auch die gegenseitige Überwachung nicht – dafür braucht es eine Überwachung von außen (Vorschlag 3).
Commit: `4fe1b1c` M-16

### [M-17] Automodus-Bedingungen für Vorausplanung – Status: TEILWEISE (RÜCKFRAGE Doku/Demo, Entscheidung 6)
Befund: S2-003 → behoben.
Reproduktion: `tests/disposition/automodus.test.ts` (+3) und `tests/disposition/automodusVorausplanung.test.ts` (Postgres: drei Fahrten für morgen auf ein Fahrzeug ohne GPS → alle drei DISPONIERT; Fahrt in 30 Minuten ohne GPS nach einer früheren Fahrt → weiterhin `autoSkipReason` „Kein aktueller Standort“) – vorher 3 rot, jetzt grün.
Geändert: `src/core/disposition/automodus.ts` – `pruefeGpsOderBetriebshof` mit Vorlaufzeit; ab 60 Minuten Vorausplanung, GPS nicht nötig; ohne Angabe gilt die strenge Regel.
Offen: Punkt 2 (`docs/05` präzisieren, Demo-Umgehung entfernen).
Commit: `3fb0019` M-17

### [M-18] Nachtschichten über Mitternacht – Status: BEHOBEN
Befund: S2-004 → behoben.
Reproduktion: `tests/shifts/nachtschicht.test.ts` (6: Folgetag; 24./25.10. ergibt 9 Stunden; Tagschicht unverändert; Schema lehnt gleiche/ungültige Zeiten ab; `findeAktiveSchicht` um 23:30/05:59 ja, 06:30/21:30 nein; Reproduktion aus Durchgang 1 über die echte Server Action gegen Postgres: Muster 22:00–06:00 → Schicht um 02:00 gefunden) – vorher 5 rot, jetzt grün.
Geändert: `src/core/shifts/dauer.ts` (`schichtZeitraum`, über `week.ts`), `src/core/drivers/validation.ts` (HH:MM, Start ≠ Ende), `src/app/dispo/fahrer/actions.ts`, `src/app/dispo/fahrer/FahrerClient.tsx` + `texte.ts` (Hinweis „Bis 06:00 am Folgetag.“, „(Folgetag)“ im Wochenplan).
Commit: `ff89905` M-18

### [M-19] Stornieren nur vor der Abholung – Status: BEHOBEN (Annahme 9c)
Befund: R3-3 → behoben.
Reproduktion: `tests/rides/stornieren.test.ts` (6: Übergänge entfernt; `fahrtStornieren` bei AN_BORD/UNTERWEGS → „läuft bereits“, keine Storno-Push; „Fahrt abbrechen“ → PROBLEM + `FAHRT_ABGEBROCHEN` + Notification `ABBRUCH`; Abbrechen vor der Abholung → abgelehnt; KI-Werkzeug bei UNTERWEGS → Hinweis „Mitarbeiter“; KI storniert DISPONIERT weiterhin) – vorher 5 rot, jetzt grün.
Geändert: `src/core/rides/status.ts` (Übergangstabelle – wirkt damit auf alle Wege, auch `fahrtStatusSetzen`), `src/core/rides/stornieren.ts` (`FahrtLaeuftBereitsError`, `fahrtAbbrechen` in einer Transaktion), `src/core/rides/stornierbar.ts` (Regel ohne Server-Abhängigkeiten für die Oberfläche), `src/core/voice/werkzeuge.ts`, `src/app/dispo/fahrten/actions.ts` (`fahrtAbbrechen`), `TripModal.tsx` + neue `src/app/dispo/fahrten/texte.ts`, `src/core/notify/texte.ts` (`abgebrocheneFahrtText`).
Ausbreitung: DSGVO-Löschung stornierte schon nur nicht begonnene Fahrten; Demo-Aufräumen nur VORGESCHLAGEN/ERFASST; `serieBeenden` (M-22) ebenfalls nur nicht begonnene.
Commit: `449c51b` M-19

### [M-20] Umplanen und Umbesetzen aufräumen – Status: BEHOBEN (Annahme 9d) (+ Nachtrag)
Befunde: R2-4, R2-5, R2-6, R2-9, S3-004 → behoben.
Reproduktion: `tests/rides/umplanen.test.ts` (7, Postgres, Server Action `fahrtVerschieben` mit gemockter Sitzung: Zeitverschiebung eines Vorschlags → bleibt VORGESCHLAGEN, kein Fahrzeug, keine Push; Fahrerausfall → `vehicleId`/`driverId` null; nach Neubesetzung `problems` leer; PROBLEM-Fahrt nach `fahrtAendern` → VORGESCHLAGEN, Probleme neu; Adressänderung einer disponierten Fahrt → genau „entzogen“; kombinierte Zeit+Fahrzeug-Verschiebung → je Fahrer genau eine Push; nur Hinweis → bleibt disponiert, „geändert“) – vorher 6 rot, jetzt grün; `tests/disposition/planFuerMorgenProbleme.test.ts` (Nachtrag).
Geändert: `src/app/dispo/fahrten/actions.ts` (`fahrtVerschieben`), `src/core/rides/aendern.ts` (`problemeNeuBerechnen`, Zuweisung lösen, PROBLEM zurück in die Vorschlagsrechnung), `src/core/rides/fahrerAusfall.ts`, `src/core/disposition/zuweisen.ts` (`DISPOSITIONS_PROBLEME`, abschaltbare Meldung), `src/core/disposition/vorschlagSpeichern.ts` (KEIN_FAHRZEUG einmal, bei Vorschlag entfernt), neu `src/core/rides/fahrerBenachrichtigen.ts` (eine Meldung je Fahrer aus Stand vorher/nachher).
Nachtrag (Selbstprüfung): `planFuerMorgen.ts` und `betriebSimulieren.ts` hängten KEIN_FAHRZEUG weiterhin an – jetzt nur einmal.
Commits: `5f47498` M-20, `cb7a3e0` M-20 (Nachtrag)

### [M-21] Zentrale Telefonnormalisierung – Status: BEHOBEN
Befunde: S2-013, V-006 → behoben.
Reproduktion: `tests/passengers/telefonSchluessel.test.ts`, `tests/passengers/suche.test.ts`, `tests/drivers/telefon.test.ts` – 14/14 grün.
Abweichung: `libphonenumber-js` bewusst nicht eingeführt (die Maßnahme nennt es als Beispiel); die eigenen Regeln decken alle Formate aus Durchgang 2 ab (Vorschlag 9 aus Behebung 2 bleibt bestehen).
Commits: `a6fca13` (S2-013), `503cb62` M-21

### [M-22] Serien beenden, pausieren, ändern – Status: BEHOBEN (Annahme 9e) (+ Nachtrag)
Befunde: S2-005, R2-10 → behoben.
Reproduktion: `tests/rides/serieVerwalten.test.ts` (5: Beenden → künftige Fahrten STORNIERT, `serienVerlaengern` erzeugt keine neuen; laufende Fahrt bleibt; Pause storniert Fahrten im Zeitraum und erzeugt dort keine neuen; Ändern – neue Abholzeit gilt, entfernte Wochentage storniert, neue erzeugt; KI-Werkzeug `serie_beenden` nur für bestätigten Fahrgast) – vorher 5 rot, jetzt grün.
Geändert: `prisma/schema.prisma` + Migration `20261031160000_ride_series_pause` (`pausedFrom`/`pausedUntil`), `src/core/rides/serie.ts` (`serieBeenden`, `seriePausieren`, `serieAendern`, Pause in `termineErzeugen`), `src/app/dispo/fahrgaeste/SerienVerwaltung.tsx` (neu) + `actions.ts` + `texte.ts` (neu) + `FahrgaesteClient.tsx`, `src/core/voice/werkzeuge.ts` (`serie_beenden`), `src/providers/voice/vapi.ts`, `src/core/notify/voicePrompt.ts`.
Test angepasst: `tests/providers/voice/vapi.test.ts` – erwartete Werkzeuganzahl 11/10 statt 10/9 (neues Werkzeug).
Commits: `8886167` M-22, `64bb4a8` M-22 (Nachtrag: Pause-Kennzeichen neutral statt orange)

### [M-23] Registrierung, Rufnummern, Mehrzeilen-Schreibvorgänge – Status: TEILWEISE (RÜCKFRAGE Punkt 1 und E-Mail-Bestätigung, Entscheidung 2)
Befunde: S3-020, S4-009 → behoben; S2-011 → teilweise.
Reproduktion: `tests/auth/registrieren.test.ts` (S2-011 aus Behebung 2; neu M-23: sechste Registrierung vom selben Anschluss abgelehnt, verständliche Meldung, nichts angelegt), `tests/rides/erfassenAtomar.test.ts` (Routing-Fehler in der Vorschlagsrechnung → Hin- und Rückfahrt trotzdem vollständig ERFASST statt Ausnahme und Hinfahrt ohne Rückfahrt; Fremdreferenz → nichts angelegt), `tests/drivers/einladen.test.ts` – die ersten drei vorher rot, jetzt grün.
Geändert: `src/core/rides/erfassen.ts` (Hin- und Rückfahrt samt Statuswechsel in einer Transaktion, Vorschlag danach und fehlertolerant), `src/app/dispo/fahrer/actions.ts` (`fahrerEinladen`/`fahrerImportieren` in Transaktion), `src/core/einrichtung/registrierungsLimit.ts` (neu) + Tabelle `Registrierungsversuch` (Migration `20261031170000`, Anschluss nur gehasht, Einträge > 24 h gelöscht), `src/app/(auth)/registrieren/actions.ts` (Begrenzung vor jeder E-Mail-Abfrage).
Ehrlich: Ein Fehler *zwischen* Nutzer- und Fahrerprofil-Anlage lässt sich ohne Mock der Datenbank nicht auslösen; `tests/drivers/einladen.test.ts` sichert den Normalfall und die Dublette ab (wäre auch vorher grün gewesen), die Transaktion selbst ist per Code belegt.
`prisma/schema.prisma` wurde dabei mit `prisma format` neu ausgerichtet (nur Leerzeichen, `migrate diff` leer).
Commits: `b122b52` (S2-011), `532ab32` M-23

## Auf dem Weg aufgefallen
Nicht im Auftrag, nicht geändert. Für den Prüfer als Verdacht mit Fundort.
1. **`fahrtStatusSetzen` ist eine offene Büro-Action ohne Oberfläche** (`src/app/dispo/fahrten/actions.ts`, `fahrtStatusSetzen`): Sie setzt jeden laut Tabelle erlaubten Status direkt, z. B. DISPONIERT → ERFASST, ohne Fahrzeug/Fahrer zu lösen (umgeht M-20), oder ERFASST → DISPONIERT ohne Fahrzeug. Rollenprüfung ist vorhanden. Empfehlung: entfernen oder auf `fahrtAendern`/`fahrzeugZuweisungAufheben` umleiten.
2. **Ortsnamen in Fahrer-SMS/-Push** (`src/core/notify/texte.ts` `neueFahrtText`/`kurzOrt`): Wohnorte heißen teils „Wohnung <Nachname>“; der Name kann so in SMS und Push an Fahrer gelangen (CLAUDE.md: nur Uhrzeit und Ort, kein Name). Erst bei Löschung wird das Label anonymisiert (S2-016).
3. **Problemcodes als Rohtext in „Braucht Sie“** (`src/app/dispo/fahrten/fahrplan.ts`, `problems.join(", ")`): `KEIN_FAHRZEUG`, `GENEHMIGUNG_FEHLT`, neu auch `FAHRT_ABGEBROCHEN` erscheinen als technische Codes.
4. **Zeitrechnung mit Server-Zeitzone** an den bekannten Stellen (M-26, P3) – u. a. `automatischDisponieren.ts` (`getFullYear()` für „frühere Fahrt heute“), `planFuerMorgen.ts`, `vorschlagSpeichern.ts`, `fahrer/actions.ts` `schichtenFuerWoche`. Nicht angefasst; neue Fahrten dieses Laufs rechnen über `week.ts`.
5. **„Fahrzeug ändern“ im Fahrt-Fenster** (`src/components/VorschlagAktion.tsx`) läuft über eigene Actions, nicht über `fahrtVerschieben`; ob dort für einen Fahrerwechsel ebenfalls genau eine Meldung je Fahrer entsteht, habe ich nicht geprüft.
6. **Testreste aus `tests/disposition/planFuerMorgen.test.ts`**: Der Fall „ohne Betriebshof“ räumt seinen Mandanten nur auf, wenn die Erwartung erfüllt ist (`Test-PlanMorgen-OhneDepot …` blieb bei einem roten Zwischenlauf zweimal liegen). Kein Produktionsthema; `try/finally` wäre sauberer.
7. **`tests/seed/seedSchutz.test.ts` löscht den Seed-Mandanten** „Muster Krankenfahrten“ der Test-DB; wer danach im Browser prüfen will, muss `npm run seed` erneut ausführen.

## Vorschläge und Erweiterungen
| Nr | Vorschlag | Nutzen für den Betrieb | Aufwand | Risiko | Empfehlung |
|----|-----------|------------------------|---------|--------|------------|
| 1 | EU-SMS-Anbieter als `SmsProvider` (Entscheidung 1), Zustellquittung in `Notification` | Fahrer-Login, Nachtalarme und Cron-Ausfall-Alarm kommen wirklich an | 0,5–1 Tag + Kosten | gering | vor dem Pilot |
| 2 | Rufnummern nur durch Betreiber zuweisen + E-Mail-Bestätigung der Registrierung (Entscheidung 2) | Niemand kann Kundenanrufe abfangen oder Spam-Fahrdienste anlegen | 1–2 Tage | mittel (Einrichtungsablauf) | vor dem Pilot |
| 3 | Überwachung von außen (Uptime-Dienst in der EU ruft eine Gesundheits-Route auf, die `CronLauf.letzterErfolg` prüft) | Auch ein komplett ausgefallener Zeitplaner fällt nachts auf | 0,5 Tag + ggf. Kosten | gering | vor dem Pilot |
| 4 | Postgres-`EXCLUDE`-Constraint gegen überlappende Zeitfenster je Fahrzeug (M-04 Punkt 5) | Datenbank als letzte Verteidigungslinie gegen Doppelbuchung | 1 Tag | mittel (Zeitfenster = geschätzte Dauer) | später |
| 5 | Routing-Grenze je Kandidat und 429-Rückfall als Problem `FAHRZEIT_GESCHAETZT` (M-14 Rest) | Kein stiller Qualitätsverlust der Vorschläge bei Überlast | 1 Tag | gering | vor dem Pilot |
| 6 | `fahrtStatusSetzen` entfernen bzw. auf die Fachfunktionen umleiten (Aufgefallen 1) | Keine Hintertür um Umplan-Regeln | 1 h | gering | jetzt |
| 7 | Klartexte für Problemcodes in „Braucht Sie“ (`texte.ts`) | Disponent versteht sofort, was zu tun ist | 2 h | gering | erste Pilotwochen |
| 8 | Fahrer-Texte nur mit Ortstyp statt Label, wenn das Label einen Fahrgastnamen enthalten kann (Aufgefallen 2) | Kein Name auf dem Fahrerhandy-Sperrbildschirm | 2–4 h | gering | vor dem Pilot |
| 9 | Test-Hilfe `mitTestMandant()` mit `try/finally` für alle DB-Tests | Keine Testreste, verlässliche Testdatenbank | 0,5 Tag | gering | später |
| 10 | Playwright-Klickwege für „Fahrt abbrechen“, „Serie beenden“, „Nachtschicht anlegen“ (nach M-38) | Schutz der neuen Oberflächen-Abläufe im Browser | 1 Tag | gering | erste Pilotwochen |

## Nachprüfungsauftrag für den Prüfer
Voraussetzung: lokale Postgres, `.env` mit `DATABASE_URL` (+ `AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `VAPI_WEBHOOK_SECRET`, `APP_URL`), `npx prisma migrate deploy` (15 Migrationen), vor dem Typecheck `npx next typegen`. Jeder einzelne Vitest-Befehl läuft in unter 10 Sekunden. Für Live-Proben: `npx next build` und `next start` mit Platzhaltern für `RESEND_API_KEY`/`VAPID_*` (sonst verweigert der Start in Produktion – gewollt, M-03), danach `npm run seed`.

| Kennung | So prüfen | Erwartung | Nebenwirkungen hier ansehen |
|---------|-----------|-----------|-----------------------------|
| M-01 (S1-006) | `npx vitest run tests/seed tests/demo/aufraeumen.test.ts` | 6/6 grün | `src/lib/seedSchutz.ts` – neue Tabellen (`CronLauf`) in der Löschreihenfolge |
| M-02 (S1-001, S3-018, R3-6) | `npx vitest run tests/sicherheit tests/export/abrechnungRoute.test.ts`; Reihenfolge: `npx vitest run tests/export/abrechnungRoute.test.ts tests/sicherheit/sitzung.test.ts tests/fahrer/actions.test.ts --sequence.shuffle.files --sequence.seed=3` | alles grün, auch gemischt | neue Actions (`fahrtAbbrechen`, Serien-Actions) im Quelltext-Test |
| M-03 (S4-013, S4-002) | `npx vitest run tests/lib/umgebung.test.ts tests/providers/sms.test.ts tests/notify/anmeldeLink.test.ts` | grün; ohne Anbieter lauter Fehler | Eskalation zählt Fehler statt Erfolg |
| M-04 (S1-004, S2-015) | `npx vitest run tests/disposition/zuweisenParallel.test.ts tests/disposition/zuweisenAtomar.test.ts tests/rides/status.test.ts` (mehrmals) | 16/16 grün, stabil | `fahrzeugZuweisen` meldet jetzt über `fahrerBenachrichtigen.ts` |
| M-05 (R3-1, S4-014) | `npx vitest run tests/fahrer/actions.test.ts` | 7/7 grün | – |
| M-06 (S1-003, S2-006, S2-007) | `npx vitest run tests/places tests/voice/ortSuchen.test.ts tests/passengers/sucheDb.test.ts` | grün | – |
| M-07 (S1-005, R1-2, R1-3) | `npx vitest run tests/rides/erfassen.test.ts` | 7/7 grün | Rückfahrt jetzt in derselben Transaktion (M-23) |
| M-08 (S2-012, R3-10) | `npx vitest run tests/fahrer/serviceWorker.test.ts tests/fahrer/geraeteDaten.test.ts`; Code: `public/sw.js` Handler `push`, `notificationclick`, `periodicsync`, `message` | 11/11 grün | Push-Anzeige darf nie am Aufräumen scheitern (`aufraeumenOhneFehler`); echtes Gerät offen |
| M-09 (S2-009) | `npx vitest run tests/sicherheit/logging.test.ts tests/notify/push.test.ts`; `git grep -n "console\.error" src` | grün; nur IDs/Fehlerart in den neuen Logzeilen | `src/core/betrieb/cronLauf.ts`, `src/app/api/voice/webhook/route.ts` |
| M-10 (S3-012, S3-024) | `npx vitest run tests/passengers/loeschung.test.ts tests/datenschutz/loeschfristen.test.ts tests/notify/anrufZusammenfassung.test.ts` | 13/13 grün | Rückrufwunsch bleibt neben der Zusammenfassung (M-13) |
| M-11 (S2-008) | `npx vitest run tests/db-tenant.test.ts tests/rides/fremdeReferenzen.test.ts`; `psql … -c "select count(*) from pg_trigger where tgname like '%mandant_referenzen'"`; frische DB: `migrate deploy` + `migrate diff` | 17/17 grün; 13; Diff leer | Bestandsdaten mit Fremdreferenz (NOTICE der Migration); `db push`-Workaround installiert keine Trigger |
| M-12 (R3-4) | `npx vitest run tests/drivers/deaktivieren.test.ts` | 3/3 grün | Deaktivieren löst jetzt auch Fahrzeug/Fahrer der offenen Fahrten (M-20) |
| M-13 (S2-002, R2-11) | `npx vitest run tests/voice/identitaet.test.ts tests/notify/voicePrompt.test.ts`; live: Webhook `tool-calls` mit `customer.number` ≠ Fahrgastnummer und `fahrgast_suchen {telefon: <Fahrgastnummer>}` | 8/8 bzw. 5/5 grün; live keine `passengerId`, kein Geburtsdatum | Pflegeheim-Nummern; `voice:sim`-Szenarien 14–16 |
| M-14 (S2-014, S3-016, S4-007, V-005) | `npx vitest run tests/voice/idempotenz.test.ts tests/voice/webhookRoute.test.ts tests/voice/serieWebhook.test.ts tests/sicherheit/geheimnis.test.ts`; live: falsches Geheimnis → 401, `{kaputt` → 400 | grün; 401/400 | `after()` auf Vercel (nicht prüfbar); Termine notfalls erst beim nächsten `serienVerlaengern` |
| M-15 (S2-017, R2-8, S3-006) | `npx vitest run tests/notify/eskalation.test.ts` | 12/12 grün | Inhaber-Alarm-Zeitpunkt (Annahme 9b) |
| M-16 (S2-010, R2-3, S3-011) | `npx vitest run tests/disposition/cronLauf.test.ts tests/disposition/planFuerMorgen.test.ts`; live zweimal kurz nacheinander `GET /api/cron/automodus` mit Geheimnis; `select * from "CronLauf"` | grün; Lauf/„gesperrt“ je Mandant; Zeilen mit `letzterErfolg` | Sperre 10 Min (sehr lange Läufe); kein Alarm, wenn der Zeitplaner ganz steht |
| M-17 (S2-003) | `npx vitest run tests/disposition/automodus.test.ts tests/disposition/automodusVorausplanung.test.ts` | grün | Demo-GPS-Auffrischung unverändert (Entscheidung 6) |
| M-18 (S2-004) | `npx vitest run tests/shifts/nachtschicht.test.ts` | 6/6 grün | Wochenplan zeigt Nachtschicht am Starttag mit „(Folgetag)“ |
| M-19 (R3-3) | `npx vitest run tests/rides/stornieren.test.ts`; `/dispo` → laufende Fahrt öffnen | 6/6 grün; Knopf „Fahrt abbrechen“ mit eigener Rückfrage | PROBLEM-Fahrten in „Braucht Sie“ (Rohcode, Aufgefallen 3) |
| M-20 (R2-4, R2-5, R2-6, R2-9, S3-004) | `npx vitest run tests/rides/umplanen.test.ts tests/disposition/planFuerMorgenProbleme.test.ts tests/rides/fahrerAusfall.test.ts` | grün | `fahrtStatusSetzen` (Aufgefallen 1), `VorschlagAktion` (Aufgefallen 5), KI-`fahrt_aendern` löst jetzt die Zuweisung |
| M-21 (S2-013, V-006) | `npx vitest run tests/passengers/telefonSchluessel.test.ts tests/passengers/suche.test.ts tests/drivers/telefon.test.ts` | 14/14 grün | – |
| M-22 (S2-005, R2-10) | `npx vitest run tests/rides/serieVerwalten.test.ts tests/providers/voice/vapi.test.ts`; `/dispo/fahrgaeste` → Fahrgast mit Serie → „Serienfahrten“ | grün; Beenden/Pause/Ändern mit Meldung | Fahrer bekommen für jede stornierte Serienfahrt „Fahrt entfällt“ |
| M-23 (S2-011, S3-020, S4-009) | `npx vitest run tests/auth/registrieren.test.ts tests/rides/erfassenAtomar.test.ts tests/drivers/einladen.test.ts` | grün | Registrierungen hinter gemeinsamer IP (Firmen-NAT) teilen sich das Limit von 5/h |
| Gesamt | `npm run lint && npx next typegen && npm run typecheck && npm test`; `npx vitest run --sequence.shuffle.files --sequence.seed=11` | 0 Fehler/0 Warnungen; 398/398 grün, auch gemischt | – |

## Was ich NICHT prüfen konnte
- **Echte Geräte:** Service-Worker-Verhalten (Aufwachen per Push, `periodicsync`), Push und SMS auf iPhone/Android (M-03 Punkt 5, M-08, V-007).
- **Browser-Klickwege:** Playwright-Browser sind in dieser Umgebung nicht installiert; die neuen Oberflächen (Nachtschicht-Hinweis, „Fahrt abbrechen“, „Serienfahrten“) sind nur per Typecheck, Lint und Build geprüft, nicht im Browser oder unter 1000 px Breite. Design-Checkliste (Abschnitt 11) nach Code: keine neue Seite (bestehende Seitenmuster erweitert), kein zusätzlicher Primärknopf, nur Token-Farben (Orange nur für Handlungsbedarf, Pause-Kennzeichen daher „info“), Lade-/Leer-/Fehlerzustand in „Serienfahrten“ und Fehlermeldung im Fahrt-Fenster vorhanden, Begriffe aus Abschnitt 8 („Stornieren“; neu „Fahrt abbrechen“ – nicht in der Begriffsliste, bitte aufnehmen oder Alternative nennen), echte Buttons/Inputs mit Label, Meldungen mit `aria-live`; Tastatur, Kontrast und Handy nicht getestet.
- **Telefonanbieter:** echte Anrufe gegen Vapi (Wirkung des neuen System-Prompts, V-008), Vapi-Wiederholungsverhalten (V-011), ob `after()` auf Vercel die Serientermine zuverlässig nach der Antwort erzeugt.
- **Hosting:** Überlappung der Vercel-Crons (V-002), Verhalten der Lease-Sperre hinter dem Neon-Pooler unter Last (V-009), getrennte Preview-/Produktions-Datenbank (V-003).
- **Externe Dienste:** OpenRouteService (Routing lief über die Luftlinien-Schätzung), Resend, SMS-Anbieter – bewusst nicht angesprochen.
