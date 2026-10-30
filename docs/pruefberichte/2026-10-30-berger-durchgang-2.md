# Prüfbericht Dispona – Durchgang 2 – 30.10.2026 – Prüfer: K. Berger

## Urteil in einem Satz
Pilotstart weiterhin **nein**, und das Urteil ist nach dem Lauf gegen eine echte Datenbank und einen echten Server härter geworden: Die vier Kernbefunde aus Bericht 1 (offener Export, Doppelbuchung, Fremdschlüssel über Mandantengrenzen, fehlender Fahrer-Login in Produktion) sind live reproduziert, dazu kommen ein Seed-Skript, das mit einem Befehl die Betriebsdaten **aller** Mandanten löscht, eine Fahrer-App, die Fahrgastdaten und sogar die komplette Abrechnungsdatei dauerhaft im Handy-Cache ablegt, eine Stammkundenerkennung, die für alle im Büro angelegten Fahrgäste systematisch versagt, und ein Webhook, der bei Wiederholung doppelte Fahrten anlegt.

## Zahlen
Neue Befunde: **S1: 1 | S2: 6 | S3: 11 | S4: 4 | neue Verdachte: 4** (V-010 bis V-013). Nachprüfungen Bericht 1: 12 Kennungen, davon 9 live bestätigt, 2 verschärft, 1 teilweise bestätigt; abgearbeitete alte Verdachte: V-001, V-005, V-006, V-009.
Geprüfte Dateien: ca. 60 Quelldateien (alle 11 API-Routen, alle 8 Server-Action-Dateien, Fahrer-App komplett inkl. `public/sw.js`, Kernlogik Disposition/Fahrten/Löschung/Serien, Schema, 5 Migrationen, Seed, Playwright, Website-Preisseite). Befehle/Tests: kompletter Vitest-Lauf (200 Tests, grün), 7 eigene Reproduktionsdateien mit 16 Testfällen gegen PostgreSQL, `next build` + `next start` auf Port 3001, ca. 45 HTTP-Aufrufe mit curl (Anmeldung, Export, Cron, Webhook, Header), `npm run seed`, `prisma migrate diff/status`, `npm audit`, `npm outdated`, 2 Playwright-Tests, ca. 15 psql-Schema-Abfragen.
Umgebung: `npm test` gegen Datenbank **200/200 grün** (Bericht 1 ohne DB: 158/3/39). Migrationen = Schema (`migrate diff` leer, `migrate status` aktuell). `npm audit`: unverändert 2 moderate (uuid in exceljs). Testserver, Testdaten und Scratch-Dateien am Ende entfernt; `git status` sauber; `.next/` existiert (erlaubt). Die Test-DB enthält jetzt die Seed-Daten „Muster Krankenfahrten“ (dokumentiert, keine Produktion).

---

## Nachprüfung Bericht 1

| Kennung | Ergebnis | Beweis |
|---|---|---|
| **S1-001** Export ohne Rollenprüfung | **bestätigt live** | FAHRER-Sitzung per Magic-Link erzeugt, `GET /api/export/abrechnung?...&nurNichtExportierte=false` → **200 text/csv, 721 Bytes**, alle Fahrgäste mit Geburtsdatum/Kasse/Adressen. Danach `exportedAt` bei 3 Fahrten gesetzt; Standard-Export des Admins → **404 „Keine erledigten Fahrten“**. Ohne Sitzung → **500** (Server-Log: `Error: Nicht angemeldet.`), nicht 401. |
| **S1-002** SMS-Platzhalter / Fahrer-Login | **bestätigt live** | Produktionsserver (`next start`, NODE_ENV=production): `POST /api/auth/sign-in/magic-link` → 200, Token nur in Tabelle `verification`, kein Versand, kein Log. Anmelden ging ausschließlich, weil ich den Token aus der Datenbank gelesen habe. Im Vitest-Lauf (eskalation): `[Entwicklung] SMS an +491700000001: Neue Fahrt 02:09 Wohnung → Dialyse` – Konsolenzeile statt SMS. |
| **S1-004** Doppelbuchung | **bestätigt gegen Postgres** | `Promise.allSettled([fahrzeugZuweisen(A,V1), fahrzeugZuweisen(B,V1)])` → `['fulfilled','fulfilled']`; Tabelle `Ride`: beide `status DISPONIERT`, beide `vehicleId` = V1, Abholzeiten 00:59 und 01:04 UTC (5 Min Abstand). Sequentiell korrekt abgelehnt („schon für eine andere Fahrt eingeplant“). |
| **S2-008** Fremdschlüssel über Mandantengrenze | **bestätigt live** | `fahrtErfassen(tenantA, {passengerId: <B>, pickupPlaceId: <B>})` → Fahrt angelegt, `probleme: ['GENEHMIGUNG_FEHLT']`, `Ride.tenantId = A`, `passenger.tenantId = B`, `pickupPlace.tenantId = B`. `withTenant(A).ride.findMany({include: passenger})` liefert Mandant A den Namen **„PRUEF_… B-Fremd“ mit Geburtsdatum 1941-05-03** des fremden Fahrgasts. |
| **S2-009** PII im Log | **bestätigt** | Testlauf schreibt `[Entwicklung] SMS an +491700000001: Neue Fahrt 02:09 Wohnung → Dialyse` und `Push an Fahrer <id>: Neue Fahrt …` ohne `istEntwicklung`-Prüfung (NODE_ENV=test, würde in Produktion identisch laufen, sobald VAPID fehlt bzw. SMS-Provider so bleibt). |
| **S2-011** Registrierung öffentlich | **bestätigt + verschärft** | `firmaRegistrieren` ohne Session funktioniert (Playwright-Test nutzt genau das). Parallel zweimal gleiche E-Mail → `['{"ok":true}', 'rejected']`, **2 Tenants, 1 User** (verwaister Mandant, 2. Aufruf unbehandelter Fehler). Siehe S3-020. |
| **S3-002** Prisma-Retry schreibt doppelt | unverändert (nur Code) | nicht reproduzierbar ohne Verbindungsabbruch; Logik unverändert. |
| **S3-012** summary/fromNumber unbefristet | **verschärft** | Nach `loeschfristenDurchsetzen` (dataRetentionDays 30): `transcript null, audioUrl null`, aber `summary = "Theo Testmann-Löschung bestellt Dialysefahrt Mo 06:30, Rückruf +491700000001"` und `fromNumber` bleiben. Zusätzlich S3-024: ohne ANTHROPIC_API_KEY landet das **Roh-Transkript** im Klartext in `summary`. |
| **S4-007** Geheimnisvergleich / kein Replay-Schutz | **bestätigt mit Folge** | identischer Webhook zweimal → zwei Fahrten (S2-014). |
| **S4-009** Mehrzeilen-Schreiben ohne Transaktion | **bestätigt live** | Registrierung: verwaister Tenant (s. o.). |
| **S3-003** Geocoding-Actions ohne Sitzung | unverändert (Code) | `ortSuchen`, `adresseSuchen` ohne `requireSession` (Manifest: beide als Server Action registriert und im Client-Chunk auffindbar). |
| **S4-001** Sicherheitsbericht Punkt 1 „Test bestätigt A sieht nie B“ | **jetzt grün, aber Aussage weiterhin unvollständig** | `tests/db-tenant.test.ts` läuft mit DB grün (6 Tests) – prüft aber nur direkte Zugriffe, nicht Fremdschlüssel/`include` (S2-008 live widerlegt die Aussage). |

