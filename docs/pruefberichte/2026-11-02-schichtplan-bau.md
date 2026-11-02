# Bauprotokoll Dispona – Schichtplan (Besatzung, Aushilfen, Scalamobil, Treppe) – 02.11.2026

Auftrag: Schichtplan nach freigegebenem Konzept und Bauplan, Vorgabe für Aussehen und Bedienung ist die freigegebene Vorschau `schichtplan-monat.html` (eigenständige HTML-Datei mit Beispieldaten, nicht im Repo).
Branch: `claude/schichtplan`, abgezweigt von `claude/behebung-durchgang-4b` @ `0710f6a`. Nichts nach `master` gemerged, keine anderen Branches angefasst. Ein Commit je Schritt, nach jedem Schritt gepusht.

## Ergebnis in einem Satz
Alle 6 Schritte sind gebaut, getestet und im Browser geprüft: Schichten haben jetzt Fahrer, optionalen Beifahrer und „Scalamobil an Bord“; Disposition und Automodus vergeben Liegend- und Treppenfahrten nur noch an eine passende Besatzung; die neue Seite „Schichtplan“ ersetzt das alte Schicht-Muster; die Fahrer-App zeigt „Mein Schichtplan“.

## Für den Auftraggeber (ohne Fachjargon)
Im Menü gibt es jetzt **„Schichtplan“** direkt nach „Dashboard“. Oben steht ein Monatskalender (grün = alle Fahrzeuge besetzt, hellgrün = teilweise, grau = nichts geplant) und „Heute“ (wer gerade fährt, mit Beifahrer). Darunter die Woche: Fahrzeuge als Zeilen, Montag bis Sonntag als Spalten, volle Namen. Ein Klick auf ein Feld öffnet rechts ein Fenster: Beginn, Ende, Fahrer, „+ Beifahrer hinzufügen“, „Scalamobil an Bord“ und „Gilt für“ (nur dieser Tag, Mo–Fr, jeden gleichen Wochentag, alle Werktage im Monat). Liegen in einer Schicht schon Fahrten, die durch die Änderung ihr Fahrzeug verlieren, erscheint **vor** dem Speichern ein Hinweis mit den Uhrzeiten; erst nach „Trotzdem speichern“ gehen diese Fahrten zurück in die Planung (mit dem Vermerk „Schicht geändert – neues Fahrzeug nötig“) und der Fahrer bekommt „Fahrt entzogen“. „Woche kopieren“ und „bis Monatsende wiederholen“ haben ein „Rückgängig“.
Das System achtet jetzt auf die Besatzung: Liegend-Fahrten nur zu zweit; Tragestuhl-Fahrten über eine Treppe nur zu zweit (mit Tragestuhl im Auto) oder mit Scalamobil und eingewiesenem Fahrer. Wer etwas anderes zuweisen will, bekommt eine klare Meldung, der Automodus lässt solche Fahrten liegen.
„Fahrer“ heißt jetzt **„Personal“**: Fahrer und Aushilfen einladen, Scalamobil-Einweisung abhaken, Geräte abmelden, deaktivieren. Bei „Orte“ gibt es das Häkchen „Treppe“, in den Einstellungen „Anzahl Scalamobile“. In der Fahrer-App sieht jede Person (auch Aushilfen) ihre Schichten der nächsten 4 Wochen.
**Wichtig vor dem Einsatz:** Bestehende Schichten haben keinen Beifahrer. Liegend-Fahrten werden erst wieder zugewiesen, wenn im Schichtplan ein Beifahrer eingetragen ist (offene Frage 1).

## Zahlen
Nullpunkt vor Beginn: Tests 488/488 grün (79 Dateien), Lint grün, Typecheck grün (nach `npx next typegen`).
Nach Abschluss: **Tests 557/557 grün (85 Dateien)**, also +69 Tests und 6 neue Testdateien; Lint 0 Fehler/0 Warnungen; Typecheck grün; `next build` grün. Zusätzlich `TZ=UTC npm test` 557/557 und `TZ=America/New_York` für `tests/shifts tests/fahrer tests/disposition` 229/229.
Commits: 7 (6 Schritte + dieses Protokoll). Umfang: 79 Dateien, +5175/−582 Zeilen (ohne Protokoll).
Umgebung: lokale Postgres 16, eigene Datenbank `dispona_schichtplan`, `.env` nur lokal (in `.gitignore`); 17 Migrationen angewendet, `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` → leer. Externe Dienste nicht angesprochen (kein Push-/SMS-Versand, Routing mit Ersatzrechnung).

