# Prüfbericht Dispona – 30.10.2026 – Prüfer: K. Berger

## Urteil in einem Satz
Pilotstart **nein**: Die Fahrer-App ist in Produktion nicht nutzbar (Anmelde-Link wird nie versendet), der gesamte nächtliche Alarmweg existiert nur als Terminal-Ausgabe, jeder angemeldete Fahrer kann über einen offenen Export-Endpunkt alle Fahrgastdaten des Betriebs herunterladen, die Fahrzeugzuweisung ist nicht gegen Doppelbuchung gesichert, und die KI am Telefon liefert bei Adressen Teilstring-Treffer als "sicher" aus – jeder dieser Punkte allein stoppt den Pilot.

## Zahlen
S1: 5 | S2: 11 | S3: 14 | S4: 10 | Verdachte: 9
Geprüfte Dateien: ca. 115 (alle `src/`-Quelldateien, Schema, 5 Migrationen, vercel.json, next.config.ts, 7 Spezifikationsdokumente, 12 Testdateien) | Ausgeführte Tests/Befehle: ca. 45 (lint, typecheck, kompletter Vitest-Lauf mit 200 Tests, npm audit, 8 eigene Reproduktions-Tests in Vitest, 1 Zeitzonen-Nachweis mit Node, ~30 grep/git-Auswertungen)

Umgebungsbefunde: `npm run lint` grün. `npm run typecheck` **rot** (2 Fehler, siehe S4-004). `npm test`: 158 bestanden, 3 fehlgeschlagen, 39 übersprungen – alle Fehlschläge brauchen eine Datenbank (hier nicht vorhanden). `npm audit`: 2 moderate (uuid in exceljs), deckt sich mit docs/11.

## Die drei gefährlichsten Befunde
1. **Jeder Fahrer kann die komplette Abrechnungsliste aller Fahrgäste (Name, Geburtsdatum, Krankenkasse, Adressen) herunterladen** – ein einzelner Link reicht, und als Nebenwirkung werden die Fahrten als "schon exportiert" markiert, sodass sie in der echten Abrechnung fehlen.
2. **Der Nachtbetrieb ist blind:** Alle SMS (Fahrer bestätigt nicht, kein Fahrzeug gefunden, Alarm an den Inhaber) landen als Textzeile im Server-Protokoll, nie auf einem Handy. Gleichzeitig kann sich in Produktion kein Fahrer in die App einloggen, weil der Anmelde-Link nirgends versendet wird.
3. **Die KI bringt Patienten zur falschen Adresse:** Sagt ein Anrufer "Hauptstraße 1", liefert das System einen gespeicherten Ort "Hauptstraße 12" als *sichere* Adresse zurück, ohne dass die KI sie vorliest. Dazu kann das System dasselbe Fahrzeug zwei überlappenden Fahrten zuweisen, wenn zwei Zuweisungen gleichzeitig laufen (Cron + Disponent).

---

## Befunde (sortiert nach Schwere)

### [S1-001] Abrechnungs-Export ohne Rollenprüfung: jeder Fahrer lädt alle Fahrgastdaten des Mandanten und sabotiert die Abrechnung
Fundort: `src/app/api/export/abrechnung/route.ts:19` (nur `requireSession()`, keine Rollenprüfung); `src/proxy.ts:53-55` (Matcher deckt `/api/*` nicht ab)
Beweis:
```ts
// route.ts:19
const { tenantId, userId } = await requireSession();   // role wird nicht einmal gelesen
...
include: { passenger: true, ... }                        // Name, Geburtsdatum, Krankenkasse, Adressen
...
await db.ride.updateMany({ ... data: { exportedAt: new Date() } });  // Nebenwirkung vor dem Download
```
```ts
// proxy.ts:54
matcher: ["/", "/anmeldung", "/dispo/:path*", "/einrichtung/:path*", "/fahrer/:path*"],
```
Ein angemeldeter FAHRER ruft `GET /api/export/abrechnung?von=2026-01-01&bis=2026-12-31&format=xlsx` auf und erhält die Excel-Datei. Ohne Anmeldung wirft `requireSession()` → unbehandelter Fehler → HTTP 500 statt 401.
Ursache: Rollenprüfung ist nirgends zentral verankert; `requireSession()` liefert die Rolle nur zurück, prüft sie nicht. `src/proxy.ts` ist die einzige Rollen-Instanz und schützt nur Seiten, keine API-Routen.
Ausbreitung: Dasselbe Muster bei allen Server Actions in `src/app/dispo/**/actions.ts` (siehe S2-001). Von 13 exportierten Funktionen in `dispo/fahrten/actions.ts` prüft keine die Rolle; projektweit gibt es nur 6 Rollenprüfungen (alle `role !== "ADMIN"`), keine einzige `role !== "FAHRER"`.
Betriebsszenario: Fahrer F. ist am Freitag entlassen worden, Konto noch aktiv (Sitzung 30 Tage). Er lädt am Samstag die Liste aller 800 Dialyse-/Praxisfahrgäste mit Geburtsdatum und Kasse herunter – Art.-9-Daten, meldepflichtig nach Art. 33 DSGVO. Nebenbei stehen alle Fahrten als "exportiert"; die Buchhaltung exportiert am Monatsende mit Standard "nur nicht exportierte" → leere Datei, 30 Tage Umsatz fehlen bis jemand den Haken findet.
Prüfung durch: Code gelesen; Matcher mit Route verglichen; `grep -rn "role" src/app` – keine FAHRER-Sperre vorhanden. Kein Server lief, daher kein Live-Aufruf.

### [S1-002] SMS-Anbieter ist ein Terminal-Platzhalter und der Fahrer-Anmelde-Link wird in Produktion nie versendet – Nachtbetrieb ohne Alarmweg, Fahrer-App ohne Login
Fundort: `src/providers/sms/index.ts:10-20`; `src/lib/auth.ts:51-61`; `src/app/dispo/fahrer/FahrerClient.tsx:112-114`; `src/core/notify/eskalation.ts:60,76,117`
Beweis:
```ts
// sms/index.ts
async send(toE164, text) { console.log(`[Entwicklung] SMS an ${toE164}: ${text}`); return { id: `dev-${Date.now()}` }; }
export const smsProvider: SmsProvider = createConsoleSms();
```
```ts
// auth.ts:54-60
async sendMagicLink({ email, url }) {
  if (istEntwicklung) { console.log(...); return; }
  // TODO Phase 5: echten SMS-Versand über SmsProvider anschließen.
}
```
`FahrerClient.tsx:114`: "Der Anmelde-Link wurde (im Entwicklungsmodus) ins Server-Terminal geschrieben – später kommt er per SMS." `.env.example` nennt `SMS_API_KEY` als "Phase 5", `docs/12-betrieb.md` Abschnitt 4 beschreibt aber bereits "Alarme kommen per SMS".
Ursache: Phase 5 (SMS) wurde übersprungen, aber Phase 11/12 (Sicherheitsbericht, Betriebsdoku, Vercel-Deployment, Demo gegen Produktion) wurden darauf aufgebaut. Niemand hat den Platzhalter als Betriebsrisiko markiert; `eskalation.ts` zählt die "gesendeten" SMS sogar als Erfolg und legt `Notification`-Zeilen an, sodass der Alarm nie wiederholt wird.
Ausbreitung: `keinFahrzeugAlarmPruefen`, `bestaetigungenPruefen` (beide Eskalationswege), `sendMagicLink` (Fahrer-Login), Push-Fallback `push.ts:38` (loggt statt zu senden, wenn VAPID fehlt).
Betriebsszenario: Dienstag 04:50, Dialysefahrt 06:00 automatisch disponiert. Fahrer hat das Handy stumm. Nach 2 Min "SMS an Fahrer" → Terminalzeile. Nach 5 Min "SMS an Inhaber" → Terminalzeile. `Notification`-Zeile gesetzt, kein zweiter Versuch. Um 06:00 steht Frau M. mit Shunt-Arm vor der Tür, niemand kommt, niemand wurde geweckt. Und der Fahrer hätte die Fahrt ohnehin nie gesehen, weil er sich in Produktion nie anmelden konnte.
Prüfung durch: Code gelesen; `grep -rn "console.log" src` (4 Stellen); Vergleich mit docs/02, docs/05, docs/12.

