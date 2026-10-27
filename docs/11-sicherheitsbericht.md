# 11 – Sicherheitsbericht (Phase 11, Stand 27.10.2026)

Prüfung des gesamten Projekts gegen `docs/08-datenschutz-sicherheit.md`, Punkt für Punkt aus der
Tabelle "Technische Pflichten im Code". Für jeden Punkt: was geprüft wurde, was dabei gefunden
und geändert wurde, und was offen bleibt. Vor dem Pilotbetrieb muss ein Fachanwalt für IT- und
Datenschutzrecht die mit **„für den Anwalt"** markierten Punkte klären (siehe Abschnitt am Ende).

## 1. Mandantentrennung

**Geprüft:** `withTenant()` (`src/lib/db.ts`) filtert `findMany`/`count`/`updateMany`/`deleteMany`
automatisch nach `tenantId`, setzt sie bei `create` automatisch, und prüft bei
`findUnique`/`update`/`delete` die Eigentümerschaft unabhängig vom `select` des Aufrufers. Der
bestehende Test deckte das nur an einem einzigen Modell (`Place`) ab.

**Geändert:** `tests/db-tenant.test.ts` erweitert um Fixtures und Prüfungen für `Passenger`,
`Vehicle`, `Driver`, `Ride` und `Call` – zwei neue Tests bestätigen „Mandant A sieht und ändert
nie Daten von Mandant B" über alle fünf Modelle hinweg, nicht nur eines.

**Status:** erledigt.

## 2. Verschlüsselung

**Geprüft:** Transkripte werden mit AES-256-GCM verschlüsselt gespeichert (`src/lib/crypto.ts`,
genutzt in `src/core/voice/anruf.ts` und `src/app/dispo/anrufe/actions.ts`). Adapter-Zugangsdaten
(`Integration.configEnc`) werden noch nirgends gelesen oder geschrieben – die Adapter-Anbindung
selbst existiert laut `docs/07-adapter.md` erst "Später", also auch keine Stelle, an der Klartext
gespeichert werden könnte.

**Geändert:** `next.config.ts` setzt jetzt `Strict-Transport-Security`,
`X-Content-Type-Options: nosniff` und `Referrer-Policy: strict-origin-when-cross-origin` auf jede
Antwort.

**Offen (für den Anwalt/Betrieb):** HTTPS selbst kommt erst mit der echten Domain in Phase 12;
HSTS wirkt erst, wenn die Seite einmal über HTTPS ausgeliefert wurde. Eine Content-Security-Policy
wurde bewusst nicht gesetzt – das bräuchte eine sorgfältige Abstimmung mit den eingebundenen
Diensten (Leaflet/OpenStreetMap-Kacheln, Google Fonts) und sollte erst beim echten Deployment in
Phase 12 passieren, nicht blind jetzt.

## 3. Zugriff / Fahrer sehen nur eigene Fahrten

**Geprüft:** `fahrerUebersichtLaden()` (`src/app/fahrer/actions.ts`) filtert strikt nach der
eigenen `driverId` und dem Zeitraum heute/morgen. Jede weitere Fahrer-Aktion
(`fahrtStatusSetzenFahrer`, `problemMelden`, `gesehenBestaetigen`, `schichtAktion`) prüft die
Eigentümerschaft der Fahrt/Schicht erneut, bevor sie etwas ändert. Es gibt keine Route, über die
ein Fahrer eine fremde Fahrt per ID aufrufen könnte.

**Status:** bereits vollständig, keine Änderung nötig.

## 4. AuditLog vollständig

**Geprüft:** Protokolliert waren bisher Status-Änderungen an Fahrten, der Abrechnungs-Export und
Einstellungsänderungen – aber **nicht** das Ansehen von Fahrgastdaten oder Anruftranskripten, und
auch nicht das Anlegen/Ändern eines Fahrgastes selbst.

**Geändert:**
- `src/app/dispo/fahrgaeste/actions.ts`: `fahrgastSpeichern` protokolliert jetzt
  `passenger.angelegt`/`passenger.geaendert`; neue Funktion `fahrgastAngesehen()` protokolliert
  `passenger.angesehen`, aufgerufen beim Öffnen eines Fahrgasten in `FahrgaesteClient.tsx`.