## Was je Schritt gebaut wurde

### Schritt 1 – Datenbank (`234a280`)
- `prisma/schema.prisma`: `Driver.istAushilfe`, `Driver.scalamobilEinweisung`; `Shift.beifahrerId` (Relation `SchichtBeifahrer`, die bestehende heißt jetzt `SchichtFahrer`, Feldnamen `driver`/`shifts` unverändert) und `Shift.scalamobil`; `TenantSettings.scalamobilAnzahl`; `Place.treppe`; Index `Shift(tenantId, vehicleId, start)`.
- Migration `prisma/migrations/20261102100000_schichtplan_besatzung/migration.sql`: neue Spalten mit unschädlichen Vorgaben, Fremdschlüssel `beifahrerId` (ON DELETE SET NULL), **CHECK `Shift_beifahrer_nicht_fahrer`** und der **M-11-Trigger `Shift_mandant_referenzen` neu mit `beifahrerId`** (gleiche Funktion `dispona_mandant_referenzen_pruefen`, Fehler `FREMDE_REFERENZ`). `src/lib/db.ts`: Meldung „Beifahrer nicht gefunden.“.
- Tests: `tests/db-tenant.test.ts` (fremder Beifahrer bei create/update/rohem Client abgelehnt; Fahrer = Beifahrer in der DB abgelehnt).
- Seed: 2 Aushilfen (Ben Bauer, Lea Lange), 1 Scalamobil, Einweisung bei Petra und Said, Treppe an „Praxis Dr. Meier“, „Pflegeheim Am Wald“, „Praxis Dr. Berg“, Schichten diese und nächste Woche Mo–Fr (plus heute/morgen) mit fester Besatzung je Fahrzeug, u. a. AC-MK 301 mit Beifahrer, AC-MK 201 mit Scalamobil, AC-MK 401 (Liegend) nachmittags zu zweit.

### Schritt 2 – Fachlogik mit Tests (`d09f0fc`)
- `src/core/shifts/besatzung.ts`: „Was kann diese Besatzung“ (`besatzungKann`, Etiketten wie in der Vorschau `besatzungsEtiketten`), `besatzungPruefen(anforderung, fahrzeug, besatzung)` mit klaren Meldungen, `fahrtAnforderung` (Treppe am Abhol- oder Zielort).
- `src/core/shifts/schichtplan.ts` (rein): Prüfungen beim Speichern (Fahrer gesetzt, Uhrzeiten, Ende vor Beginn = Nachtschicht M-18, keine Überschneidung je Fahrzeug, keine Person doppelt über alle Fahrzeuge als Fahrer oder Beifahrer, Fahrer ≠ Beifahrer, deaktivierte Personen M-12, Scalamobil-Anzahl per Gleichzeitigkeits-Zählung, unbekannte IDs), `zielTage` („Gilt für“), `ersetzungPlanen` (je Fahrzeug und Tag ersetzen, vergangene Tage und begonnene Schichten übersprungen und gemeldet, Modus STRENG/ÜBERSPRINGEN, liefert den Vorher-Stand für „Rückgängig“), `wocheKopierenAenderungen`, `bisMonatsendeZielwochen`, `betroffeneFahrten`, `scalamobilHoechstbelegung`.
- `src/core/shifts/schichtplanSpeichern.ts` (Datenbank): `schichtenErsetzen` in EINER Transaktion mit Sperren (Mandant + je Fahrzeug wie `fahrzeugZuweisen`), `referenzenPruefen`, Hinweis statt Speichern solange betroffene Fahrten nicht bestätigt sind, danach Freigabe; `beifahrerAusSchichtenNehmen` (Deaktivieren), `wocheKopieren`, `scalamobilAnzahlSetzen`, `scalamobilEinweisungSetzen`, `schichtplanDatenLaden`.
- `src/core/rides/fahrerAusfall.ts`: neue gemeinsame Funktion `disponierteFahrtFreigeben` (genau der bisherige „Ich falle aus“-Weg: DISPONIERT → PROBLEM → Fahrzeug/Fahrer lösen → ERFASST → neu vorschlagen; optional Push „Fahrt entzogen“); `fahrerFaelltAusKern` nutzt sie. `zuweisen.ts`: `fahrtEntzogenMelden` herausgelöst, die neuen Vermerke in `DISPOSITIONS_PROBLEME` (verschwinden bei erfolgreicher Neuzuweisung).
- `src/core/drivers/deaktivieren.ts`: deaktivierte Person wird aus allen noch nicht beendeten Schichten als Beifahrer ausgetragen, betroffene Fahrten mit „Beifahrer deaktiviert – neues Fahrzeug nötig“ freigegeben.
- `src/core/shifts/week.ts`: Kalenderhelfer `wochentagVonIso`, `monatsTageIso`, `montagVonIso`, `tagKurzIso`, `kalenderwocheIso` (reine Kalenderrechnung, zeitzonenfest).
- Tests: `tests/shifts/besatzung.test.ts`, `tests/shifts/schichtplan.test.ts`, `tests/shifts/schichtplanSpeichern.test.ts`, Ergänzung `tests/shifts-week.test.ts`.