Abgearbeitete Verdachte: V-001, V-005, V-006, V-009 – siehe Abschnitt „Verdachte“.

---

## Die drei gefährlichsten neuen Befunde
1. **`npm run seed` löscht die Betriebsdaten aller Mandanten (S1-006).** Live bewiesen: Ein zweiter Mandant mit Fahrgast, Fahrzeug, Rufnummer und Einstellungen hatte nach dem Seed-Lauf **0 Fahrgäste, 0 Fahrzeuge, 0 Rufnummern, 0 Einstellungen** – nur die Tenant- und User-Zeile blieben. Laut Git-Historie (Commit `027a5e1`) wurde bereits ein Seed gegen die Produktionsdatenbank gefahren; `dotenv` lädt die `.env` automatisch.
2. **Die Fahrer-App legt alles, was sie je geladen hat, im Handy-Cache ab – inklusive der Abrechnungsdatei (S2-012).** `public/sw.js` speichert jede gleich-origin GET-Antwort (Fahrgastname + Telefon im `/fahrer`-HTML, aber auch `/api/export/abrechnung?...` mit allen Fahrgästen), Geltungsbereich ist die ganze Domain, Löschung nur beim nächsten Aufruf an einem späteren Tag, **nie beim Abmelden**. Zusammen mit S1-001 liegt die Patientenliste auf dem Handy jedes Fahrers, der die URL einmal öffnet – auch nach Logout, auch nach Kündigung.
3. **Die KI erkennt keinen einzigen Fahrgast, der im Büro angelegt oder importiert wurde (S2-013).** Oberfläche/Import speichern Telefonnummern unverändert (`"0171 2345678"`), die KI sucht nur den normalisierten Schlüssel (`"+491712345678"`) → 0 Treffer, bewiesen gegen Postgres. Jeder Stammkunde wird beim ersten KI-Anruf neu angelegt (Dublette, ohne Genehmigung → `GENEHMIGUNG_FEHLT`). Dazu S2-014: Ein wiederholter Webhook legt dieselbe Fahrt zweimal an.

---

## Neue Befunde

### [S1-006] `npm run seed` löscht alle Fahrgäste, Fahrzeuge, Fahrten, Orte, Rufnummern und Einstellungen **aller** Mandanten – ein Befehl, Totalverlust
Fundort: `prisma/seed.ts:17-36` (`prisma.ride.deleteMany()`, `prisma.passenger.deleteMany()`, `prisma.vehicle.deleteMany()`, `prisma.place.deleteMany()`, `prisma.phoneNumber.deleteMany()`, `prisma.tenantSettings.deleteMany()`, … – alle **ohne `where`**; nur `user` und `tenant` sind auf „Muster Krankenfahrten“ gefiltert); `prisma/seed.ts:1` (`import "dotenv/config"` → nimmt `DATABASE_URL` aus der `.env`, also im Zweifel Produktion); CLAUDE.md/README empfehlen `npm run seed` als normalen Befehl.
Beweis (Test-DB, eigener Mandant `PRUEF_fremd` mit je 1 Fahrgast/Fahrzeug/Rufnummer/Einstellungen):
```
vor Seed:  Passenger 1 | Vehicle 1 | PhoneNumber 1 | TenantSettings 1 | Tenant 1
npm run seed → "Lösche alte Beispieldaten …" … "Fertig."
nach Seed: Passenger 0 | Vehicle 0 | PhoneNumber 0 | TenantSettings 0 | Tenant 1
```
Ursache: Seed als Entwickler-Werkzeug ohne Mandantenbezug geschrieben; gleicher Code-Pfad wie in S3-013 (`seedDemoTenant` „bereits gegen Produktion gelaufen“). Kein Schutz („nur wenn DATABASE_URL localhost“), keine Rückfrage.
Ausbreitung: `demoZuruecksetzen(tenantId = DEMO_TENANT_ID)` (S3-013) ist der zweite Hard-Delete-Pfad. Nach dem Seed hat jeder andere Mandant keine `TenantSettings` mehr → `mandantFuerNummerLaden` liefert `null` → **KI nimmt keine Anrufe mehr an**, `einrichtungLaden` wirft (`findUniqueOrThrow`).
Betriebsszenario: Entwickler will „schnell Beispieldaten“ auf seinem Rechner, `.env` zeigt noch auf Neon-Produktion (so ist es laut Commit schon einmal passiert). Alle Kundenfahrten von morgen, alle Stammkunden, alle Genehmigungen sind weg; Neon-Free erlaubt 24 h Zeitreise – wenn es jemand am selben Tag merkt.
Prüfung durch: Live-Ausführung gegen Test-DB mit Vorher/Nachher-Zählung; Seed-Quelle gelesen; Git-Log.