### [S1-003] `ort_suchen` liefert Teilstring-Treffer als "sichere" Adresse – Patient wird an der falschen Hausnummer oder im falschen Ort abgeholt
Fundort: `src/core/voice/werkzeuge.ts:103-110`
Beweis (eigener Vitest-Lauf mit gemockter Datenbank, Mandant hat einen Ort "Wohnung Schulz, Hauptstraße 12, 52062 Aachen"):
```
Anrufer-Text "Hauptstraße 1"  → "Bekannter Ort: Wohnung Schulz, Hauptstraße 12, 52062 Aachen (placeId p-schulz, sicher)."  Geocoder nicht aufgerufen.
Anrufer-Text "Aachen"         → "Bekannter Ort: Wohnung Schulz, Hauptstraße 12, 52062 Aachen (placeId p-schulz, sicher)."
```
Code: `p.street.toLowerCase().includes(niedrig) || p.city.toLowerCase().includes(niedrig)` – jeder Ortsname, jede Straße-ohne-vollständige-Hausnummer, jeder Städtename trifft irgendeinen Bestandsort. `bekannt.find(...)` nimmt den ersten Treffer aus `findMany({ take: 300 })` ohne Sortierung (nicht deterministisch).
Ursache: Fehlendes Konzept für Adress-Matching (kein Vergleich auf Straße **und** Hausnummer **und** PLZ, kein Ähnlichkeitsmaß für Straßennamen). Der Prompt (`voicePrompt.ts:26`) weist die KI an, nur bei "nicht sicher" vorzulesen – genau das wird hier ausgehebelt.
Ausbreitung: Gleiche Datei: `fahrgastSuchen` (Levenshtein ≤ 2 auf 5–8 Zeichen: "Schmidt" = "Schmitz" = "Schmitt"), vgl. S2-006 Limit 300.
Betriebsszenario: Montag 05:40, Stammkundin Hauptstraße 12 im Bestand. Herr K. (Hauptstraße 1, 1,2 km entfernt) bestellt per KI für 07:00. KI sagt "Hauptstraße 1" → System: Hauptstraße 12, sicher. Fahrer steht um 07:00 bei Frau Schulz, Herr K. verpasst die Dialyse.
Prüfung durch: Reproduktions-Test (2 Fälle, beide bestanden = Fehler bestätigt), Code gelesen.

### [S1-004] Fahrzeugzuweisung prüft Konflikte ohne Sperre/Transaktion – gleichzeitige Zuweisungen buchen dasselbe Fahrzeug doppelt
Fundort: `src/core/disposition/zuweisen.ts:52-103` (findMany → … → update, dazwischen 1 weiterer await); projektweit **kein** `$transaction`, kein `FOR UPDATE`, kein Advisory-Lock (`grep -rn '\$transaction\|FOR UPDATE\|pg_advisory' src` → nur im generierten Prisma-Client)
Beweis (eigener Vitest-Lauf mit simuliertem, sperrenlosem Datenbestand: Lesen liefert aktuellen Stand, Schreiben wirkt sofort – entspricht Postgres READ COMMITTED ohne Transaktion):
```
gleichzeitig:   Promise.all([zuweisen(A, V1), zuweisen(B, V1)]) → ['fulfilled','fulfilled'], Fahrzeug je Fahrt: V1 V1
nacheinander:   zuweisen(A, V1); zuweisen(B, V1) → FahrzeugKonfliktError "schon für eine andere Fahrt eingeplant"
```
Der Konfliktcheck funktioniert sequentiell korrekt; es fehlt ausschließlich die Serialisierung.
Ursache: Check-then-act ohne Datenbanksperre; es gibt keinen Unique-Index oder Constraint, der eine Überlappung auf Datenbankebene verhindert.
Ausbreitung: Vier Aufrufer laufen parallel in Produktion: Cron `automodus` (jede Minute), Cron `planFuerMorgen` (jede Minute, Flag `planFuerMorgenLauf` wird erst **nach** dem Lauf gesetzt → zwei Läufe bei >60 s), Cron `demoBetrieb`, Disponent-Klick. `vorschlagSpeichern.ts` liest den Tagesplan ebenfalls ohne Sperre. Gleiches Muster in `status.ts:52-92` (Statusübergang lesen → prüfen → schreiben) und `anruf.ts:15-26` (findFirst → create ohne Unique-Fallback-Behandlung).
Betriebsszenario: 18:00 startet "Plan für morgen" (viele ORS-Aufrufe, > 60 s), um 18:01 startet der nächste Cron-Lauf parallel; zusätzlich disponiert der Automodus im Minutentakt. Fahrzeug 3 bekommt 06:30 Dialyse Müller und 06:40 Dialyse Yilmaz (12 km entfernt). Der Fahrer sieht morgens zwei Fahrten, eine davon fällt aus.
Prüfung durch: Reproduktion per Simulation (kein echter Postgres verfügbar – im Bericht als Simulation markiert); Code vollständig gelesen; grep nach Transaktionen.

### [S1-005] Rückfahrt wird stillschweigend verworfen, wenn keine Rückfahrtzeit angegeben ist – kein Hinweis an KI, Anrufer oder Disponent
Fundort: `src/core/rides/erfassen.ts:111` (`if (daten.rueckfahrt && daten.rueckfahrtzeit)`); `src/core/rides/validation.ts:27-28` (`rueckfahrt: z.boolean(), rueckfahrtzeit: z.string().optional()` – Kombination nicht geprüft); `src/providers/voice/vapi.ts:84-85` (Rückfahrtzeit für die KI optional)
Beweis (eigener Vitest-Lauf, gemockte DB): Eingabe `rueckfahrt: true, rueckfahrtzeit: ""` → `{"rideId":"r1","probleme":[]}`, angelegte Fahrten: 1, `rueckfahrtRideId: undefined`. Die KI meldet dem Anrufer "Fahrt erfasst."
Ursache: Validierung kennt das Fachkonzept "Rückfahrt auf Abruf / Zeit unbekannt" nicht (docs/01-produkt.md Z. 48 fordert "Rückfahrt ja/nein (+ Zeit)", der Fall "ja, Zeit offen" ist nicht modelliert). Statt abzulehnen oder ein Problem zu setzen, wird der Wunsch gelöscht.
Ausbreitung: `serie.ts:104-114` speichert `rueckfahrtzeit ?? ""` in die Serien-Vorlage → bei Dialyse-Serien mit "Rückfahrt ja, Zeit offen" fehlt die Rückfahrt für **jeden** Termin der Serie.
Betriebsszenario: Dialysepatient bestellt Serie Mo/Mi/Fr 06:30 "mit Rückfahrt, wann ich fertig bin, weiß ich nie genau". KI: "Serie angelegt, 6 Fahrten erzeugt." Drei Wochen lang sitzt er nach der Dialyse im Wartebereich und ruft an – jede Rückfahrt wird zur Notbestellung.
Prüfung durch: Reproduktions-Test; Code gelesen; Prompt-Vorlage gegen Tool-Schema verglichen.