### Schritt 3 – Disposition und Automodus (`0f1c235`)
- `kandidaten.ts`: Tragestuhl ebenerdig auch auf Fahrzeugen mit Rollstuhlplatz; `SchichtFuerPruefung.besatzung`; `findeEinsatzSchicht` (erste Schicht mit passender Besatzung). `schichtenLaden.ts` lädt Schichten samt Besatzung (deaktivierter Fahrer zählt wie ausgefallen).
- `vorschlagen.ts`, `vorschlagSpeichern.ts`, `planFuerMorgen.ts`: Treppe der Fahrt und Besatzung der Schicht gehen in die Kandidatenwahl ein.
- `zuweisen.ts` `einsatzfaehigenFahrerFinden(db, vehicleId, pickupAt, anforderung)`: prüft zusätzlich die Besatzung; neue Klasse **`BesatzungError extends KeinFahrerError`** – alle bisherigen Aufrufer (Bestätigen, Umbesetzen, Ziehen im Zeitstrahl, Automodus, Plan für morgen, Demo) behandeln sie automatisch als Meldung. `fahrten/actions.ts` (`fahrtVerschieben`) übergibt die Anforderung.
- `automodus.ts`: **Sicherheitsbedingung 6 „Besatzung passt zur Fahrt“** (`pruefeBesatzung`, Pflichtfeld `besatzung` in `SicherheitsbedingungenEingabe`), verdrahtet in `automatischDisponieren.ts` und `planFuerMorgen.ts`.
- Demo: `seedDemoTenant.ts` setzt je Liegend-Fahrzeug eine Aushilfe als Beifahrer (selbstheilend auch für bestehende Schichten) – lokal ausgeführt und per SQL geprüft.
- `docs/05-disposition.md`: Abschnitte „Besatzung“ und „Schichtplan“, Ausstattungstabelle, Einsatzfähiger Fahrer, Bedingung 6, Pflichttests.
- Tests: `tests/disposition/zuweisenBesatzung.test.ts` (neu, gegen Postgres), Ergänzungen in `kandidaten`, `vorschlagen`, `automodus`.