### [S2-012] Service Worker speichert Fahrgastdaten und Abrechnungsexport unbegrenzt im Browser-Cache, über die gesamte Domain, ohne Löschung beim Abmelden
Fundort: `public/sw.js:33-49` (Fetch-Handler: `if (event.request.method !== "GET") return; … cache.put(event.request, antwort.clone())` für **jede** gleich-origin Anfrage), `src/app/fahrer/ServiceWorkerRegistrar.tsx:9` (`register("/sw.js")` → Scope `/`, nicht `/fahrer`; `manifest.json` „scope: /fahrer“ ändert daran nichts), `src/components/SignOutButton.tsx` (kein `caches.delete`, kein Löschen der `localStorage`-Warteschlange), `sw.js:7-17` (Löschung alter Tages-Caches nur bei `install/activate/fetch`, also nur wenn die App an einem späteren Tag wieder geöffnet wird).
Beweis: `/fahrer`-HTML mit Fahrer-Sitzung enthält `firstName":"Peter","lastName":"Fischer","phones":["+4924190000004"]` (15.233 Bytes, RSC-Payload). Der Export unter `/api/export/abrechnung?…` ist eine GET-Antwort (S1-001: 200 für FAHRER) und erfüllt alle Bedingungen des Fetch-Handlers. `grep -rn "caches" src` → keine Treffer außerhalb `sw.js`.
Ursache: Offline-Fähigkeit per „alles cachen“ statt App-Shell + explizit gewählter Datenquellen; Datenschutzkonzept („Fahrgastdaten nach Erledigung nicht mehr in der App“, `fahrerUebersichtLaden`) wird vom Cache unterlaufen.
Ausbreitung: Betrifft auch `/dispo`-Seiten, wenn ein Disponent dieselbe Domain im selben Browser nutzt (der SW gilt für alle Pfade), und `/api/auth/get-session`.
Betriebsszenario: Fahrer wird entlassen, meldet sich ab, Handy wird verkauft/verloren. Im Cache Storage: Tagesplan mit Namen/Telefon, ggf. der CSV-Export mit 800 Fahrgästen, Geburtsdaten, Krankenkassen. Meldepflichtig nach Art. 33 DSGVO.
Prüfung durch: `sw.js` vollständig gelesen; Live-Abruf des HTML; grep.

### [S2-013] Telefonnummern aus Oberfläche und Import werden nicht normalisiert – die KI findet keinen im Büro angelegten Stammkunden
Fundort: `src/core/passengers/validation.ts:39-44` (`telefonListeAusText`: nur `split/trim`), `src/app/dispo/fahrgaeste/actions.ts:40,118` (`fahrgastSpeichern`, `fahrgaesteImportieren` nutzen es), `src/core/voice/werkzeuge.ts:66` (`phones: { has: telefonNormalisieren(telefon) }`), `src/app/dispo/fahrten/actions.ts:270-276` (Anruf-Panel „bekannter Fahrgast“: `hasSome` normalisiert).
Beweis (Postgres): Fahrgast per `telefonListeAusText("0171 2345678, 02401/12345")` gespeichert → `phones = ['0171 2345678','02401/12345']`; KI sucht `telefonNormalisieren("0171 2345678") = "+491712345678"` → **Treffer: 0**. Nur von der KI selbst angelegte Fahrgäste sind normalisiert (`werkzeuge.ts:48`); der Seed benutzt zufällig E.164.
Ursache: Zwei Eingabewege, ein Suchschlüssel, keine zentrale Normalisierung beim Schreiben.
Ausbreitung: `fahrgaesteLaden(suche)` (`phones: { has: text }`) findet in der Oberfläche umgekehrt keine KI-Fahrgäste bei Eingabe „0171 …“; Stammkundenerkennung im Live-Panel (`bekannterFahrgast`) ebenso; `telefonNormalisieren` selbst ist fehlerhaft (V-006 bestätigt, s. u.).
Betriebsszenario: Betrieb importiert 600 Fahrgäste aus der alten Software (Format „0241 123456“). Jeder Anruf erzeugt einen neuen Fahrgast ohne Genehmigung → jede Fahrt `GENEHMIGUNG_FEHLT` → Automodus (requireDocsForAuto) disponiert nichts, „Braucht Sie“ voll, Abrechnung voller Dubletten.
Prüfung durch: Reproduktion gegen Postgres; Code gelesen.

### [S2-014] Wiederholter Vapi-Webhook legt die Fahrt erneut an – keine Idempotenz je `toolCallId`; Webhook nimmt 6 MB Body an, ungültiges JSON → 500
Fundort: `src/app/api/voice/webhook/route.ts:24,89-93` (`request.json()` ohne try, `werkzeugAusfuehren` je Aufruf ohne Prüfung, ob `toolCall.id` schon verarbeitet), `src/core/voice/werkzeuge.ts:150-176` (`fahrtAnlegenWerkzeug` ohne Dedupe).
Beweis (Live, Testserver, Seed-Mandant):
```
identischer tool-calls-Webhook (call PRUEF_replay_call, fahrt_anlegen) 1. Mal → "Fahrt erfasst, aber mit Hinweis: GENEHMIGUNG_FEHLT. (rideId …14f)"  200
                                                            2. Mal → "Fahrt erfasst, aber mit Hinweis: DOPPELBUCHUNG, GENEHMIGUNG_FEHLT. (rideId …6z1)"  200
Fahrten mit callId dieses Anrufs: 2
kaputtes JSON → 500 | Content-Type text/plain → 500 | 6.000.000-Byte-Body → 200 in 0,03 s (kein Limit)
end-of-call-report 2× → beide 200, zweiter überschreibt Transkript/Zusammenfassung erneut (zweiter Zusammenfassungs-KI-Aufruf = Kosten)
```
Ursache: Fehlendes Idempotenz-Konzept (toolCallId wird nicht gespeichert); `DOPPELBUCHUNG` ist nur Hinweis, keine Sperre.
Ausbreitung: `serie_anlegen` doppelt → zwei Serien (14 Tage × Termine); `fahrt_stornieren`/`fahrt_aendern` harmlos. Verstärkt durch V-005: Ein Serien-Webhook braucht hunderte sequentielle Routing-Aufrufe → Timeout beim Anbieter → Wiederholung (Vapi-Retry-Verhalten: V-011) → Doppelserie.
Betriebsszenario: Netzwerk-Hänger zwischen Vapi und Vercel, Vapi sendet erneut: Zwei Fahrzeuge fahren um 06:30 zu Frau M.; oder Dialyse-Serie doppelt → 24 statt 12 Fahrten im Plan.
Prüfung durch: Live-Replay mit curl, Zählung in `Ride`; Code gelesen.