- `src/app/dispo/anrufe/actions.ts`: `anrufTranskriptLaden` protokolliert
  `call.transkript_angesehen`.
- Neu durch Punkt 7 dazugekommen: `passenger.export`, `passenger.geloescht`,
  `driver.geraet_abgemeldet` (Punkt 9).

**Status:** erledigt.

## 5. Logs

**Geprüft:** Alle `console.log`/`console.error`/`console.warn`-Aufrufe im Projekt durchsucht. Es
gibt nur vier, alle ausdrücklich auf Entwicklung beschränkt (`istEntwicklung`-Prüfung): der
Einmal-Code und der Anmelde-Link in `src/lib/auth.ts` (genau die Stelle, über die in dieser Phase
und allen vorherigen Phasen lokal getestet wurde), sowie die Push-/SMS-Platzhalter
(`src/core/notify/push.ts`, `src/providers/sms/index.ts`), die ohne echten Versand-Anbieter Text
und Zielnummer ins Terminal schreiben. Kein Fehlerpfad protokolliert je einen ganzen
Request-Body oder ein Fehlerobjekt mit Klardaten.

**Status:** keine Änderung nötig – die vier Entwicklungs-Logs sind beabsichtigt und bleiben so,
solange echte E-Mail-/SMS-Anbindung noch fehlt (geplant Phase 1b/5 laut `.env.example`,
tatsächlich noch offen). **Offen:** vor dem Produktivbetrieb sicherstellen, dass `NODE_ENV` dort
wirklich `production` ist, damit diese vier Stellen verstummen.

## 6. Löschfristen-Job

**Geprüft:** Es gab keinen einzigen Code-Pfad, der `audioRetentionDays` oder `dataRetentionDays`
je gelesen hätte, und keinen Cron-Job für Löschung/Bereinigung.

**Geändert:** Neu `src/core/datenschutz/loeschfristen.ts` (`loeschfristenDurchsetzen`) und
`src/app/api/cron/loeschfristen/route.ts` (CRON_SECRET-geschützt, für einen externen Scheduler
einmal nachts): löscht `Call.audioUrl` nach `audioRetentionDays`, löscht `Call.transcript` und
ganze `Ride`-Zeilen (mit `RideStatusEvent`/`Suggestion`) nach `dataRetentionDays`, löscht
`VehicleLocation`-Punkte älter als 90 Tage (fester Standard aus der Doku, keine Mandanten-
Einstellung). Jeder Lauf mit Treffern schreibt einen `AuditLog`-Eintrag. Drei Tests in
`tests/datenschutz/loeschfristen.test.ts`.

**Offen (Betrieb):** das wirkliche Löschen der Audiodatei beim Voice-Anbieter (Vapi) selbst ist
nicht Teil dieses Jobs – wir löschen nur unsere eigene Datenbank-Referenz (`audioUrl`). Ob und wie
Vapi die Aufnahme serverseitig löscht, muss separat geklärt werden (siehe Punkt „Hosting" in
`docs/08-datenschutz-sicherheit.md`).

## 7. Auskunft/Löschung eines Fahrgastes

**Geprüft:** Es gab weder eine Export- noch eine Löschfunktion für einen einzelnen Fahrgasten.

**Geändert:** Neu `src/core/passengers/loeschung.ts`:
- `fahrgastExportieren()` – alle Stammdaten, Genehmigungen, Fahrten (inkl. Adressen) und
  verknüpfte Anrufe mit entschlüsseltem Transkript als strukturiertes Objekt (Art. 15 DSGVO).
- `fahrgastAnonymisieren()` – überschreibt Name, Geburtsdatum, Telefonnummern, Krankenkasse und
  Hinweise, löscht Genehmigungen, beendet laufende Serien sofort, storniert noch nicht begonnene
  Fahrten. **Bereits erledigte Fahrten werden nicht hart gelöscht**, sondern bleiben (jetzt ohne
  erkennbare Person) stehen – `Ride.passengerId` ist nicht optional, ein hartes Löschen der
  Fahrgast-Zeile würde an bestehenden Fremdschlüsseln scheitern oder Abrechnungsunterlagen
  zerstören.