### Schritt 4 – Seite `/dispo/schichtplan`, Personal, Orte, Einstellungen (`c9f04ec`)
- `src/app/dispo/schichtplan/`: `page.tsx`, `SchichtplanClient.tsx`, `Monatskalender.tsx`, `HeuteKarte.tsx`, `Wochenplan.tsx`, `SchichtEditor.tsx`, `anzeige.ts`, `actions.ts`, `texte.ts`. Aufbau, Texte und Bedienung wie die Vorschau; Menüeintrag „Schichtplan“ direkt nach „Dashboard“, „Personal“ nach „Fahrzeuge“ (`src/app/dispo/layout.tsx`).
- `/dispo/fahrer` → **Personalverwaltung** (`FahrerClient.tsx`, `actions.ts`, `texte.ts`): Person einladen mit Häkchen „Aushilfe“, Spalten Rolle (Aushilfe), Einweisung Scalamobil, Status; Geräte; Deaktivieren nur für Admins sichtbar. **Schicht-Muster und alte Wochentabelle entfallen** (`schichtMusterAnlegen`, `schichtLöschen`, `schichtenFuerWoche`, `schichtMusterSchema` entfernt; der M-18-Test läuft jetzt über den Schichtplan). Einrichtungsassistent Schritt 4 zeigt nur noch die Personalverwaltung mit Hinweis auf den Schichtplan.
- Orte: Häkchen „Treppe“ (Formular, Etikett in der Liste, CSV-Spalte „Treppe (ja/nein)“). Einstellungen: Karte „Betrieb“ mit „Anzahl Scalamobile“ (nur Admin; Senken unter die geplante Gleichzeitig-Belegung wird mit Meldung abgelehnt).
- Neue UI-Bausteine in `src/components/ui/`: `SidePanel`, `Toast`, `SelectField`, `CheckboxField`, `RadioGroup`, `IconButton`, `StatusDot`, `Hinweisbox`; Hook `src/hooks/useFokusfalle.ts` (jetzt auch von `Modal` genutzt). Neue Tokens in `globals.css`. Dokumentiert in `docs/DESIGN-GUIDE.md` Abschnitt 10.

### Schritt 5 – Schutz beim Ändern (`f91a4c8`)
- Seitenfenster: Hinweis „N Fahrten liegen in dieser Schicht“ mit Tag, Uhrzeit, Kennzeichen (keine Fahrgastnamen) **vor** dem Speichern, Bestätigung „Trotzdem speichern“ / „Zurück“ im Seitenfenster (kein `confirm()`); jede Änderung nach dem Hinweis macht ihn ungültig. Löschen mit zweistufiger Rückfrage im Seitenfenster. Woche kopieren: derselbe Hinweis in einem Dialog. Laufende Schichten werden nie zu Entwürfen (nur lesen). „Rückgängig“ gibt nie ungefragt Fahrten frei (dann Meldung).
- Test `tests/shifts/schichtplanOberflaeche.test.ts` über die echten Server Actions (inkl. Rollenprüfung: Fahrer dürfen den Plan weder laden noch ändern).

### Schritt 6 – Fahrer-App „Mein Schichtplan“ (`b6a1bfc`)
- `src/core/shifts/meinSchichtplan.ts`, `src/app/fahrer/MeinSchichtplan.tsx`, `texte.ts`; `fahrerUebersichtLaden` liefert `meinSchichtplan` (eigene Schichten der nächsten 4 Wochen, als Fahrer oder Beifahrer: Datum, Zeit, Fahrzeug, Kollege/Kollegin, Scalamobil, ggf. „Ausfall gemeldet“). Nur lesen, keine Push bei Änderungen.
- Beifahrer bekommen keine Fahrten (Fahrten hängen weiter nur an `driverId`); wer heute nur Beifahrer ist, sieht „Heute als Beifahrer auf AC-MK 301 (06:00–14:00) mit Nina Navi. Die Fahrten stehen beim Fahrer.“
- Test `tests/fahrer/meinSchichtplan.test.ts`.

## Browser-Prüfung
Dev-Server unter `TZ=UTC` (Port 3007), Anmeldung als Disponent per Einmal-Code aus dem Server-Log und als Aushilfe per Einmal-Link, vorinstalliertes Chromium (`/opt/pw-browsers/chromium_headless_shell-1243`, die installierte Playwright-Version erwartet 1248 – deshalb `executablePath`).
Geprüft mit Screenshots auf 1440 px, 900 px und 390 px: Monatskalender, „Heute“ (zeigt unter `TZ=UTC` korrekt „Heute, Montag, 02.11. · 13:35“ Berliner Zeit), Wochenansicht (Woche 45, 02.11. bis 08.11.2026), Seitenfenster neu/mit Fehler („Fahrer und Beifahrer können nicht dieselbe Person sein.“)/gespeichert mit Toast und „Rückgängig“, Hinweis mit 3 Fahrten (09:15, 11:45, 13:15) und nach „Trotzdem speichern“ „2 Fahrten neu zu planen“ (Ende 10:00), Fahrten danach auf dem Dashboard in der Liste mit dem Vermerk, Woche kopieren („Woche 45 in Woche 46 kopiert“), Personal, Orte, Einstellungen, Fahrer-App einer Aushilfe auf 390 px. Keine Seitenbreite über 390 px (kein waagerechtes Scrollen der Seite; die Woche scrollt in ihrem Kasten). Keine Browser-Fehler auf den neuen Seiten.
Nebenbefund (nicht von mir, nicht geändert): Auf dem **Dashboard** meldet Next unter `TZ=UTC` einen Hydration-Fehler – `src/app/dispo/DispoClient.tsx` Zeile ~755 formatiert `berlinerMitternacht(datum).toLocaleDateString("de-DE", …)` ohne `timeZone: "Europe/Berlin"`; der Server zeigt dann „So., 01.11.“ statt „Mo., 02.11.“. Einzeiler, eigener Auftrag empfohlen.