### [S2-015] Parallele, widersprüchliche Statuswechsel werden beide angenommen – „Fahrgast an Bord“ und „Fahrgast nicht angetroffen“ gleichzeitig, doppelte ERLEDIGT-Ereignisse
Fundort: `src/core/rides/status.ts:52-115` (Lesen → prüfen → `update` → `create Event` → `create AuditLog`, keine Transaktion, kein `WHERE status = <alt>` im Update), Aufrufer `src/app/fahrer/actions.ts:69-85` (`fahrtStatusSetzenFahrer`), `src/app/fahrer/OfflineSync.tsx` (Warteschlange sendet nach).
Beweis (Postgres):
```
UNTERWEGS → parallel AN_BORD + NICHT_ANGETROFFEN: ['fulfilled','fulfilled'], Endstatus AN_BORD, Events: ['NICHT_ANGETROFFEN','AN_BORD']
AN_BORD   → parallel ERLEDIGT + ERLEDIGT:          ['fulfilled','fulfilled'], ERLEDIGT-Events: 2, AuditLog: 2
```
Ursache: Check-then-act ohne Sperre, gleiches Muster wie S1-004.
Ausbreitung: Offline-Warteschlange + erneutes Tippen auf dem Handy erzeugen genau diese Doppelsendungen; `minutenSeitDisponiert`/Eskalation und Abrechnung (`completedAt`, `distanceKm` aus `AN_BORD`-Ereignis) lesen das jeweils erste Ereignis.
Betriebsszenario: Fahrer tippt im Funkloch „Fahrgast nicht da“, überlegt es sich, tippt „abgeholt“; beim Nachsenden landen beide. Ereignisprotokoll zeigt Fehlfahrt **und** Beförderung – bei einer Kassenprüfung nicht erklärbar; Abrechnung nimmt je nach Ereignisreihenfolge mal die eine, mal die andere Variante.
Prüfung durch: Reproduktion gegen Postgres.

### [S2-016] Fahrgast-Löschung (Art. 17 DSGVO) lässt gesundheitsnahe und personenbezogene Daten stehen; Löschfristen erfassen Zusammenfassung und Anrufernummer nie
Fundort: `src/core/passengers/loeschung.ts:76-83` (nur `Passenger`-Felder, `Approval`, Serien-`until`), `src/core/datenschutz/loeschfristen.ts:25-33` (nur `audioUrl`, `transcript`).
Beweis (Postgres, echter Datensatz, nach `fahrgastAnonymisieren`):
```
Passenger: firstName "Gelöscht" … (ok)
Call.fromNumber "+491700000001" | Call.summary "Theo Testmann-Löschung bestellt Dialysefahrt Mo 06:30, Rückruf +491700000001" | transcript (verschlüsselt, vorhanden) | audioUrl vorhanden
Ride.assistanceNotes "Sauerstoffgerät, Treppenhilfe 3. OG" | pickupPlace.label "Wohnung Testmann-Löschung", street "Geheimweg 7"
RideSeries.template.assistanceNotes "dement, Begleitung" | RideStatusEvent lat/lng des Wohnorts
nach loeschfristenDurchsetzen (30 Tage): transcript null, audioUrl null – summary + fromNumber unverändert; Notification(toRef Telefon, rideId gelöschter Fahrt) bleibt
```
Ursache: Anonymisierung nur auf der Fahrgast-Zeile; Namen stecken in Orts-Labels („Wohnung <Name>“ ist das Standardmuster aus `ortSuchen`/Seed), Notizen, Zusammenfassungen und Rufnummern; Löschfristen nur für zwei Felder spezifiziert (docs/08 nennt „Audio“, „Transkript“, „GPS“).
Betriebsszenario: Angehörige verlangen Löschung nach Tod; Admin klickt „Fahrgast löschen“; sechs Monate später steht in `/dispo/anrufe` weiterhin „Theo T. bestellt Dialysefahrt … Rückruf 0170…“, Ortsliste zeigt „Wohnung Testmann“, Fahrtenbuch „Sauerstoffgerät“. Datenschutzbeauftragter: Löschanspruch nicht erfüllt.
Prüfung durch: Reproduktion gegen Postgres mit vollständigem Datensatz.

### [S2-017] Eskalation ist je Fahrt statt je Zuweisung – nach einem Fahrerwechsel bekommt der neue Fahrer nie eine SMS, nachts bleibt der Alarm aus
Fundort: `src/core/notify/eskalation.ts:49-52` (`notification.findFirst({ rideId, kind: "KEINE_BESTAETIGUNG_FAHRER" })` – ohne `toRef`/Fahrer, ohne Zeitpunkt der letzten Zuweisung), `zuweisen.ts:90` (`driverAckAt: null` wird zurückgesetzt, Notification nicht).
Beweis (Postgres, SMS-Platzhalter zählt als Versand):
```
Zuweisung an Fahrer 1, 5 Min alt → Lauf 1: smsAnFahrer 1
Schicht auf Fahrer 2 umgehängt, neu zugewiesen (driverId = Fahrer 2, driverAckAt null), 5 Min alt → Lauf 2: smsAnFahrer 0
Notifications: NEUE_FAHRT(F1), KEINE_BESTAETIGUNG_FAHRER(F1), FAHRT_ENTZOGEN(F1), NEUE_FAHRT(F2)  ← kein Eintrag für F2
```
Ursache: Eindeutigkeitsschlüssel der Notification ist `(rideId, kind)`, fachlich müsste er `(rideId, driverId, Zuweisungszeitpunkt)` sein. Gleiches für `KEINE_BESTAETIGUNG_INHABER`.
Betriebsszenario: 04:30 Fahrer A fällt aus („Ich falle aus“), Automodus plant auf B um. B schläft, Handy stumm. Kein SMS-Versuch, kein Inhaber-Alarm – weil für diese Fahrt „schon eskaliert“ wurde. 06:00 steht niemand vor der Tür.
Prüfung durch: Reproduktion gegen Postgres.