### [S2-001] Server Actions der Disposition ohne Rollenprüfung – ein Fahrer kann Fahrten aller Fahrgäste lesen, stornieren und Fahrzeuge zuweisen
Fundort: `src/app/dispo/fahrten/actions.ts` (13 Exporte, 0 Rollenprüfungen), ebenso `dispo/fahrgaeste/actions.ts` (nur Export/Löschen ADMIN), `dispo/fahrer/actions.ts`, `dispo/fahrzeuge/actions.ts`, `dispo/orte/actions.ts`, `dispo/anrufe/actions.ts` (Transkripte!), `dispo/auswertung/actions.ts`
Beweis: `grep -rn "role" src/app` → Rollenprüfungen nur in 5 Funktionen, alle `!== "ADMIN"`. Keine Funktion sperrt FAHRER. Die Next.js-Dokumentation im Projekt (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`): "Treat Server Actions with the same security considerations as public-facing API endpoints, and verify if the user is allowed to perform a mutation." `src/proxy.ts` leitet FAHRER nur von `/dispo`-**Seiten** weg; eine Server Action wird per POST mit `Next-Action`-Header an jede Route gesendet, auch `/fahrer`. Die Action-IDs stehen in den öffentlich abrufbaren Client-Chunks unter `/_next/static/` (Build-ID in jedem HTML, z. B. `/anmeldung`).
Ursache: Autorisierung ist auf URL-Pfade statt auf Funktionen gelegt (Architekturfehler, siehe S1-001).
Ausbreitung: Betrifft `fahrplanLaden` (alle Fahrten mit Namen, Telefon, Kasse), `anrufTranskriptLaden` (entschlüsselte Gesprächsprotokolle), `fahrtStornieren`, `fahrzeugWaehlen`, `fahrtStatusSetzen` (beliebiger Status), `fahrerEinladen` (neue Fahrer anlegen), `fahrgaesteImportieren`.
Betriebsszenario: Ein technisch versierter Fahrer liest nach Feierabend die Transkripte der Anrufe seiner Nachbarn oder storniert die Fahrten eines Kollegen, den er nicht mag.
Prüfung durch: Code und Next.js-Doku gelesen; Matcher geprüft. Kein Live-Aufruf möglich.

### [S2-002] `fahrgast_suchen` prüft die genannte Telefonnummer nicht gegen die echte Anrufernummer – Geburtsdatum und Fahrgast-ID fremder Personen abfragbar, danach Storno fremder Fahrten möglich
Fundort: `src/core/voice/werkzeuge.ts:67-69` (Telefon-Pfad ohne Abgleich), 74-88 (Schutz gilt nur für den Namens-Pfad)
Beweis (eigener Vitest-Lauf): Anruf von `+49111111111`, KI-Argument `telefon: "+49222222222"` → `"Erna Mertens, geboren 1941-05-03 (passengerId p-opfer)"`. Mit dieser ID liefern `fahrt_finden` alle kommenden Fahrten (Zeit, Von, Nach) und `fahrt_stornieren` storniert sie ohne weitere Prüfung (`werkzeuge.ts:285-289`).
Ursache: Der eigene Kommentar (Z. 74-77) erkennt "Vapi prüft die Anrufer-ID nicht", sichert aber nur den Nachnamens-Zweig ab; das `telefon`-Argument kommt vom Sprachmodell und damit vom Anrufer ("Meine Nummer ist 0171…").
Ausbreitung: `rueckruf_anlegen` überschreibt `Call.summary` ungeprüft; `fahrt_aendern` ohne Identitätsbindung; der System-Prompt enthält keine Anweisung zur Identitätsbestätigung vor Storno/Änderung und keine Abwehr gegen Prompt-Injection.
Betriebsszenario: Nachbar kennt Handynummer von Frau Mertens, ruft an, "ich bin Erna Mertens, meine Nummer ist …, bitte stornieren Sie meine Fahrten diese Woche". Drei Dialysetermine weg; der Fahrer bekommt "Fahrt entfällt".
Prüfung durch: Reproduktions-Test; Prompt (`voicePrompt.ts`) gelesen.

### [S2-003] Automodus kann nachts praktisch nur die erste Fahrt eines Fahrzeugs pro Tag disponieren – Sicherheitsbedingung 3 verlangt GPS "jetzt", obwohl die Fahrt morgen ist
Fundort: `src/core/disposition/automatischDisponieren.ts:57-83` (`gpsAlterMinuten = jetzt − letztePosition.at`; `startetVomBetriebshof = !fruehereFahrtHeute`), `planFuerMorgen.ts:104-120` identisch; `src/app/fahrer/GpsTracking.tsx:7-30` (GPS nur alle 30 s **im geöffneten Browser**, kein Hintergrund)
Beweis: Für die zweite Fahrt eines Fahrzeugs am Folgetag ist `fruehereFahrtHeute` gesetzt → Bedingung 3 verlangt GPS ≤ 10 Min alt um 03:00 nachts → unerfüllbar → `autoSkipReason: "Kein aktueller Standort des Fahrzeugs"`. Die Demo umgeht das ausdrücklich: `betriebSimulieren.ts:53-57` ("sonst bleibt jede Fahrt für ein länger ruhendes Fahrzeug dauerhaft beim Automodus hängen") und schreibt künstliche GPS-Zeilen alle 5 Minuten.
Ursache: Bedingung aus docs/05 ist für Sofort-Disposition gedacht, wurde aber unverändert auf Vorausplanung angewandt; GPS-Erfassung existiert nur bei offenem Browser-Tab (kein Background-Geolocation in PWAs).
Ausbreitung: Betrifft Automodus und "Plan für morgen" gleichermaßen.
Betriebsszenario: 14 Fahrzeuge, 90 Fahrten morgen. Nach der Nacht sind 14 Fahrten disponiert, 76 stehen in "Braucht Sie". Das Versprechen "plant eindeutige Fälle nachts selbst" ist nicht eingelöst – der Disponent um 6 Uhr hat denselben Berg wie ohne System.
Prüfung durch: Code gelesen, Demo-Kommentar als Bestätigung.

### [S2-004] Nachtschichten (z. B. 22:00–06:00) lassen sich nicht abbilden – Schichtende liegt vor Schichtbeginn, nachts wird nie ein Fahrzeug gefunden
Fundort: `src/app/dispo/fahrer/actions.ts:78-79` (`start = mitUhrzeit(tag, start); end = mitUhrzeit(tag, end)` – gleicher Tag); `src/core/drivers/validation.ts:25-31` (kein Vergleich start < end)
Beweis (eigener Vitest-Lauf): Muster 22:00–06:00 am 03.11.2026 → `start 2026-11-03T21:00Z, end 2026-11-03T05:00Z`; `findeAktiveSchicht(...)` um 02:00 → `undefined`.
Ursache: Fehlendes Konzept "Schicht über Mitternacht" in Datenmodell und Eingabe.
Ausbreitung: Alle Kandidatenfilter (`vorschlagen.ts:76-80`), `zuweisen.ts:76-79` (Fahrerzuordnung → `driverId: null` → kein Push), Automodus-Bedingung 4.
Betriebsszenario: Krankenfahrdienst mit Nachtbereitschaft; 23:30 Entlassung aus der Klinik. Für jede Fahrt: "KEIN_FAHRZEUG". Der Automodus, der genau nachts arbeiten soll, hat nachts nie ein Fahrzeug.
Prüfung durch: Reproduktions-Test, Formular (`FahrerClient.tsx`) ohne Validierung geprüft.

### [S2-005] Serienfahrten können weder beendet noch geändert werden – Dialyseserie läuft nach Umzug, Zentrumswechsel oder Tod weiter
Fundort: `grep -rn "rideSeries\|seriesId" src/app` → einzige Stelle `api/export/abrechnung/route.ts:78`. Kein Werkzeug für die KI (`vapi.ts` WERKZEUGE), keine Server Action, keine UI. Einzige Beendigung: `passengers/loeschung.ts:76` (Fahrgast löschen).
Beweis: `serie.ts:143-157` `serienVerlaengern` erzeugt täglich 01:00 für jede Serie mit `until ≥ heute` neue Fahrten im 14-Tage-Horizont. `fahrt_finden` liefert max. 5 Fahrten (`take: 5`), `fahrt_stornieren` je eine.
Ursache: Fehlende Fachlogik (Serie beenden/pausieren/ändern) – in docs/05 "Vorausplanung" nicht spezifiziert.
Betriebsszenario: Patient wechselt das Dialysezentrum. Disponent storniert 6 sichtbare Fahrten; nachts entstehen neue. Drei Wochen lang fährt jeden zweiten Tag ein Fahrzeug zur alten Adresse, bis jemand den Fahrgast "löscht" (und damit die Abrechnungshistorie anonymisiert).
Prüfung durch: grep über `src/app`, Tool-Liste in `vapi.ts`, `serie.ts` gelesen.

### [S2-006] Fahrgast- und Ortssuche liest nur die ersten 200/300 Zeilen ohne Sortierung – ab mittelgroßem Betrieb werden Stammkunden nicht gefunden und doppelt angelegt
Fundort: `src/core/voice/werkzeuge.ts:71` (`db.passenger.findMany({ take: 300 })`), `:103` (`db.place.findMany({ take: 300 })`), `src/app/dispo/fahrten/actions.ts:379` (`take: 200`)
Beweis: Keine `orderBy`, kein `where` auf den Namen → Postgres liefert beliebige 300 Zeilen; `ortSuchen` legt für jede unbekannte Adresse einen neuen `Place` an (`werkzeuge.ts:118`), die Tabelle wächst mit jedem Anruf. Ein Betrieb mit 14 Fahrzeugen hat typisch 600–1.000 aktive Fahrgäste und nach wenigen Wochen >300 Orte.
Ursache: Prototyp-Suche im Speicher statt Datenbanksuche (vorhandener Index `Passenger(tenantId, lastName)` wird nicht genutzt).
Betriebsszenario: Frau Yilmaz (Zeile 412) ruft von der Festnetznummer ihrer Tochter an. Suche findet sie nicht → KI legt "Ayse Yilmaz" neu an, ohne Geburtsdatum, ohne Genehmigung → GENEHMIGUNG_FEHLT, Dublette in der Abrechnung, Kasse weist zurück.
Prüfung durch: Code gelesen.

### [S2-007] Geocoding ohne regionalen Bezug – "Hauptstraße 12" wird irgendwo in Deutschland gefunden und als "sicher" bewertet
Fundort: `src/core/voice/werkzeuge.ts:112` (`routingProvider.geocode(text)` ohne `near`), `src/providers/routing/openRouteService.ts:57-63` (`near`-Parameter wäre vorhanden); gleiches in `dispo/fahrten/actions.ts:396` und `einrichtung/[schritt]/actions.ts:47`
Beweis: `confidence ≥ 0.8` wird als "sicher" gewertet; ORS liefert für eine eindeutige "Hauptstraße 12, Musterstadt" hohe Konfidenz, auch wenn es die falsche von 3.000 Hauptstraßen ist. `AUSSERHALB_EINSATZGEBIET` fängt nur Treffer außerhalb des Radius (Standard 30 km) ab – die Nachbarstadt nicht.
Ursache: `serviceAreaCenter` aus `TenantSettings` wird nicht an den Geocoder gereicht.
Betriebsszenario: Anruferin aus Baesweiler nennt "Kirchstraße 5". Geocoder: Kirchstraße 5, Alsdorf (8 km, im Einsatzgebiet, Konfidenz 0,9) → sicher → Fahrer in Alsdorf.
Prüfung durch: Code gelesen (3 Aufrufstellen).

### [S2-008] `withTenant()` prüft Fremdschlüssel nicht – Fahrten können mit Fahrgast/Ort eines anderen Mandanten angelegt werden, Prüfungen laufen dann ins Leere
Fundort: `src/lib/db.ts:64-67` (`create` setzt nur `tenantId`); `src/core/rides/erfassen.ts:44-66` (`fahrgast?.approvals ?? []`, `pickupOrt ? … : null` – fehlende Treffer führen nicht zum Abbruch); `src/core/voice/werkzeuge.ts:38` (`passengerId` vom Sprachmodell wird ungeprüft übernommen)
Beweis (eigener Vitest-Lauf, `findUnique` liefert wie bei fremdem Mandanten `null`): Fahrt wird angelegt mit `passengerId: "fahrgast-von-B", pickupPlaceId: "ort-von-B"`, `probleme: []` – Einsatzgebiets- und Genehmigungsprüfung stillschweigend übersprungen.
Ursache: Mandantentrennung nur auf der Zieltabelle, nicht auf referenzierten Zeilen; Aufrufer behandeln "nicht gefunden" als "keine Zusatzdaten" statt als Fehler.
Ausbreitung: `schichtMusterAnlegen` (`driverId`, `vehicleId` ungeprüft), `genehmigungSpeichern(passengerId)`, `pushAboSpeichern`-Upsert `update: { driverId }`, nested `include` liest fremde Zeilen anschließend mit (Mandant A sieht Namen von B in seiner Fahrtliste).
Betriebsszenario: Vorbedingung ist das Kennen einer fremden ID (cuid, nicht erratbar) – aber ein halluzinierter oder aus dem Kontext eines früheren Gesprächs wiederverwendeter `passengerId` der KI reicht, damit eine Fahrt an einem Fahrgast hängt, der nicht existiert oder zu B gehört.
Prüfung durch: Reproduktions-Test; `db.ts` vollständig gelesen.

### [S2-009] Telefonnummern und Abholadressen landen in Produktion im Server-Protokoll – entgegen Projektregel und Sicherheitsbericht
Fundort: `src/providers/sms/index.ts:14` (`console.log(\`[Entwicklung] SMS an ${toE164}: ${text}\`)` – **ohne** `istEntwicklung`-Prüfung); `src/core/notify/push.ts:38` (loggt `nachricht.body` mit Ortsangaben, wenn VAPID fehlt)
Beweis: Text aus `texte.ts:11-13` enthält `kurzOrt(pickupPlace.label)` – bei Orten vom Typ WOHNUNG oder geocodierten Labels die **Wohnadresse des Fahrgasts** ("Neue Fahrt 06:30 Hauptstraße 12 → Dialysezentrum"). Zusammen mit der Fahrer-Handynummer in Vercel-Logs (Standardaufbewahrung, US-Infrastruktur). `docs/11-sicherheitsbericht.md` Punkt 5 behauptet, alle vier Logs seien "ausdrücklich auf Entwicklung beschränkt (istEntwicklung-Prüfung)" – für zwei der vier stimmt das nicht.
Ursache: Platzhalter ohne Umgebungsschutz; Sicherheitsbericht ohne Nachprüfung geschrieben.
Betriebsszenario: Jede Eskalation (jede Fahrt, die nicht in 2 Min bestätigt wird – also fast jede) schreibt Adresse + Rufnummer ins Log. Nach einem Monat liegt der halbe Fahrgaststamm in Vercel.
Prüfung durch: `grep -rn console src`, Code gelesen, Doku verglichen.

### [S2-010] Nächtliche Automatik ohne Fehlererkennung: ein fehlerhafter Datensatz stoppt die Disposition des ganzen Mandanten, niemand erfährt es
Fundort: `src/core/disposition/automatischDisponieren.ts:96-104` (`if (!(fehler instanceof FahrzeugKonfliktError)) throw fehler;` – bricht die Schleife über alle Fahrten ab); `src/app/api/cron/automodus/route.ts:17` (`Promise.all` über Mandanten → ein Fehler → HTTP 500 für alle); kein try/catch, kein Lauf-Protokoll, kein "letzter erfolgreicher Lauf"-Zeitstempel; Alarmierung nur über Sentry, das laut `docs/12` noch nicht eingerichtet ist
Beweis: `fahrzeugZuweisen` → `fahrtStatusAendern` wirft z. B. "Übergang von STORNIERT nach DISPONIERT ist nicht erlaubt", wenn der Anrufer die Fahrt zwischen Vorschlag und Automodus-Lauf storniert hat (Suggestion bleibt `OFFEN`, Fahrt wird aber nicht mehr als VORGESCHLAGEN geladen – hier konkret unkritisch), oder jeder Prisma-/Netzwerkfehler. Jede Minute dieselbe Exception, alle folgenden Fahrten im `orderBy pickupAt` bleiben liegen.
Ursache: Keine Fehlerisolierung pro Fahrt, keine Überwachung "Cron hat seit X Minuten nicht erfolgreich gelaufen", keine Sperre gegen parallele Läufe.
Betriebsszenario: 23:10 Datenbankverbindung kurz weg → Exception bei Fahrt 3 von 40. Bis 06:00 wiederholt sich das Bild oder die Reihenfolge blockiert dauerhaft an derselben Fahrt. Morgens: 37 Fahrten "Vorgeschlagen", kein Alarm, weil kein SMS-Anbieter (S1-002) und kein Sentry.
Prüfung durch: Code gelesen (alle 8 Cron-Routen).

### [S2-011] Rufnummer-zu-Mandant-Zuordnung ist frei wählbar und öffentlich registrierbar – fremde Anrufe können bei einem anderen Mandanten landen
Fundort: `src/app/einrichtung/[schritt]/actions.ts:93-105` (`kiNummerSpeichern` speichert jede Zeichenkette als `e164`, ohne Besitzprüfung); `src/app/(auth)/registrieren/actions.ts:23-69` (öffentliche Registrierung ohne E-Mail-Bestätigung, Captcha oder Ratenbegrenzung, `emailVerified: true`); `src/core/voice/mandant.ts:23-26` (Zuordnung ausschließlich über `PhoneNumber.e164`)
Beweis: Wer die (bei Vapi importierte) Nummer eines Kunden kennt und sie vor ihm in seinem – frei angelegten – Mandanten einträgt, erhält dessen Anrufe inklusive Fahrgastdaten (`@unique` schützt nur, wenn der echte Kunde schneller war). Umgekehrt kann jeder beliebig viele Mandanten anlegen (Datenbank-Spam); Mandant und Admin-User entstehen ohne Transaktion (Z. 41 + 56).
Ursache: Fehlende Verifikation (z. B. Zuweisung der Nummer nur durch Dispona-Betreiber) und fehlender Schutz der Registrierung.
Prüfung durch: Code gelesen.

### [S3-001] Zeitrechnung mit Server-Zeitzone statt Europe/Berlin an fünf Stellen – Tagesgrenzen um 1–2 Stunden falsch, an Umstellungstagen eine Stunde Tagesplan unsichtbar
Fundort: `src/core/disposition/automatischDisponieren.ts:66` (`new Date(pickupAt.getFullYear(), getMonth(), getDate())`); `vorschlagSpeichern.ts:26-27`, `planFuerMorgen.ts:27-28`, `api/export/abrechnung/route.ts:37-38`, `dispo/fahrten/actions.ts:64-65`, `dispo/fahrer/actions.ts:37-38`, `dispo/auswertung/actions.ts:13-14` (alle `setDate(+1)` auf einem Berliner-Mitternacht-Zeitpunkt)
Beweis (Node, `TZ=UTC` wie auf Vercel):
```
pickupAt 00:30 Berlin → 'Tagesanfang' laut Code = 02.11. 01:00 Berlin → Fenster 23,5 h statt 0,5 h
25.10.2026 (DST-Ende, 25-h-Tag): tagEnde laut Code = 25.10. 23:00 Berlin (erwartet 26.10. 00:00)
```
Folge 1: Sicherheitsbedingung 3 (GPS/Betriebshof) rechnet mit falschem "heute". Folge 2: Am 25.10.2026 fehlten Fahrten 23:00–24:00 im Tagesplan für Vorschlag und Plan für morgen → Doppelbelegung möglich; am 28.03.2027 (23-h-Tag) zählt die erste Stunde des Folgetags mit. Export und Dashboard zeigen an diesen Tagen eine Stunde zu wenig/zu viel.
Ursache: CLAUDE.md-Regel ("nie `new Date()` direkt mit `setHours()`/`toISOString()` mischen") nicht konsequent befolgt; `week.ts` bietet `tagVerschieben`/`berlinerMitternacht`, wird hier nicht genutzt.
Prüfung durch: Node-Skript unter TZ=UTC; grep nach `setDate(`.

### [S3-002] Prisma-Wiederholung bei Verbindungsabbruch wiederholt auch Schreibzugriffe – doppelte Fahrten/Events möglich
Fundort: `src/lib/prisma.ts:44-62` (`$allOperations` → bis zu 3 Versuche bei ECONNRESET/ETIMEDOUT/"Connection terminated")
Beweis: Ein `ride.create`, dessen Commit die Datenbank erreicht hat, bevor die Verbindung beim Antwortlesen abreißt, wird erneut gesendet → zweite Zeile. Keine Idempotenz-Schlüssel, keine Beschränkung auf Lesezugriffe.
Betriebsszenario: Neon-Verbindungsabbruch während `fahrt_anlegen` → zwei identische Fahrten, Disponent wundert sich über "DOPPELBUCHUNG"-Hinweis, oder zwei Fahrzeuge fahren hin.
Prüfung durch: Code gelesen (als Logikfehler sicher, Häufigkeit in Produktion nicht messbar).

### [S3-003] Zwei Geocoding-Endpunkte ohne Anmeldung – fremde Nutzung des ORS-Kontingents legt die eigene Adresssuche lahm
Fundort: `src/app/dispo/fahrten/actions.ts:395-398` (`ortSuchen` ohne `requireSession`), `src/app/einrichtung/[schritt]/actions.ts:46-55` (`adresseSuchen` ohne Session)
Beweis: Beide sind exportierte Server Actions, die direkt `routingProvider.geocode(text)` mit dem Mandanten-übergreifenden `ORS_API_KEY` aufrufen; ORS-Freikontingent ist begrenzt (Rate-Limit 429 → `geocode` wirft → KI erhält "OpenRouteService Geocoding-Fehler: 429").
Prüfung durch: Zählung `requireSession()` je Datei (13 Exporte/11 Prüfungen bzw. 10/5).

### [S3-004] `fahrtAendern` lässt Fahrzeug/Fahrer an der Fahrt stehen, informiert den Fahrer irreführend und prüft die geänderte Fahrt nicht neu
Fundort: `src/core/rides/aendern.ts:52-85`
Beweis: Status geht auf ERFASST, `vehicleId`/`driverId` bleiben gesetzt (nur `fahrzeugZuweisungAufheben` räumt auf). Push-Text "Fahrt 09:30 wurde geändert. Bitte App öffnen." – tatsächlich ist die Fahrt dem Fahrer entzogen und wird neu vorgeschlagen; der Fahrer sieht sie in der App nicht mehr (Liste filtert nicht nach Status, aber `driverId` bleibt – er sieht sie **weiterhin** mit Status "Erfasst" und ohne Handlungsknopf). `fahrtPruefen` (Einsatzgebiet, Doppelbuchung, Genehmigung) wird nach Adress-/Zeitänderung nicht erneut ausgeführt, `problems` veraltet. Datum nicht änderbar (nur Uhrzeit am selben Tag).
Prüfung durch: Code gelesen; `fahrerUebersichtLaden` Filter geprüft (`status notIn STORNIERT`).

### [S3-005] Storno einer Hinfahrt lässt die Rückfahrt stehen; KI hat kein "Fahrtenpaar"-Konzept
Fundort: `src/core/rides/stornieren.ts:11-25` (keine Behandlung von `returnOfId`), `werkzeuge.ts:285-289`
Beweis: `Ride.returnOfId` existiert, wird nur in `erfassen.ts:117` geschrieben, nirgends gelesen. "Ich sage die Dialyse morgen ab" → KI storniert eine `rideId`, die Rückfahrt bleibt → Fahrer fährt 11:30 zum Dialysezentrum, niemand da, Fehlfahrt.
Prüfung durch: grep `returnOfId` in `src`.

### [S3-006] Eskalations-SMS an den Fahrer nach 2 Minuten für **jede** Fahrt, auch nächste Woche – weicht von docs/05 ab und wird mit echtem SMS-Anbieter teuer und stumpf
Fundort: `src/core/notify/eskalation.ts:49-66` (keine Bedingung "Fahrt beginnt in < 60 Min"), docs/05-disposition.md Z. 74 ("Bestätigt der Fahrer nicht innerhalb von 5 Minuten (bei Fahrten in < 60 Min) → SMS")
Betriebsszenario: Plan für morgen um 18:00 disponiert 90 Fahrten → 18:02 gehen 90 SMS raus. Nach einer Woche ignoriert jeder Fahrer SMS – auch die echte um 05:00.
Prüfung durch: Code mit Doku verglichen.

### [S3-007] Kandidatenfilter: Live-Pause sperrt das Fahrzeug für den ganzen restlichen Tag, Schichtende wird nur zur Abholzeit geprüft, manuelle Zuweisung ignoriert Pause/Ausfall
Fundort: `src/core/disposition/kandidaten.ts:44-56` (`!s.onBreak` – Live-Flag der aktuellen Schicht, nicht Pause zur Abholzeit), `zuweisen.ts:76-79` (Schichtsuche ohne `unavailable`/`onBreak`), `vorschlagen.ts:79` (Schicht nur zu `pickupAt`, nicht bis Fahrtende)
Beweis: Disponent erfasst um 12:30 (Fahrer in Mittagspause) eine Fahrt für 15:00 → Fahrzeug fehlt in den Vorschlägen. Fahrt 21:50 bei Schichtende 22:00 wird vorgeschlagen, Fahrer käme 22:45 zurück. Drag im Zeitstrahl weist einem ausgefallenen Fahrer zu (`fahrerFaelltAus` setzt `unavailable`, `zuweisen` prüft es nicht).
Prüfung durch: Code gelesen.

### [S3-008] Abrechnungsexport: nur ERLEDIGT (keine Fehlfahrten), Markierung "exportiert" vor erfolgreichem Download, Fahrtenbuch-Vollständigkeit nicht prüfbar
Fundort: `src/app/api/export/abrechnung/route.ts:42,89-92`
Beweis: `NICHT_ANGETROFFEN` (Fehlfahrt, bei vielen Kassen abrechenbar) fehlt; `exportedAt` wird vor der Antwort gesetzt – bricht der Download ab (Vercel-Timeout bei großem Monat), sind die Fahrten weg aus dem Standardexport. Kein Abgleich Fahrtenbuch ↔ Datenbank (keine laufende Nummer, kein Export-Protokoll außer einer AuditLog-Zeile mit Zeitraum).
Prüfung durch: Code gelesen.

### [S3-009] Offline-Warteschlange der Fahrer-App verwirft fehlgeschlagene Meldungen stillschweigend
Fundort: `src/app/fahrer/OfflineSync.tsx:47-53` (`catch { if (navigator.onLine) warteschlangeEntfernen(eintrag.id); }`)
Beweis: Ein vorübergehender Serverfehler (500, Datenbank kurz weg) beim Nachsenden von "Fahrgast im Auto" löscht die Meldung ohne Hinweis. Status bleibt UNTERWEGS, `AN_BORD`-Zeitpunkt fehlt → `distanceKm` wird geschätzt statt aus GPS gerechnet (`status.ts:69-82`), Abrechnungs-km falsch.
Prüfung durch: Code gelesen.

### [S3-010] Disponent kann KI-Fehler nicht in 30 Sekunden korrigieren – keine Bearbeitung von Adresse, Transportart, Datum oder Unterlagen in der Oberfläche
Fundort: `src/app/dispo/fahrten/TripModal.tsx` (nur Status, Fahrzeug, Storno), `DispoClient.tsx` (nur Anlegen); `fahrtAendern` wird aus der Oberfläche nicht aufgerufen (grep)
Beweis: Falsche Adresse der KI → Storno (Push "Fahrt entfällt" an den Fahrer) + komplette Neuerfassung (Push "Neue Fahrt"). Zwei irritierende Pushs für eine Korrektur.
Prüfung durch: grep über Client-Komponenten.

### [S3-011] "Plan für morgen": Laufmarkierung wird erst nach dem Lauf gesetzt, Cron im Minutentakt – zweiter paralleler Lauf erzeugt doppelte Vorschläge und konkurrierende Zuweisungen
Fundort: `src/app/api/cron/planFuerMorgen/route.ts:36-40`; `planFuerMorgen.ts:85-99` (legt für jede VORGESCHLAGENE Fahrt eine weitere `Suggestion` an)
Beweis: Lauf mit 90 Fahrten × bis zu 5 Routing-Aufrufen je Kandidat dauert erkennbar >60 s (der Entwickler hat `maxDuration = 60` nur für `demoBetrieb` gesetzt); der nächste Minutenlauf sieht `planFuerMorgenLauf` noch unverändert.
Prüfung durch: Code gelesen; vgl. S1-004.

### [S3-012] Gesprächszusammenfassung und Anrufernummer bleiben unverschlüsselt und unbefristet; Transkript geht zusätzlich an einen US-Anbieter, der in der Unterauftragnehmer-Liste fehlt
Fundort: `src/core/voice/anruf.ts:46` (`summary` Klartext), `werkzeuge.ts:331` (`summary` = "Rückruf erbeten: <Telefon> – <Anliegen>"), `src/core/datenschutz/loeschfristen.ts:30-33` (löscht nur `transcript`, nicht `summary`/`fromNumber`), `src/core/notify/anrufZusammenfassung.ts:24-31` (Transkript an Anthropic-API), `vapi.ts:225-234` (OpenAI gpt-4o, Deepgram)
Beweis: Die Zusammenfassung soll laut Prompt "Fahrgast, worum es ging, Ergebnis" enthalten – gesundheitsnah und personenbezogen. docs/08 nennt als Unterauftragnehmer "Voice-Anbieter, Telefonie, Routing, E-Mail/SMS", nicht die Zusammenfassungs-KI. docs/04a dokumentiert die EU-Lücke bei Vapi als offen.
Prüfung durch: Code und Doku gelesen.

### [S3-013] Konfiguration/Deployment: `prisma migrate deploy` im Build-Schritt, keine Umgebungstrennung erkennbar, Demo-Mandant mit zwei Minuten-Crons läuft in der Produktionsdatenbank
Fundort: `package.json` ("build": "prisma migrate deploy && next build"); `vercel.json` (8 Crons, 4 davon `* * * * *`, darunter `demoBetrieb`); Commit `027a5e1` ("seedDemoTenant() bereits gegen Produktion gelaufen"); `src/core/demo/aufraeumen.ts:16` (`demoZuruecksetzen(tenantId = DEMO_TENANT_ID)` – Parameter mit Default, Hard-Delete von Fahrten)
Beweis: Jeder Build (auch Preview-Branches, falls `DATABASE_URL` dort gleich ist) migriert die Datenbank, bevor der neue Code live ist; ein fehlgeschlagener Build hinterlässt Schema ≠ Code. Demo-Simulation und Produktion teilen Datenbank, Verbindungs-Pool, ORS-Kontingent und Cron-Zeitfenster; `demoZuruecksetzen` ist nur durch die Default-Konstante vom Hard-Delete echter Mandanten getrennt.
Prüfung durch: Dateien gelesen, Git-Log.

### [S3-014] Doppelbuchungsprüfung bei der Zuweisung berücksichtigt keine Anfahrt zwischen zwei Fahrten
Fundort: `src/core/disposition/zuweisen.ts:66-69` (nur Zeitüberlappung `pickupAt < andereEnde && andere.pickupAt < eigenesEnde`)
Beweis: Fahrt A endet 08:30 in Köln-Süd, Fahrt B beginnt 08:35 in Köln-Nord (25 km) → kein Konflikt → Zuweisung erlaubt (manuell, per Drag, oder als Ausweichkandidat im Automodus). Die Vorschlagsrechnung (`passtRein`) kennt die Anfahrt, die finale Prüfung nicht. Die Demo hat sich dafür eine eigene, bessere Prüfung gebaut (`betriebSimulieren.ts:738-769`), die Produktion nicht.
Prüfung durch: Code gelesen.

### [S4-001] `docs/11-sicherheitsbericht.md` enthält mehrere unzutreffende Aussagen
Punkt 3 "Es gibt keine Route, über die ein Fahrer eine fremde Fahrt per ID aufrufen könnte" (widerlegt durch S1-001, S2-001); Punkt 5 "alle vier Logs auf Entwicklung beschränkt" (S2-009); Punkt 8 "drei Voice-Webhook-Routen" (es gibt eine); Punkt 1 "Test bestätigt A sieht nie B" – der Test braucht eine Datenbank und schlägt ohne fehl; Punkt 11 "nur Uhrzeit und Ortsnamen" – Ortsname kann Wohnadresse sein.

### [S4-002] `.env.example` nennt `EMAIL_SERVER` (SMTP), der Code braucht `RESEND_API_KEY` (`src/lib/email.ts:16`); `DIRECT_URL` (prisma7.config.ts) fehlt im Beispiel. Ein Inhaber ohne IT-Kenntnis scheitert hier bei der Einrichtung.

### [S4-003] `vercel.json` plant den "einmaligen" Bereinigungs-Cron `brauchtSieBereinigenEinmalig` jedes Jahr am 1. Januar 00:00; toter Code mit Zeitplan.

### [S4-004] `npm run typecheck` schlägt auf frischem Checkout fehl (`LayoutProps` fehlt, `next-env.d.ts` ist in `.gitignore` und entsteht erst durch `next dev/build`) – widerspricht der Projektregel "erst bei grün ist die Aufgabe fertig" und macht CI-Prüfung unzuverlässig.

### [S4-005] `prisma/seed.ts:87` enthält die echte private E-Mail-Adresse des Auftraggebers als Seed-Benutzer im Git.

### [S4-006] Web-Push-VAPID-Kontakt `mailto:support@fahrdienst-ki.invalid` (`push.ts:12`) – nicht erreichbare Adresse; Apple/Mozilla verlangen einen gültigen Kontakt (siehe V-007).

### [S4-007] Geheimnisvergleiche nicht zeitkonstant (`vapi.ts:202`, alle Cron-Routen `erlaubnis !== \`Bearer ${secret}\``); Vapi-Webhook per statischem Bearer-Token statt HMAC (laut docs/04a möglich) – kein Replay-Schutz.

### [S4-008] Die KI liest technische Codes vor: `fahrtAnlegenWerkzeug` gibt "Fahrt erfasst, aber mit Hinweis: GENEHMIGUNG_FEHLT, AUSSERHALB_EINSATZGEBIET" zurück; `werkzeugAusfuehren` reicht rohe Fehlermeldungen (Prisma, ORS "429") als `error` an das Sprachmodell. docs/04 verlangt "kurze, gesprochen gut verständliche Ergebnisse (keine IDs vorlesen)" – `rideId`/`passengerId`/`placeId` stehen in jedem Ergebnis.

### [S4-009] `fahrerEinladen`/`firmaRegistrieren`/`fahrtErfassen` schreiben mehrere Zeilen ohne Transaktion (User ohne Driver → "Kein Fahrer-Profil"; Ride als ENTWURF, wenn der Prozess nach `create` abbricht – ENTWURF-Fahrten tauchen im Zeitstrahl auf, sind aber nirgends als "halb" markiert).

### [S4-010] Feiertage fest auf NRW (`feiertageNrw.ts`), kein Bundesland am Mandanten; Fahrzeuge werden "gelöscht" per `active: false` ohne Prüfung laufender Schichten; `Approval.maxRides` wird nie ausgewertet.

---

## Verdachte (nicht bestätigt)

[V-001] `fahrplanFuerMandantLaden(tenantId, …)` ist aus einer `"use server"`-Datei exportiert und nimmt die Mandanten-ID vom Aufrufer – nach Next.js-Doku ein öffentlicher Endpunkt, sofern seine (verschlüsselte) Action-ID auffindbar ist. – Prüfauftrag: Nach `next build` in `.next/server/server-reference-manifest.json` prüfen, ob die Funktion registriert ist, und ob ihre ID in einem Client-Chunk unter `.next/static` vorkommt. Unabhängig vom Ergebnis: Funktion aus der Actions-Datei in ein `core/`-Modul verschieben.

[V-002] Vier Crons im Minutentakt erfordern Vercel Pro; Vercel garantiert keine Nicht-Überlappung von Cron-Aufrufen. – Prüfauftrag: Vercel-Plan und Cron-Logs auf parallele Läufe prüfen; Sperre (z. B. `pg_advisory_xact_lock` oder `Job`-Tabelle) einbauen.

[V-003] Preview-Deployments teilen sich `DATABASE_URL` mit Produktion und migrieren sie im Build. – Prüfauftrag: Vercel Environment Variables je Umgebung vergleichen.

[V-004] `Call.audioUrl` zeigt auf Vapi-Aufnahmen; diese sind nach Vapi-Doku standardmäßig öffentlich per URL abrufbar, Löschung nach `audioRetentionDays` entfernt nur unseren Verweis (`docs/11` Punkt 6 räumt das ein). – Prüfauftrag: Eine Aufnahme-URL ohne Anmeldung aufrufen; Löschung über Vapi-API prüfen.

[V-005] `serie_anlegen` legt alle Fahrten des 14-Tage-Horizonts synchron im Webhook an (je Fahrt bis zu 5 Routing-Aufrufe pro Kandidat × Fahrzeuge). Bei 14 Fahrzeugen und 12 Fahrten >500 ORS-Aufrufe (Freikontingent 40/Min) – Vapi-Werkzeug-Timeout wahrscheinlich; Fahrten sind dann angelegt, die KI meldet aber Fehler → Anrufer bestellt erneut → Doppelserie. – Prüfauftrag: Testanruf mit Serie bei ≥ 10 Fahrzeugen, Dauer messen.

[V-006] `customer.number` kommt laut docs/04a bei SIP-Import teils leer – dann scheitert die Stammkundenerkennung, und `fahrgast_suchen` verlangt Geburtsdatum; `telefonNormalisieren` erzeugt zudem für "0049 171 …" und "+49 (0) 171 …" andere Schlüssel als für "+49171…" (eigener Test: `+49049171234567`, `+490171234567`). – Prüfauftrag: Echte Rufumleitung testen; Normalisierung nach E.164 (libphonenumber) umbauen.

[V-007] VAPID-Subject `.invalid` wird von Apple Web Push / Mozilla autopush möglicherweise abgelehnt – Push auf iPhone funktioniert dann nie. – Prüfauftrag: Push auf iOS-Gerät testen.

[V-008] Stimmen "Clara/Emma/Kai" (`konstanten.ts`) und die gesamte `buildAssistantConfig` sind laut Kommentar in `vapi.ts:4-7` "noch nicht gegen einen echten Vapi-Anruf getestet". – Prüfauftrag: Ein echter Testanruf vor dem Pilot.

[V-009] Prisma-Pool `max: 15` je Serverless-Instanz plus Crons plus Demo – bei Neon-Verbindungslimit (Free/Launch) droht "too many connections" zu Stoßzeiten. – Prüfauftrag: Neon-Verbindungsmetrik unter Last beobachten; Pooler-Endpunkt prüfen.

---

## Was ich NICHT prüfen konnte
- Keine laufende Datenbank: `tests/db-tenant.test.ts`, `loeschfristen`, `demo/*` (3 fehlgeschlagene Tests, 39 übersprungene) nicht ausführbar; Race Conditions nur als Simulation reproduziert; Produktionsschema vs. Migrationen nicht vergleichbar.
- Kein Server, kein Vapi-Konto, keine Telefonnummer: Webhook-Verhalten, Timeouts, Anrufernummer-Übermittlung, Vapi-Payload-Form, Weiterleitung an `escalationNumber`.
- Vercel/Neon-Konsole: Backups (Existenz, Test der Wiederherstellung), Cron-Plan/Überlappung, Umgebungsvariablen je Umgebung, Log-Aufbewahrung, Verbindungslimits.
- Produktionsdaten, Sentry-Konto, DNS/TLS/Zertifikate, offene Ports – nicht zugänglich.
- Sprachmodell-Verhalten (Prompt-Injection, Notfall-Erkennung, "Ist das so richtig?"-Bestätigung): nicht deterministisch testbar; `tests/voice/01-20` sind manuelle Skripte für `voice:sim`, kein automatischer Test.
- Fahrer-App auf echten Geräten (iOS-Push, Hintergrund-GPS).

## Was gut ist
1. `withTenant()` (`src/lib/db.ts`) filtert Lesen/Schreiben konsequent und prüft bei `findUnique`/`update`/`delete` die Eigentümerschaft unabhängig vom `select` – ein belastbarer Kern, dem nur die Fremdschlüssel-Prüfung fehlt.
2. Transkripte werden AES-256-GCM verschlüsselt gespeichert (`crypto.ts`, `anruf.ts`); Sentry ist bewusst ohne PII, ohne Replay, ohne Bodies konfiguriert.
3. Zeitlogik in `src/core/shifts/week.ts` ist DST-sicher gebaut und getestet; die Umstellungsfehler liegen ausschließlich dort, wo diese Hilfsfunktionen umgangen werden.
4. Statusübergänge laufen zentral über `fahrtStatusAendern` mit Übergangsmatrix, Event- und Audit-Zeile; der Konfliktcheck in `fahrzeugZuweisen` ist sequentiell korrekt (im eigenen Test nachgewiesen).
5. Webhook- und Cron-Endpunkte sind "fail closed" (ohne konfiguriertes Geheimnis wird alles abgelehnt); Lint ist grün, 158 Logik-Tests laufen ohne Datenbank durch.

## Aus Kundensicht
Kaufen würde ich es heute nicht, und ich würde es auch nicht als Pilot in meinen Betrieb lassen. Nicht wegen der Oberfläche – die Dispo-Ansicht, der Zeitstrahl und die Idee "KI nimmt an, Mensch bestätigt mit einem Klick" sind genau das, was ich 6 Jahre lang vermisst habe. Sondern weil die drei Dinge, die nachts um 3 zählen, nicht da sind: Alarm aufs Handy (S1-002), ein Fahrer, der die Fahrt überhaupt sieht (S1-002), und ein Fahrzeug, das nicht doppelt vergeben wird (S1-004). Dazu zwei Punkte, die mich vor der Kasse und dem Datenschutzbeauftragten in Schwierigkeiten brächten: der offene Export (S1-001) und Adressen im Log (S2-009).

Vor einem Pilot müsste passieren: (1) SMS-Anbieter und Fahrer-Login real, mit Test auf iPhone und Android; (2) Rollenprüfung in **jeder** Server Action und API-Route, zentral; (3) Zuweisung in einer Transaktion mit Sperre, Crons mit Laufsperre und Fehlerprotokoll je Fahrt; (4) Adress-Matching auf Straße+Hausnummer+PLZ und Geocoding mit Regionsbezug; (5) Rückfahrt "Zeit offen" und Serien beenden/ändern als echte Funktionen; (6) Nachtschichten; (7) Fahrgastsuche über die Datenbank statt der ersten 300 Zeilen; (8) ein Sicherheitsbericht, dessen Aussagen nachgeprüft wurden.

Im Alltag nerven würde mich: jede Fahrt ohne "Gesehen" löst nach 2 Minuten eine SMS aus – auch die für nächste Woche; eine Korrektur der KI (falsche Adresse) heißt Storno plus Neuerfassung mit zwei verwirrenden Pushs an den Fahrer; mein Fahrer in der Mittagspause verschwindet aus den Vorschlägen für den Nachmittag; und morgens um 6 liegt trotz "Automodus" fast alles in "Braucht Sie", weil die GPS-Bedingung nachts nie erfüllbar ist.

---
Hinweis zur Durchführung: Keine Datei im Projekt wurde geändert (`git status` sauber). Eigene Reproduktions-Tests lagen ausschließlich im Scratchpad und wurden nach dem Lauf gelöscht. `npm ci` wurde einmal ausgeführt, um Lint/Typecheck/Tests/Audit laufen zu lassen.