## Checkliste DESIGN-GUIDE Abschnitt 11 (Schichtplan-Seite)
- [x] Seitenmuster: „Planung“ (Kalender + Wochenraster breit, Bearbeiten im Seitenpanel); Kennzahlen bewusst weggelassen, weil die Vorschau keine hat.
- [x] Höchstens ein Primärknopf je Bereich (Seite: keiner; Seitenfenster: „Speichern“ bzw. „Trotzdem speichern“).
- [x] Farben nur aus Tokens; Orange nur für Handlungsbedarf („Liegend: 2. Person fehlt“, „Scalamobil: Fahrer ohne Einweisung“, „Fällt aus“, Hinweis-Kasten). Neue Tokens dokumentiert.
- [~] Transportart: kommt auf der Seite nicht vor (Fahrzeugtyp als Text „BTW · Rollstuhl“, „LMW · Liegend“).
- [x] Vorschläge gestrichelt: keine Vorschläge auf der Seite. **Abweichung laut Vorschau:** leere Zellen „+ Schicht planen“ sind gestrichelt (bedeutet hier „freier Platz“) – im Guide vermerkt.
- [x] Zeilenmuster: Fahrzeugzeilen „Kennzeichen (Mono) / Typ“, Personal „Name / Rolle · Einweisung“.
- [x] Details im Seitenfenster mit Kopf (Meta in Mono, Titel 22 px, ×), Fußzeile Primär links, Gefahr rechts.
- [x] Leer-, Lade-, Fehlerzustand: „Noch keine aktiven Fahrzeuge …“ mit Link, „Lädt …“ beim Blättern, Warnkasten „konnte nicht geladen werden“ mit „Erneut versuchen“. Lade-Platzhalterbalken nicht gebaut (Seite lädt serverseitig, Blättern dauert < 0,1 s).
- [x] Begriffe/Sprache: du-los, sachlich, Texte in `texte.ts`; „Fahrgast“ kommt nicht vor; „Hinweis“ statt „Braucht Sie“ im neuen Dialog. Die bestehende Liste/Kachel „Braucht Sie“ ist **nicht** umbenannt.
- [x] Tastatur, Kontrast, `aria-label`: alle Zellen und Kalendertage sind echte Knöpfe mit sprechendem `aria-label`; Seitenfenster mit Fokusfalle, Esc, Rücksprung; Toast `aria-live`. Kontrast: „alle besetzt“ mit `#4E7559` statt `#5E8C6A` der Vorschau (weiß darauf sonst nur 3,9:1).
- [x] Unter 1000 px und am Handy (390 px) geprüft.