### [S3-015] CSV-Export schreibt Formeln unverändert – Formelinjektion über Fahrgastname, Krankenkasse, Hinweise
Fundort: `src/core/export/abrechnung.ts:122-152` (`zellenwert` ohne Bereinigung), `src/app/api/export/abrechnung/route.ts:108` (`Papa.unparse` → nur Anführungszeichen), Import `fahrgaesteImportieren` ohne Bereinigung.
Beweis (Live-Export als Datei, Zeile 2):
```
"=HYPERLINK(""http://boese.example"";""klick"") PRUEF_Formel",1945-01-01,+cmd|' /C calc'!A0,2026-10-31,…
```
Excel/LibreOffice werten Zellen mit führendem `=`, `+`, `-`, `@` als Formel aus. XLSX (ExcelJS, Strings) ist nicht betroffen, CSV ist aber Standard (`format` ≠ `xlsx`).
Ursache: Kein Escaping (führendes `'`) für Zellen, die mit Formelzeichen beginnen; Fahrgastdaten kommen aus KI-Erfassung und Import (Fremdeingabe).
Betriebsszenario: Anrufer nennt sich „=HYPERLINK(…)“ oder Import aus fremder Datei; Buchhaltung öffnet Monatsexport → Link-/Befehlsausführung auf dem Buchhaltungs-PC.
Prüfung durch: Live-Export und Datei gelesen.

### [S3-016] Fehlerbehandlung an den Rändern fehlt: ungültiges Datum, fehlende Sitzung, kaputtes JSON → HTTP 500; keine Body-Größenbegrenzung
Fundort: `route.ts (export):36-38` (`berlinerMitternacht(vonIso)` ungeprüft), `:19` (`requireSession` wirft), `webhook/route.ts:24`.
Beweis: `?von=gestern` → 500 (`RangeError: Invalid time value` im Log); ohne Sitzung → 500; Webhook `{nicht json` → 500; `text/plain` → 500; 6 MB Body → 200.
Betriebsszenario: Vapi erhält 500 statt definierter Fehlerantwort und wiederholt (→ S2-014); Monitoring sieht „Serverfehler“ statt „falsche Eingabe“.
Prüfung durch: Live-Aufrufe.

### [S3-017] Fahrzeugzuweisung prüft die Ausstattung nicht – Rollstuhl- und Liegendfahrt landen ohne Hinweis auf einem PKW
Fundort: `src/core/disposition/zuweisen.ts:22-103` (nur Zeitkonflikt), `kandidaten.ts:13-31` (`erfuelltAusstattung` existiert, wird nur in `vorschlagen.ts:67` genutzt). Antwort auf die Prüffrage: **nur empfohlen, nicht erzwungen.**
Beweis (Postgres): ROLLSTUHL-Fahrt → `fahrzeugZuweisen(PKW seats 4, wheelchairSpots 0, MANUELL)` → `status DISPONIERT, vehicleId = PKW, problems []`; LIEGEND auf PKW mit `dispatchMode AUTO` ebenso.
Ausbreitung: Manuelles „Anderes Fahrzeug“, Drag im Zeitstrahl (`fahrtVerschieben`), Ausweichkandidat; `fahrplanLaden`/TripModal zeigen keinen Konflikt.
Betriebsszenario: Disponent zieht morgens unter Zeitdruck die 06:40-Fahrt auf die freie Zeile „AC-MK 101“ – Rollstuhlfahrer, PKW ohne Rampe, Fehlfahrt, Dialyse verpasst.
Prüfung durch: Reproduktion gegen Postgres; Code.

### [S3-018] 12-Stunden-Grenze für Bürositzungen gilt nur für Seiten, nicht für API-Routen
Fundort: `src/proxy.ts:22-29` (Prüfung im Matcher), `src/lib/auth.ts:17-19` (Cookie 30 Tage für alle Rollen), `api/export/abrechnung/route.ts` ohne Altersprüfung.
Beweis (Live): Admin-Sitzung, `session.createdAt` auf −13 h gesetzt → `/dispo` → 307 `/anmeldung`; `/api/export/abrechnung` → **200**; `Set-Cookie … Max-Age=2592000` (30 Tage) auch für ADMIN.
Betriebsszenario: Büro-PC-Browser mit Cookie, 3 Wochen alt; wer den Rechner nutzt, lädt den Export (docs/08 verspricht 12 h).
Prüfung durch: Live.

### [S3-019] Fahrer-Rufnummer ist plattformweit eindeutig – ein Fahrer kann nur bei einem Fahrdienst existieren, der zweite Mandant bekommt einen Serverfehler
Fundort: `src/core/drivers/validation.ts:21-24` (`technischeFahrerEmail(phone)` = `fahrer-<ziffern>@fahrer.intern`), `schema.prisma` `User @@unique([email])`, `dispo/fahrer/actions.ts:52-68` (`fahrerEinladen` ohne Dublettenprüfung → P2002 unbehandelt), `:116` (`fahrerImportieren` prüft nur eigenen Mandanten).
Beweis: Code; Eindeutigkeit per `user_email_key` in der DB bestätigt.
Betriebsszenario: Teilzeitfahrer fährt für zwei Krankenfahrdienste (branchenüblich). Zweiter Betrieb: „Fahrer einladen“ → unbehandelter Fehler, kein Hinweis. Zusätzlich: „+49 171 …“ und „0171 …“ ergeben verschiedene E-Mails → derselbe Fahrer zweimal im selben Betrieb.
Prüfung durch: Code und Schema.

### [S3-020] Registrierung: parallele Anfragen hinterlassen verwaiste Mandanten, keine E-Mail-Formatprüfung, zweite Anfrage endet im Serverfehler
Fundort: `src/app/(auth)/registrieren/actions.ts:35-69` (`findUnique` → `tenant.create` → `user.create`, keine Transaktion, `email` nur `trim/lowercase`).
Beweis (Postgres): zwei gleichzeitige `firmaRegistrieren` mit gleicher E-Mail → `['{"ok":true}', 'rejected']`, **Tenants: 2, Users: 1**.
Betriebsszenario: Doppelklick auf „Fahrdienst anlegen“ → Nutzer sieht Fehlerseite, in der DB zwei Firmen; wer eine fremde Firmen-E-Mail zuerst registriert, sperrt den echten Inhaber aus („schon registriert“).
Prüfung durch: Reproduktion.