Beides als Server Actions in `src/app/dispo/fahrgaeste/actions.ts` (`fahrgastExportLaden`,
`fahrgastLoeschen`, nur ADMIN), mit UI in `FahrgaesteClient.tsx` ("Auskunft und Löschung": Export
als JSON-Download, Löschen mit Bestätigungsschritt). Drei Tests in
`tests/passengers/loeschung.test.ts`.

**Offen – für den Anwalt:** Ist „Anonymisieren statt Hartlöschen" bei erledigten/abgerechneten
Fahrten im Sinne von Art. 17 DSGVO ausreichend? Das ist eine bewusste technische Entscheidung
(Abwägung zwischen Löschpflicht und Aufbewahrungspflichten für die Abrechnung), aber keine
rechtliche.

## 8. Webhooks

**Geprüft:** Alle drei Voice-Webhook-Routen (`assistant-request`, `tools`, `events`) rufen
`voiceProvider.verifyWebhook()` als ersten Schritt auf und lehnen mit 401 ab. Alle fünf
Cron-Routen (`automodus`, `eskalation`, `planFuerMorgen`, `serienVerlaengern`, neu
`loeschfristen`) prüfen `CRON_SECRET` identisch.

**Status:** bereits vollständig, keine Änderung nötig.

## 9. Anmeldung / Sitzungsdauer / Geräte abmelden

**Geprüft:** Es gab keine `session`-Konfiguration in `src/lib/auth.ts` – better-auth lief mit der
Bibliotheks-Vorgabe für alle Rollen gleich, nicht mit den geforderten „Büro 12 Stunden, Fahrer 30
Tage". Es gab keine Möglichkeit, das Gerät eines Fahrers abzumelden.

**Geändert:**
- `src/lib/auth.ts`: `session.expiresIn` auf 30 Tage gesetzt (passt zum Fahrer-Bedarf).
- `src/proxy.ts`: setzt zusätzlich die kürzere 12-Stunden-Grenze fürs Büro durch (ADMIN/
  DISPONENT werden nach 12 Stunden Sitzungsalter zur Anmeldung zurückgeschickt, Fahrer nicht) –
  better-auth selbst kennt keine rollenabhängige Sitzungsdauer, deshalb diese zusätzliche Prüfung
  auf Anwendungsebene statt in der Bibliothek.
- `src/app/dispo/fahrer/actions.ts`: `fahrerGeraeteLaden`/`fahrerGeraetAbmelden` (direkt über
  `prisma.session`, da better-auths eigene Endpunkte nur die Sitzung des Aufrufers selbst
  verwalten, nicht die eines anderen Nutzers). UI „Geräte verwalten" in `FahrerClient.tsx`,
  jede Abmeldung protokolliert (`driver.geraet_abgemeldet`).

**Status:** erledigt.

## 10. Fahrer-App Datensparsamkeit

**Geprüft:** `fahrerUebersichtLaden()` lieferte Fahrgastname und -telefonnummer auch für bereits
`ERLEDIGT`e Fahrten weiter aus. Der Service Worker (`public/sw.js`) cachte unter einem
dauerhaften Namen ohne Tagesgrenze – Antworten (inkl. Fahrgastdaten) blieben über Tage hinweg im
Zwischenspeicher des Geräts stehen.

**Geändert:**
- `src/app/fahrer/actions.ts`: Fahrten mit Status `ERLEDIGT` liefern jetzt `firstName: "Erledigt"`,
  `lastName: ""`, `phones: []` statt der echten Daten.
- `public/sw.js`: Cache-Name trägt jetzt das Tagesdatum (`fahrer-app-JJJJ-MM-TT`), bei jeder
  Gelegenheit (Aktivierung und jeder Netzwerkzugriff) werden Caches vorheriger Tage gelöscht.