## Annahmen (ausdrücklich)
1. **Einweisung zählt beim Fahrer.** „1 Person mit Scalamobil und Einweisung“ = der Fahrer muss eingewiesen sein; ein eingewiesener Beifahrer allein reicht nicht (mit Beifahrer gilt ohnehin „2 Personen“ – aber nur auf einem Fahrzeug mit Tragestuhl).
2. **Zwei Personen über die Treppe nur mit Tragestuhl im Fahrzeug.** Ein Rollstuhl-BTW ohne Tragestuhl mit Beifahrer gilt als „nur ebenerdig“ (Auftrag: „2 Personen auf einem Fahrzeug mit Tragestuhl“). Die Vorschau zeigte dort „Treppe: mit 2 Personen“ – die bestätigte Regel geht vor.
3. **Sitzend und Rollstuhl** stellen keine Anforderung an die Besatzung, auch mit Treppe nicht.
4. **Treppe = Abhol- ODER Zielort** hat `treppe`.
5. **Scalamobil nur auf Fahrzeugen mit Tragestuhl oder Rollstuhlplatz** (das Häkchen erscheint nur dort; der Kern lehnt es sonst ab).
6. **Werktage = Montag bis Freitag**, Feiertage werden bei „alle Werktage im Monat“ nicht ausgelassen (wie Vorschau).
7. **„Bis Monatsende“** nutzt den Monat des Donnerstags der Woche und ändert nur Tage dieses Monats (wie Vorschau).
8. **Ein Fahrzeug-Tag = alle Schichten, die an diesem Berliner Tag beginnen.** Nachtschichten gehören zum Starttag.
9. **Laufende Schicht = `startedAt` gesetzt**; sie bleibt beim Ersetzen stehen und wird gemeldet. Eine Schicht, deren Beginn vorbei ist, die aber nicht gestartet wurde, ist heute noch änderbar.
10. **Ausgefallene Schichten** („Ich falle aus“) blockieren weder Fahrzeug noch Person noch Scalamobil, damit eine Ersatzschicht möglich ist (M-72). Im Seitenfenster sind sie mit Hinweis bearbeitbar; neuer Fahrer = Ersatzschicht.
11. **Betroffene Fahrt** = DISPONIERT, Abholzeit in einer wegfallenden Schicht des eigenen Fahrzeugs, danach keine Schicht dieses Fahrzeugs mit **demselben Fahrer** und passender Besatzung. Auch ein reiner Fahrerwechsel macht Fahrten betroffen (sonst stünde der alte Fahrer an der Fahrt). VORGESCHLAGEN-Fahrten sind nicht betroffen (der Automodus prüft beim Zuweisen ohnehin neu).
12. **Push „Fahrt entzogen“** (nur Uhrzeit) an den bisherigen Fahrer bei Freigabe aus dem Schichtplan – wie bei „Rückgängig“ im Dashboard. Bei „Ich falle aus“ weiterhin keine Push (unverändert).
13. **Seitenfenster: ein Prüffehler bricht alles ab** (wie Vorschau); **Woche kopieren: Fahrzeug-Tage mit Fehler werden übersprungen und gemeldet**, der Rest übernommen.
14. **„Rückgängig“** stellt nur die Schichten wieder her; schon freigegebene Fahrten bleiben neu zu planen. Liegen inzwischen Fahrten in den Schichten, wird nicht rückgängig gemacht (Meldung).
15. **Einweisung entfernen** wird abgelehnt, solange der Person eine Treppenfahrt zugewiesen ist, die nur über das Scalamobil geht (zurückhaltend statt Fahrten still freizugeben). **Anzahl Scalamobile senken** wird abgelehnt, solange der künftige Plan mehr gleichzeitig vorsieht.
16. **Deaktivieren** trägt die Person auch als Beifahrer aus allen noch nicht beendeten Schichten aus (auch einer laufenden) und gibt Fahrten frei, die dann nicht mehr passen.
17. **Rolle in Listen:** „Fahrer“ bzw. „Aushilfe“ (keine Geschlechtsform wie „Fahrerin“ in der Vorschau – das Datenmodell kennt kein Geschlecht).
18. Die neuen Fahrer-App-Texte sind du-los; die bestehenden Sie-Texte der Fahrer-App wurden nicht umgestellt (CLAUDE.md: nach und nach).