### [S3-021] Die Playwright-Klickwege sind tot: beide Tests rot, Erwartungen veraltet, keine CI
Fundort: `tests/e2e/startseite.spec.ts:6` (erwartet Überschrift „Anmelden“; Seite zeigt „Willkommen zurück“, `anmeldung/page.tsx:117`), `tests/e2e/einrichtung.spec.ts:46` (erwartet `/einrichtung/1` binnen 5 s; landet auf `/einrichtung`, Dev-Server-Kompilierung – Timing, nicht als Fachfehler bestätigt), `playwright.config.ts` (Port 3000 fest, `npm run dev`).
Beweis: Lauf mit vorinstalliertem Chromium (eigene Scratch-Konfiguration, da das Projekt Browser-Build 1248 erwartet, installiert ist 1243): `2 failed`. Der Einrichtungstest legt zudem eine Firma an, die bei Fehlschlag **in der Datenbank bleibt** (Aufräumen erst am Testende; „Playwright-Testfirma 1793401916640“ musste ich manuell löschen).
Prüfung durch: Ausführung, Fehlerkontext gelesen, Seitenquelle verglichen.

### [S3-022] Datenbankschema: keine CHECK-Constraints, drei Referenzen ohne Fremdschlüssel, fehlende Indizes auf den heißen Abfragepfaden
Fundort: `prisma/schema.prisma` / Live-Schema (`pg_constraint`, `pg_indexes`).
Beweis (psql): `Ride.driverId`, `Ride.returnOfId`, `Notification.rideId` haben **keinen** FK (freier Text). Indizes fehlen auf `Ride.vehicleId` (Konfliktprüfung in `zuweisen.ts:56`, jede Minute im Automodus), `Ride.driverId` (Fahrer-App, Eskalation), `Ride.callId`, `RideStatusEvent.rideId` (`minutenSeitDisponiert` je Fahrt, N+1 im Minuten-Cron), `Suggestion.rideId`, `Shift.driverId/vehicleId`; `Passenger.phones` (Array, `has`-Suche = Volltabellenscan). Keine CHECK-Constraints (z. B. `end > start` bei Shift – S2-004 wäre so auf DB-Ebene abgefangen). ON DELETE: `Ride.vehicleId SET NULL` (Fahrzeug-Hard-Delete würde Kennzeichen aus Fahrtenbuch entfernen – aktuell nur Soft-Delete, kein Pfad), `RideStatusEvent/Suggestion → Ride RESTRICT` (Löschfristen löschen deshalb in drei Schritten ohne Transaktion, `loeschfristen.ts:40-44`).
Positiv: Migrationen = Schema (`migrate diff` leer), `migrate status` aktuell. Negativ: keine Down-Migrationen, kein `IF NOT EXISTS` (Prisma-Standard, aber `prisma migrate deploy` im Build-Schritt, S3-013).
Prüfung durch: Schema-Inspektion live.

### [S3-023] „1,95 € / 2,49 € pro angenommenem Anruf“ – es gibt keine Zähl-, Prüf- oder Abrechnungslogik
Fundort: `website/index.html:290,417,435` (Preise), `src/**` (grep nach Preis/Zähler/Abrechnung an Betreiber: **0 Treffer**); einzige Datenbasis `Call`-Zeilen.
Beweis: `anrufSicherstellen` (`webhook/route.ts:57`) legt die `Call`-Zeile **vor** der Prüfung `aiErreichbarJetzt` an → auch außerhalb der KI-Zeiten weitergeleitete Anrufe (Ziel: Mensch) zählen als „Anruf“; `outcome ABGEBROCHEN` wird nicht gesondert bewertet; Demo-Mandant erzeugt Calls; kein unveränderlicher Zähler, kein Monatsabschluss, kein Kundeneinblick. `TenantPaket LITE/PRO` schaltet nur Funktionen.
Betriebsszenario: Rechnung über 412 Anrufe; Kunde zählt 380 KI-Gespräche – Streit ohne Beleg.
Prüfung durch: grep Website/Doku/Code; Webhook-Ablauf gelesen.

### [S3-024] Ohne `ANTHROPIC_API_KEY` oder bei API-Fehler landet das Roh-Transkript im Klartext in `Call.summary` – umgeht die Transkript-Verschlüsselung dauerhaft
Fundort: `src/core/notify/anrufZusammenfassung.ts:8-15,22,34` (`kurzfassungOhneModell`: erste 3 Zeilen/300 Zeichen des Transkripts, auch im `catch`), `anruf.ts:46` (`summary` unverschlüsselt), `loeschfristen.ts` (löscht `summary` nie), `dispo/anrufe/actions.ts:23` (Anzeige).
Beweis (Live, end-of-call ohne Schlüssel): `Call.summary = "PRUEF Transkript Testgespräch"` = wörtliches Transkript; `transcript` verschlüsselt. Verschärft S3-012.
Betriebsszenario: Anthropic-Kontingent erschöpft/Timeout um 03:00 → jedes Nachtgespräch (inkl. „Ich habe Brustschmerzen, aber…“) unverschlüsselt und unbefristet in der Anrufliste.
Prüfung durch: Live-Reproduktion.

### [S3-025] Öffentliche Seite `/live` liefert entschlüsselte Gesprächstranskripte und den Tagesplan des Demo-Mandanten ohne Anmeldung
Fundort: `src/app/live/actions.ts:21-39` (`liveDemoLaden`, `liveTranskriptLaden(callId)` → `decrypt`, kein `requireSession`, kein Audit), `live/page.tsx:15` („Rufen Sie die Demo-Nummer an“).
Beweis: `GET /live` ohne Sitzung → **200**; beide Actions im Manifest als öffentliche Server Actions der Route registriert. Heute enthält der Demo-Mandant simulierte Daten; der eigene Kommentar sagt: „Sollte die Demo-Nummer später live gehen, braucht ECHTE Anrufer-Daten hier wieder eine eigene Anonymisierung.“
Betriebsszenario: Marketing schaltet die Demo-Nummer frei (so beworben) → jeder Website-Besucher liest Transkripte echter Anrufer. Siehe V-010.
Prüfung durch: Live-Aufruf; Code; Manifest.

### [S4-011] Einmal-Codes stehen im Klartext in der Tabelle `verification`
Beweis (psql): `sign-in-otp-admin@…|669155:0`. Wer die Datenbank lesen kann (Backup, Neon-Konsole, Entwickler-`.env`), meldet sich als Büro an. Better Auth bietet gehashte Speicherung (`storeOTP`). Magic-Link-Token ebenso im Klartext (`identifier = magic-link:<token>`).

### [S4-012] Sicherheits-Header unvollständig
Live: vorhanden `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`; **fehlend** `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy` (Geolocation/Mikrofon für eine App, die GPS nutzt). `next.config.ts:22-30`.