**Status:** erledigt.

## 11. Push und SMS

**Geprüft:** Alle fünf Textbausteine in `src/core/notify/texte.ts` nehmen nur Uhrzeit und
Ortsnamen entgegen, keinen Namen. Alle Aufrufstellen (Eskalation, Stornierung, Änderung,
Zuweisung) nutzen ausschließlich diese Funktionen, keine direkte Namens-Interpolation gefunden.

**Status:** bereits vollständig, keine Änderung nötig.

## 12. GPS

**Geprüft:** `gpsPositionMelden()` verlangt `gpsConsentAt` und eine laufende Schicht, bevor eine
Position gespeichert wird – das war schon vollständig. Es gab aber keine Bereinigung alter
`VehicleLocation`-Punkte.

**Geändert:** Abgedeckt durch den neuen Löschfristen-Job (Punkt 6): Punkte älter als 90 Tage
werden gelöscht, `Ride.distanceKm` (schon vorher berechnet und auf der Fahrt gespeichert) bleibt
als „nur noch km je Fahrt" erhalten.

**Status:** erledigt.

## 13. Automodus-Protokoll

**Geprüft:** `automodusEinstellungenSpeichern` verlangt weiterhin `role === "ADMIN"` und schreibt
bei jeder Änderung einen `AuditLog`-Eintrag (`src/app/dispo/einstellungen/actions.ts`). Die 5
Sicherheitsbedingungen vor jeder automatischen Disposition sind unverändert aus Phase 7 und mit
eigenen Tests abgedeckt.

**Status:** bereits vollständig, keine Änderung nötig.

## 14. `npm audit`

Ergebnis: 2 moderate Warnungen, beide zu einer veralteten `uuid`-Version tief in `exceljs`
(Excel-Export, Phase 10) – kein Fix ohne Breaking Change verfügbar, in unserem Einsatz unkritisch
(wir reichen keine fremden Eingaben durch diese `uuid`-Nutzung). Keine weiteren Funde, keine neuen
Pakete in dieser Phase hinzugekommen.

---

## Organisatorisch – nicht Code, trotzdem Pflicht vor dem Pilotbetrieb

Diese Punkte aus `docs/08-datenschutz-sicherheit.md` kann kein Code lösen:

- **AV-Verträge** mit jedem Kunden (Fahrdienst = Verantwortlicher) und mit jedem
  Unterauftragnehmer (Hosting, Datenbank, Vapi, Telefonie, Routing/OpenRouteService, E-Mail/SMS).
- **Datenschutz-Folgenabschätzung (DSFA)** und **Verzeichnis der Verarbeitungstätigkeiten** –
  noch nicht erstellt.
- **EU AI Act**: Transparenzhinweis am Anrufbeginn ist im System-Prompt vorhanden
  (`docs/04-voice-agent.md`), die rechtliche Einstufung des Systems steht noch aus.
- **GPS-Information der Fahrer**: Ein Fahrer bestätigt die Einwilligung in der App
  (`gpsConsentAt`), aber eine schriftliche Information/Vorlage für den Fahrdienst
  (Beschäftigtendatenschutz, ggf. Betriebsvereinbarung bei Betriebsrat) existiert noch nicht.
- **Hosting in der EU** und die Frage, ob/wie Vapi Audio zu Trainingszwecken nutzt – laut
  `docs/04a-vapi-notizen.md` bisher nicht zugesichert, offener Punkt aus Phase 6.
- **Backups** (täglich, verschlüsselt, 30 Tage, Wiederherstellung einmal testen) – kommt erst mit
  dem echten Hosting in Phase 12.
- **Content-Security-Policy** und echtes HTTPS – siehe Punkt 2, bewusst auf Phase 12
  verschoben (echte Domain nötig).
- **Anonymisieren vs. Hartlöschen** bei der Fahrgast-Löschung – siehe Punkt 7.

**So prüfst du diesen Bericht:** Diese Liste mit einem Fachanwalt für IT- und Datenschutzrecht
durchgehen, bevor der erste Pilot-Fahrdienst live geht.