## Offene Fragen an den Auftraggeber
1. **Bestandsschichten ohne Beifahrer (wichtig vor dem Einsatz).** Ab jetzt gehen Liegend-Fahrten nur noch an Schichten mit Beifahrer. Bei einem Betrieb mit echten Daten müssen die Liegend-Schichten im Schichtplan um einen Beifahrer ergänzt werden. **Empfehlung:** vor dem Aufspielen einmal mit dem Betrieb die Liegend-Schichten durchgehen; die Migration ändert bewusst keine Daten.
2. **Beifahrer fällt aus.** „Ich falle aus“ wirkt nur für die eigene Fahrer-Schicht. Meldet sich ein Beifahrer krank, ändert das Büro die Schicht im Schichtplan (dann greift der Hinweis). Soll die Fahrer-App für Beifahrer einen eigenen „Ich falle aus“-Knopf bekommen? **Empfehlung:** ja, später, mit derselben Logik wie Deaktivieren (austragen + betroffene Fahrten freigeben).
3. **Einrichtungsassistent Schritt 4** plant keine Schichten mehr (Schicht-Muster entfallen). Soll der Assistent einen Schritt „erste Woche planen“ mit dem Schichtplan bekommen? **Empfehlung:** Link „Schichtplan öffnen“ im letzten Schritt reicht für den Pilot.
4. **Feiertage** bei „alle Werktage im Monat“ auslassen? (`src/core/shifts/feiertageNrw.ts` gibt es.) **Empfehlung:** ja, als kleine Ergänzung.
5. **Rollstuhl-/Sitzend-Fahrten mit Treppe** – braucht es dort auch 2 Personen oder ein Scalamobil? Derzeit nein (Annahme 3).
6. **Push bei Schichtänderungen** an die betroffenen Personen kommt laut Auftrag später.
7. **Personalliste auf der Schichtplan-Seite** zeigt nur aktive Personen; deaktivierte nur in der Personalverwaltung. Passt das?

## Vorschläge
| Nr | Vorschlag | Nutzen | Aufwand | Empfehlung |
|----|-----------|--------|---------|------------|
| 1 | Dashboard-Zeitstrahl: Beifahrer und Scalamobil im Fahrzeug-Etikett zeigen | Disponent sieht die Besatzung ohne Seitenwechsel | 1–2 h | vor dem Pilot |
| 2 | „Anderes Fahrzeug“ im Fahrt-Fenster: Fahrzeuge ohne passende Besatzung ausgegraut mit Grund | Weniger Ablehnungen | 2–3 h | vor dem Pilot |
| 3 | Hydration-Fehler im Dashboard unter `TZ=UTC` beheben (`timeZone` ergänzen) | Richtiges Datum im Kopf auf UTC-Servern (Vercel!) | 10 min | sofort |
| 4 | Problemcodes in der Dashboard-Liste in Klartext (z. B. „ABHOLZEIT_VERGANGEN“) | lesbarer | 1 h | später |