### [S4-013] Ohne `RESEND_API_KEY` ist in Produktion kein Büro-Login möglich, Fehler nur im Server-Log
Live-Log bei jeder Code-Anforderung: `[Better Auth]: Failed to run background task: Error: RESEND_API_KEY ist nicht gesetzt.` – HTTP-Antwort trotzdem 200 („Code gesendet“). `.env.example` nennt die Variable nicht (S4-002). Der Nutzer wartet auf eine E-Mail, die nie kommt.

### [S4-014] Fahrer-Statuswechsel akzeptiert jeden Zielstatus, GPS-Werte ohne Bereichsprüfung
`src/app/fahrer/actions.ts:69-85` (`status: RideStatus` frei vom Client, Übergangsmatrix erlaubt aus DISPONIERT auch `STORNIERT`/`ERFASST` – Storno soll „beim Menschen im Büro“ bleiben), `:85` (`lat/lng` unvalidiert), `gpsPositionMelden(lat, lng)` (NaN/999 werden gespeichert), `laufendeSchicht` = `startedAt not null, endedAt null` ohne Datumsgrenze (nie beendete Schicht sendet tagelang GPS für dieses Fahrzeug).

---

## Verdachte

**Abgearbeitete Verdachte aus Bericht 1**
- **V-001** (`fahrplanFuerMandantLaden` als öffentlicher Endpunkt): **teilweise bestätigt.** `.next/server/server-reference-manifest.json`: 69 registrierte Server Actions; `fahrplanFuerMandantLaden` ist registriert (ID `78255974…`, Datei `src/app/dispo/fahrten/actions.ts`) und steht im Worker-Verzeichnis der **öffentlichen** Route `app/live/page`. Die ID kommt in keinem Client-Chunk unter `.next/static` vor (15 der 69 IDs fehlen dort, 54 sind auffindbar). Damit ist der Endpunkt nicht aus dem öffentlichen Bundle ablesbar – aber registriert und nur durch die Geheimhaltung der ID geschützt (siehe V-013). Nicht live aufgerufen. Empfehlung unverändert: Funktion nach `core/` verschieben.
- **V-005** (ORS-Aufrufe je Serie): **bestätigt per Mock-Zählung.** `vorschlaegeBerechnen` mit 14 Fahrzeugen im Dienst, je eine Vorfahrt: **42 Routing-Aufrufe je Fahrt** (3 je Kandidat, sequentiell), Serie mit 12 Terminen → **504 Aufrufe in einem Webhook**. ORS-Matrix-Freikontingent 40/Min; bei 429 fällt `matrix()` **stillschweigend** auf Luftlinie zurück (`openRouteService.ts:45-48`), kein Alarm, Vorschlagsqualität bricht ohne Hinweis ein. Dauer bei 100–300 ms je Aufruf: 50–150 s → Werkzeug-Timeout wahrscheinlich → S2-014.
- **V-006** (Telefonnormalisierung): **bestätigt.** `"0049 171 2345678" → +490491712345678`, `"+49 (0) 171 2345678" → +4901712345678`, `"0031612345678" → +49031612345678` (niederländische Nummer wird deutsch), `"00491712345678" → +490491712345678`. Korrekt nur für „0171…“, „+49…“, „02401…“. Dazu S2-013 (Oberfläche normalisiert gar nicht).
- **V-009** (Verbindungen): **rechnerisch untermauert, offen.** `max: 15` je Prozess (`prisma.ts:29`); auf Vercel läuft jede gleichzeitige Funktionsinstanz mit eigenem Pool: 4 Minuten-Crons (jeweils `Promise.all` über alle Mandanten) + Seitenaufrufe + Demo. Bei 8 gleichzeitigen Instanzen 120 Verbindungen; `idleTimeoutMillis 8 s` hält sie kurz, aber jede neue Instanz baut neu auf. Code nutzt `DATABASE_URL` direkt im pg-Adapter (kein erkennbarer Pooler-Endpunkt; `prisma7.config.ts` deutet an, dass `DATABASE_URL` der gepoolte Neon-Endpunkt sein *soll*). Prüfauftrag bleibt: Neon-Verbindungsmetrik und ob `DATABASE_URL` auf `-pooler` zeigt.

**Neue Verdachte**
- **[V-010]** Sobald die Demo-Nummer freigeschaltet wird, sind echte Anrufer-Transkripte über `/live` öffentlich (S3-025). Prüfauftrag: Vor Freischaltung `liveTranskriptLaden` entfernen oder Demo-Mandant hart von echten Rufnummern trennen; Test: Anruf auf Demo-Nummer, dann `/live` anonym öffnen.
- **[V-011]** Vapi wiederholt Webhooks bei Timeout/5xx (Standardverhalten vieler Anbieter; Vapi-Doku offline nicht prüfbar). Wenn ja, ist S2-014 nicht theoretisch, sondern bei jedem langsamen Serien-Webhook die Regel. Prüfauftrag: Vapi-Retry-Verhalten in der Doku/im Testanruf feststellen; Idempotenz je `toolCallId` unabhängig davon einbauen.
- **[V-012]** Next.js 16.4.3: Sicherheitshinweise offline nicht prüfbar (kein CHANGELOG in `node_modules/next`, kein Netz). `npm outdated` zeigt keine neuere Next-Version im Lockfile-Bereich; Prisma 7.10.1 (8.0 ist rc), better-auth 1.7.13 → 1.7.14 verfügbar. Prüfauftrag: `npm audit`/GitHub-Advisories für `next@16.4.3` online prüfen.
- **[V-013]** Server-Action-IDs: Falls Next.js die IDs deterministisch aus Dateipfad + Exportname ableitet (ohne Build-Salt), ist die ID von `fahrplanFuerMandantLaden` aus dem öffentlichen Git-Repo berechenbar – dann wäre V-001 ein offener Endpunkt für jeden. Prüfauftrag: zwei Builds vergleichen (`server-reference-manifest.json`), ob die IDs gleich bleiben; unabhängig davon die Funktion aus der `"use server"`-Datei entfernen.

---