## Nachprüfungsauftrag für den Prüfer (Rolle `dispona-pruefer`)
Voraussetzung: lokale Postgres, `.env` mit `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `VAPI_WEBHOOK_SECRET`, `APP_URL`; Branch `claude/schichtplan`; **`npx prisma migrate deploy --config prisma7.config.ts`** (neue Migration), `npx prisma generate --config prisma7.config.ts`, `rm -rf .next`, `npx next typegen`. Dann `npm run lint && npm run typecheck && npm test` (erwartet 557/557, 85 Dateien) und `TZ=UTC npm test`. `DB` = Wert von `DATABASE_URL`.

| Kennung | So prüfen | Erwartung | Nebenwirkungen ansehen |
|---------|-----------|-----------|------------------------|
| SP-1 Datenbank / M-11 | `npx vitest run tests/db-tenant.test.ts -t "Schichtplan"`; `psql "$DB" -c "\d \"Shift\""` | Trigger `Shift_mandant_referenzen` mit `beifahrerId`, CHECK `Shift_beifahrer_nicht_fahrer`; fremder Beifahrer → `FREMDE_REFERENZ`/„Beifahrer nicht gefunden.“ | `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` leer; `db push` installiert Trigger/CHECK nicht (Kommentar in der Migration) |
| SP-2 Besatzungsregeln | `npx vitest run tests/shifts/besatzung.test.ts tests/disposition/kandidaten.test.ts tests/disposition/vorschlagen.test.ts` | Liegend nur zu zweit; Treppe zu zweit nur mit `carryChair`, mit Scalamobil nur mit Einweisung des Fahrers; ebenerdig auch Rollstuhl-BTW allein | Annahmen 1–5; Änderung an `erfuelltAusstattung` (Tragestuhl ebenerdig auf Rollstuhl-BTW) ist gewollt |
| SP-3 Zuweisung / Automodus | `npx vitest run tests/disposition/zuweisenBesatzung.test.ts tests/disposition/automodus.test.ts tests/disposition/zuweisenFahrer.test.ts` | `BesatzungError` (Unterklasse von `KeinFahrerError`) mit Text „Liegend-Fahrt braucht 2 Personen. …“, Fahrt unverändert; `fahrzeugWaehlen` → `{ok:false, grund}`; Automodus lässt Fahrt mit `autoSkipReason` liegen (Bedingung 6) | alle bisherigen M-72-Tests grün; `planFuerMorgen*.test.ts` grün |
| SP-4 Prüfungen beim Speichern | `npx vitest run tests/shifts/schichtplan.test.ts tests/shifts/nachtschicht.test.ts` | Fahrer fehlt, Uhrzeit, Nachtschicht, Fahrzeug-/Personen-Überschneidung (auch als Beifahrer), deaktiviert, Scalamobil-Anzahl (Zählung der Gleichzeitigkeit, 2 Geräte), unbekannte IDs, vergangene Tage/laufende Schichten übersprungen | Annahmen 8–10 |
| SP-5 Speichern, Hinweis, Freigabe | `npx vitest run tests/shifts/schichtplanSpeichern.test.ts tests/shifts/schichtplanOberflaeche.test.ts` | Erst Hinweis (Uhrzeit, kein Fahrgastname), nichts geändert; mit Bestätigung: Fahrt ERFASST/VORGESCHLAGEN, ohne Fahrzeug/Fahrer, Vermerk „Schicht geändert – neues Fahrzeug nötig“, Notification `FAHRT_ENTZOGEN`; neue betroffene Fahrt → erneuter Hinweis; Rückgängig gibt nie ungefragt frei; Fahrer-Rolle abgewiesen | Sperren (`pg_advisory_xact_lock`) parallel zu `fahrzeugZuweisen`: Prüfer kann mit zwei gleichzeitigen Aufrufen (Zuweisung in eine wegfallende Schicht) gegenprüfen |
| SP-6 Deaktivieren als Beifahrer | `npx vitest run tests/shifts/schichtplanSpeichern.test.ts -t "deaktivierter Beifahrer"` und `npx vitest run tests/drivers/deaktivieren.test.ts` | Beifahrer ausgetragen, Liegend-Fahrt freigegeben („Beifahrer deaktiviert – …“), Sitzend-Fahrt bleibt | Annahme 16 |
| SP-7 Fahrer-App | `npx vitest run tests/fahrer/meinSchichtplan.test.ts tests/fahrer/actions.test.ts` | eigene Schichten 4 Wochen als Fahrer/Beifahrer, Kollege, Scalamobil, Folgetag; Beifahrer bekommt 0 Fahrten; kein Fahrgastname im Schichtplan | Browser: als `ben@muster-krankenfahrten.de` (Einmal-Link aus dem Dev-Log) `/fahrer` auf 390 px |
| SP-8 Oberfläche | `npm run seed`, `TZ=UTC npx next dev -p <Port>`, Anmeldung `disponent1@muster-krankenfahrten.de` (Code im Log), `/dispo/schichtplan` auf 1440/900/390 px | wie Vorschau; Klick auf Zelle → Seitenfenster; „Gilt für“; Fahrer = Beifahrer → Fehlermeldung; Fahrten zuweisen (z. B. im Dashboard), dann AC-MK 101 heute Ende vorziehen → Hinweis mit Uhrzeiten → „Trotzdem speichern“ → Fahrten mit Vermerk im Dashboard; Woche kopieren + Rückgängig; Tastatur (Tab/Esc), Fokus zurück | Personal (`/dispo/fahrer`), Orte „Treppe“, Einstellungen „Anzahl Scalamobile“ (als Admin `admin@muster-krankenfahrten.de`); Einrichtungsassistent Schritt 4 ohne Schicht-Muster |
| SP-9 Demo | `npx tsx --env-file=.env scripts/seed-demo-tenant.ts`, dann SQL auf `Shift` des Mandanten `demo-tenant` | B-DEM 400/401 haben je eine Aushilfe als Beifahrer | `tests/demo/*.test.ts` grün |
| SP-10 Doku | `docs/05-disposition.md` (Besatzung, Schichtplan, Bedingung 6), `docs/DESIGN-GUIDE.md` Abschnitt 10 | stimmt mit dem Code überein | Hinweis Abweichung „gestrichelt“ |