## Was ich NICHT prüfen konnte
- Externe Dienste (Vapi, ORS, Resend, Anthropic, Sentry): Webhook-Form, Retry, Timeouts, echte Zusammenfassung – alle Tests mit Dummy-Geheimnissen; die KI-Gesprächsführung selbst (Notfallerkennung, Rückfragen) bleibt ungeprüft.
- Vercel/Neon: Cron-Überlappung, Umgebungsvariablen je Umgebung, Pooler-Endpunkt, Verbindungslimits, Log-Aufbewahrung, Backups.
- Server Actions mit `Next-Action`-Header habe ich **nicht** von außen aufgerufen; die Autorisierungslage ist über Manifest und Code belegt (S2-001 bleibt Code-Befund).
- Fahrer-App auf echten Geräten (iOS-Push mit `.invalid`-VAPID-Kontakt, Hintergrund-GPS, Cache-Verhalten bei Speicherdruck).
- Playwright-Einrichtungsfluss komplett: scheiterte am 5-s-Timeout nach Login (vermutlich Dev-Server-Kompilierung), nicht als Fachfehler bewertet.
- Next.js-Sicherheitshinweise (offline), Lizenzprüfung aller Pakete (nur `npm audit`/`outdated` möglich).

## Was gut ist (nur Belegtes)
1. **200/200 Tests grün mit Datenbank**, Laufzeit 3,3 s; `tests/db-tenant.test.ts` (6 Tests) läuft durch.
2. **Migrationen und Schema sind deckungsgleich** (`prisma migrate diff` → „empty migration“, `migrate status` → „up to date“), Indizes auf `(tenantId, pickupAt)`, `(tenantId, status)`, `PhoneNumber.e164 unique`, `Call.providerCallId unique` – letzteres hat im Paralleltest tatsächlich die zweite Call-Zeile verhindert (1 Zeile, 1 Rejected).
3. **Anmeldung:** Magic-Link einmalig (zweite Einlösung → `INVALID_TOKEN`), 10 Min gültig; Logout löscht die Server-Sitzung (Cookie danach wertlos, `session`-Zeile weg); Code-Anforderung nach 3 Versuchen 429, Falschcodes ab dem 2. Versuch 429; Cookie `HttpOnly; SameSite=Lax`; Passwort-Sign-up/-Sign-in abgeschaltet (400); fremde `callbackURL` beim Magic-Link → 403.
4. **Cron- und Webhook-Endpunkte fail-closed:** ohne/mit falschem Secret 401, POST auf Cron 405, Webhook ohne Secret 401; zwei parallele Cron-Aufrufe liefen ohne Fehler durch (bei leerer Mandantenliste).
5. **Serienzeiten sind sommerzeitfest:** 06:30 bleibt 06:30 Berlin über DST-Beginn (05:30Z → 04:30Z) und DST-Ende, 29.02./Jahreswechsel korrekt, Feiertage (Neujahr, 1. Weihnachtstag) erkannt und gemeldet.
6. **HSTS, nosniff, Referrer-Policy** sind gesetzt; Transkripte sind tatsächlich AES-verschlüsselt in der Tabelle (geprüft: `bej5G4mUXWBm…`).
7. Die **sequentielle** Konfliktprüfung der Zuweisung funktioniert zuverlässig (zweiter Versuch → „um 01:59 Uhr schon für eine andere Fahrt eingeplant“).

## Aus Kundensicht
Mein Urteil hat sich **verschärft**. In Bericht 1 habe ich angenommen, die Datenbank sei der verlässliche Teil. Jetzt weiß ich: Ein Entwickler-Befehl löscht mir den Betrieb (S1-006), die App meines Fahrers trägt meine Patientenliste im Cache durch die Stadt (S2-012), und der Kern des Verkaufsversprechens – „erkennt Stammkunden“ – funktioniert für genau die Fahrgäste nicht, die ich beim Start importiere (S2-013). Dazu doppelte Fahrten durch Webhook-Wiederholung (S2-014) und ein Alarmweg, der nach dem ersten Fahrerwechsel verstummt (S2-017). Das sind keine Feinheiten, das sind die Dinge, die ich als Disponent in der ersten Woche gemerkt hätte – und von denen mich der Datenschutzbeauftragte in der zweiten Woche hätte abholen lassen (S2-016, S3-024, S3-025).

**Kürzeste Liste bis zum Pilot (zusätzlich zu den acht Punkten aus Bericht 1):**
1. Seed/Demo-Reset nur gegen lokale DB (Hostprüfung + Rückfrage), alle `deleteMany()` mandantenbezogen.
2. Service Worker: nur App-Shell cachen, nie `/api/*` und keine Seiten mit Fahrgastdaten; `caches.delete` + Warteschlange löschen beim Logout; Scope `/fahrer`.
3. Eine zentrale Telefonnormalisierung (libphonenumber, E.164) beim **Schreiben** in Oberfläche, Import und KI; Bestandsdaten migrieren.
4. Idempotenz je `toolCallId` im Webhook, Body-Limit, JSON-Fehler → 400; Statuswechsel und Zuweisung in Transaktion mit Sperre (`UPDATE … WHERE status = alt`).
5. Eskalation je Zuweisung (rideId + driverId + Zeitpunkt), nicht je Fahrt.
6. Löschkonzept zu Ende denken: `summary`, `fromNumber`, `assistanceNotes`, Orts-Labels, Serien-Vorlagen, Notifications; `kurzfassungOhneModell` abschaffen oder verschlüsseln.
7. Ausstattungsprüfung in `fahrzeugZuweisen`; CSV-Escaping; 12-h-Grenze auch für API; Rollenprüfung zentral (Bericht 1).
8. `/live` ohne Transkripte, bevor die Demo-Nummer live geht; Playwright-Tests reparieren und in eine CI hängen, sonst bleiben sie Dekoration.

Hinweis zur Durchführung: Keine Projektdatei geändert, kein Commit (`git status` leer). Testserver beendet. Alle `PRUEF_`-Daten, die Playwright-Testfirma, Replay-Fahrten und Verifikationscodes aus der Test-DB entfernt; Schattendatenbank `pruef_shadow` gelöscht; Scratch-Ordner `pruef2/` samt Test-Skripten gelöscht; `test-results/` im Projekt (von Playwright erzeugt, gitignored) entfernt. In der Test-DB verbleiben die Seed-Daten „Muster Krankenfahrten“ (reine Testdatenbank, keine Produktion). `.next/` aus dem Build ist vorhanden (gitignored, erlaubt). Bericht 1 liegt unverändert unter /tmp/claude-0/-home-user-Dispona/32ef9668-03a4-5911-a697-52a1a353a803/scratchpad/pruefbericht-dispona-2026-10-30.md.
