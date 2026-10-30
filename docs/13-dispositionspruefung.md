# 13 – Prüfung der Dispositionslogik (Stand 30.10.2026)

Unabhängige, bewusst kritische Gegenprüfung der Fahrzeugdisposition nach den Fixes vom
30.10.2026 (GPS-Frische, Doppelbuchungs-Fehlalarm bei Hin-/Rückfahrt, Fairness-Gewichtung
`auslastungDifferenz`, Bereinigung von `autoSkipReason`/`problems`). Ziel: nicht bestätigen, dass
die Fixes funktionieren, sondern aktiv nach dem suchen, was sie noch übersehen. Geprüfte Dateien:
`src/core/rides/erfassen.ts`, `src/core/rides/pruefungen.ts`, `src/core/disposition/zuweisen.ts`,
`src/core/disposition/vorschlagen.ts`, `src/core/disposition/bewertung.ts`/`weights.ts`,
`src/core/disposition/automatischDisponieren.ts`, `src/core/demo/betriebSimulieren.ts`,
`src/core/shifts/dauer.ts`, `src/app/dispo/fahrten/actions.ts`,
`src/app/api/cron/brauchtSieBereinigenEinmalig/route.ts`.

**Verdikt der Prüfung:** nicht "100/100" – 7 reale Probleme, 2 davon schwer. Stand jetzt
**noch keines davon behoben**, dies ist eine Fund-Liste, kein Abschlussbericht.

## 1. Cron-Race bei parallelen Automodus-Durchläufen (schwer)

**Fundort:** `src/core/disposition/zuweisen.ts:81-103`,
`src/core/disposition/automatischDisponieren.ts:96-104`.

`automatischDisponieren()` hat keine Sperre; Vercel-Cron garantiert keinen gegenseitigen
Ausschluss, und ein Rückstand kann einen Lauf in den nächsten hinein überlaufen lassen. Zwei
überlappende Durchläufe laden dieselbe `VORGESCHLAGEN`-Fahrt R, bevor einer von beiden schreibt.
Lauf 1 schließt vollständig ab: `vehicleId=X`, Status → `DISPONIERT`. Lauf 2, mit einem anderen
Kandidat-Fahrzeug Y, besteht seine eigene Konfliktprüfung (die nur *andere* Fahrten von Y
betrachtet) und überschreibt `vehicleId` von R auf Y. Der anschließende Aufruf von
`fahrtStatusAendern(R, "DISPONIERT")` schlägt fehl, weil R schon `DISPONIERT` ist –
`istUebergangErlaubt(DISPONIERT, DISPONIERT)` liefert `false`, ein einfacher `Error` wird
geworfen. `automatischDisponieren.ts` fängt dort nur `FahrzeugKonfliktError` ab; alles andere
reißt die **gesamte restliche Schleife für diesen Mandanten ab** – jede andere offene Fahrt in
diesem Tick wird gar nicht mehr versucht. Zusätzlich hat Fahrer X schon eine „Neue Fahrt"-Push für
eine Fahrt bekommen, die ihm inzwischen wieder entzogen ist, während Fahrer Y nie benachrichtigt
wird (der Code dafür wird nie erreicht).

## 2. Doppelbuchungs-Ausnahme filtert nach Zeitwert statt Fahrt-Identität (schwer)

**Fundort:** `src/core/rides/erfassen.ts:56-58`, `src/core/rides/pruefungen.ts:20-29`.

```js
.filter((zeit) => !ignoriereAbholzeit || zeit.getTime() !== ignoriereAbholzeit.getTime())
```

Das entfernt *jede* bestehende Fahrt dieses Fahrgasts, deren `pickupAt` exakt (auf die
Millisekunde) `ignoriereAbholzeit` entspricht – nicht nur die eine Hinfahrt-Zeile, die eigentlich
ausgenommen werden soll. Hat Fahrgast P bereits eine andere, echte Fahrt exakt zur selben Uhrzeit
(Zufall, oder eine wiederkehrende Serie), und wird jetzt eine normale Hin-/Rückfahrt mit
Hinfahrt-Zeit = dieser Uhrzeit angelegt, filtert `erfassen.ts` beim Anlegen der Rückfahrt sowohl
die gemeinte Hinfahrt als auch die unabhängige, echte Fahrt heraus. `istDoppelbuchung()` sieht die
echte Fahrt dann nie, `DOPPELBUCHUNG` wird fälschlich nie gemeldet – genau der Fehlerkategorie,
die der heutige Fix eigentlich beheben sollte, nur seltener und über die reale Dispo-UI erreichbar,
nicht nur in der Demo.

## 3. Rückfahrt über Mitternacht landet auf dem falschen Kalendertag (mittel-schwer)

**Fundort:** `src/core/rides/erfassen.ts:37-39`, `src/core/rides/validation.ts:27-28,47-48`.

`tag` ist der Kalendertag der Hinfahrt; es gibt keinen Tagesübertrag und keine
Feld-übergreifende Prüfung `rueckfahrtzeit > abholzeit`. Hinfahrt um 23:30, Rückfahrt eigentlich
für 00:15 am Folgetag gemeint: `mitUhrzeit(tag, "00:15")` legt sie auf 00:15 am *selben* Tag –
fast 23h15min *vor* der Hinfahrt, die sie eigentlich nachfolgen soll.

## 4. Fairness-Scoring ignoriert noch offene Vorschläge (mittel)

**Fundort:** `src/core/disposition/vorschlagSpeichern.ts:31-39` (`vehicleId: { not: null }`),
`src/core/disposition/vorschlagen.ts:47-60`.

Der `tagesplan` für `auslastungDifferenzBerechnen()` enthält nur schon bestätigte Fahrten, nie
`VORGESCHLAGEN`-Fahrten, die noch auf Automodus warten. Werden mehrere gleichartige Fahrten kurz
hintereinander gebucht, sieht jede unabhängig denselben „unterausgelasteten" Wagen als beste Option
– die Fairness-Bremse ist blind für den Rückstau, den sie selbst verursacht.

## 5. Vorschlags-Score/ETA wird nie neu berechnet (mittel)

**Fundort:** `src/core/disposition/automatischDisponieren.ts:35,57-71,75-89`.

Bedingungen 3 (GPS) und 4 (Schicht) werden pro Kandidat und Tick frisch abgefragt, Bedingung 2
(`pruefeBesterVorschlag`) nutzt aber `score`/`onTime` unverändert aus dem bei Fahrt-Anlage
gespeicherten `vorschlag.options` – nie neu berechnet. Eine Fahrt, die (begrenzt durch
`autoModeMaxDaysAhead`) tage lang als `VORGESCHLAGEN` liegt, wird am Ende auf Basis tagealter
Reisezeit-Daten automatisch disponiert – inkonsistent mit dem heute gefixten GPS-Frische-Prinzip.

## 6. "Einmaliger" Cleanup-Cron ist als Jahres-Cron verdrahtet (mittel)

**Fundort:** `src/app/api/cron/brauchtSieBereinigenEinmalig/route.ts`, `vercel.json:10`.

Der Kommentar sagt „nach einmaligem Gebrauch wieder entfernt", aber `vercel.json` registriert
`"0 0 1 1 *"` – ein *jährlicher* Cron, kein echtes Einmal-Trigger. Wird das Entfernen der Route und
des `vercel.json`-Eintrags vergessen, aktiviert sie sich jeden 1. Januar erneut. Mandantenübergreifend
(direkter `prisma`-Zugriff statt `withTenant`), nur durch das gemeinsame `CRON_SECRET` geschützt.
Die Mutation selbst ist idempotent (mehrfaches Ausführen richtet keinen Schaden an), aber es ist
eine geladene, leicht vergessbare, mandantenübergreifende Schreib-Route.

## 7. Fahrzeug-Konfliktprüfung ohne Zeitpuffer (leicht-mittel)

**Fundort:** `src/core/disposition/zuweisen.ts:66-69`.

```js
return fahrt.pickupAt < andereEnde && andere.pickupAt < eigenesEnde;
```

Striktes offenes Intervall, kein Fahrtpuffer. Zwei Fahrten, bei denen das geplante Ende der einen
exakt dem Pickup der nächsten entspricht, werden nicht als Konflikt erkannt – selbst wenn die
reale Strecke zwischen Abgabe- und nächstem Abholort dafür keine Zeit lässt. Der
`folgefahrtPufferMinuten`-Puffer gilt nur bei der Vorschlagsberechnung; eine manuelle
Fahrzeugwahl umgeht ihn und landet direkt auf dieser ungepufferten Prüfung.

## Geprüft und ausgeschlossen (keine echten Probleme)

- Zwei verschiedene Fahrgäste mit identischer Pickup-Zeit (Doppelbuchungsprüfung ist bewusst
  pro `passengerId` skaliert).
- DST/Mitternacht-Arithmetik in `src/core/shifts/week.ts` (basiert auf
  `Intl.DateTimeFormat`-Rundtrip, sauber).
- Unbegrenztes Wachstum der `VehicleLocation`-Tabelle durch den neuen 5-Minuten-GPS-Refresh
  (begrenzt – `src/core/demo/aufraeumen.ts` löscht Zeilen älter als 3h außer der jeweils
  neuesten pro Fahrzeug).
- `KEIN_FAHRZEUG` neben einem zweiten, echten Problem (der neue Filter in `zuweisen.ts:100`
  entfernt gezielt nur `"KEIN_FAHRZEUG"`, andere Probleme bleiben korrekt stehen).
- Doppelzählung im Fairness-Tagesplan über Fahrzeugtypen hinweg (nicht gefunden – korrekt über
  `vehicleId` mit `kandidatenIds.has()`-Schutz geschlüsselt).

## Status Runde 1

Alle 7 Punkte: **offen**, noch nichts davon behoben (Stand 30.10.2026).

---

# Runde 2 – Umplanen/Umbesetzen + übrige Crons (Stand 30.10.2026)

Zweite, bewusst andere Prüfungsrunde: Fokus auf alles, was eine Fahrt umplant oder umbesetzt
(`fahrtAendern` + `fahrzeugZuweisen`-Zusammenspiel, Drag-Umplanung im Zeitstrahl), sowie die in
Runde 1 noch nicht geprüften Cronjobs (`eskalation`, `planFuerMorgen`, `serienVerlaengern`,
`loeschfristen`) und den Voice-Agent-Pfad (`werkzeuge.ts`). Die drei schon früher gefixten Bugs
aus [[dispona-dispatch-notify-zusammenspiel]] (fehlende Re-Zuweisung bei reiner Zeitverschiebung,
DISPONIERT→DISPONIERT-Guard, Push-Dedup, `driverId ?? null`) wurden erneut bestätigt – isoliert
korrekt, aber zwei davon interagieren schlecht mit neu gefundenen Problemen (siehe 4 und 9
unten).

**Verdikt Runde 2:** 11 weitere, eigenständige Probleme, 2 davon kritischer als alles aus Runde 1
– ein echter, stiller Doppelbuchungs-Race ohne jede Fehlermeldung, und ein Schreib-vor-Status-Bug,
der einen "Split-Brain"-Datensatz erzeugt.

### 1. [Kritisch] Stiller Fahrzeug-Doppelbuchungs-Race (TOCTOU) in `fahrzeugZuweisen`

**Fundort:** `src/core/disposition/zuweisen.ts:52-74` (Lesen), `:81-102` (Schreiben).

Keine Transaktion/Sperre im gesamten Code (per Grep auf `$transaction`/`pg_advisory`/
`SERIALIZABLE` bestätigt – null Treffer), kein DB-Exclusion-Constraint auf `Ride`. Zwei
*verschiedene* Fahrten A und B, zeitlich überlappend, werden von zwei gleichzeitigen Aufrufern
(zwei Dispo-Tabs, oder ein Dispatcher + ein Cron-Tick) demselben Fahrzeug V zugewiesen – beide
lesen `andereFahrtenDesFahrzeugs` bevor der jeweils andere committet, beide sehen "kein Konflikt",
beide schreiben. Ergebnis: zwei `DISPONIERT`-Fahrten auf V mit überlappendem Zeitfenster, der
Fahrer bekommt zweimal "Neue Fahrt" – und **kein `FahrzeugKonfliktError`, keine Meldung,
"Braucht Sie" bleibt stumm.** Anders als Runde-1-Fund 1 (dieselbe Fahrt racet mit sich selbst,
endet in einem Fehler, der die Schleife abbricht) ist das hier zwei verschiedene Fahrten, die
unbemerkt beide gewinnen.

### 2. [Kritisch] Schreiben-vor-Status-Prüfung erzeugt „Split-Brain"-Datensatz

**Fundort:** `src/core/disposition/zuweisen.ts:81-103`.

`db.ride.update` (setzt `vehicleId`/`driverId`/`dispatchMode`/`problems`) läuft und committet,
**bevor** `fahrtStatusAendern(..., "DISPONIERT")` überhaupt aufgerufen wird. Ist die Fahrt in
diesem Moment schon `DISPONIERT` (verlorener Wettlauf, Doppelklick, Cron schlägt den Dispatcher),
wirft `istUebergangErlaubt(DISPONIERT, DISPONIERT)` einen einfachen `Error` – aber
`vehicleId`/`driverId` sind schon geschrieben. Alles danach (Push an alten/neuen Fahrer,
Suggestion-Entscheidung) läuft nie. Ergebnis: `ride.vehicleId`/`driverId` zeigen auf
Fahrzeug/Fahrer, die nie benachrichtigt wurden, während `status` und die Status-Historie noch die
*vorherige* Zuweisung zeigen. Konkret erreichbar über `fahrtVerschieben` (actions.ts:491-499), das
mit `automatischDisponieren`/`planFuerMorgen` auf derselben Fahrt racet, oder einfach ein
Dispatcher, der "Bestätigen" bei langsamer Anfrage doppelt klickt.

### 3. [Hoch] `planFuerMorgen` setzt sein „heute schon gelaufen"-Flag nie, wenn die Schleife wirft

**Fundort:** `src/app/api/cron/planFuerMorgen/route.ts:36-40`, `src/core/disposition/planFuerMorgen.ts:141-152`.

Das Flag `planFuerMorgenLauf` wird erst *nach* erfolgreichem Rücklauf von
`planFuerMorgenBerechnen` gesetzt. Dessen eigenes `catch` fängt nur `FahrzeugKonfliktError`; jeder
andere Fehler (z. B. Fund 2 oben) propagiert ungefangen nach oben, das Flag wird nie gesetzt. Der
nächste Cron-Tick (1–2 Min später) sieht `schonHeuteGelaufen = false` und rechnet die **komplette**
Planung für morgen für den ganzen Mandanten neu – jeden Zyklus, für den Rest des Tages, mit
erneutem Risiko des Split-Brain-Schreibens aus Fund 2.

### 4. [Hoch] Reine Zeit-Verschiebung eines unbestätigten Vorschlags macht ihn ungefragt zur echten Zuweisung

**Fundort:** `Zeitstrahl.tsx:297`, `:652`, `actions.ts:479-499`.

Eine `VORGESCHLAGEN`-Fahrt ohne echtes `vehicleId` wird unter ihrem *vorgeschlagenen* Fahrzeug
gerendert (`vorschlagVehicleId`), mit `fahrzeugId={zeile.id}` im Chip. Wird dieser Chip nur leicht
in der Zeit verschoben (keine Zeilenänderung), greift genau die Regel, die ursprünglich den
"reine Zeitverschiebung verliert Fahrzeug"-Bug fixen sollte – die für eine *echte* Zuweisung
richtig ist, hier aber nur eine *Vermutung* zu einer festen, benachrichtigten Zuweisung macht.
`fahrtVerschieben` ruft bedingungslos `fahrzeugZuweisen` auf → Status `DISPONIERT`, Fahrer bekommt
"Neue Fahrt" – der bewusste "Bestätigen"-Prüfschritt wird komplett übersprungen, nur weil die
Zeit leicht verschoben wurde.

### 5. [Hoch] `fahrerFaelltAusKern` räumt `vehicleId`/`driverId` nie ab

**Fundort:** `src/core/rides/fahrerAusfall.ts:30-39` (vgl. `zuweisen.ts:166-169`, das es richtig macht).

Fällt ein Fahrer aus, geht die Fahrt `PROBLEM` → `ERFASST` mit neuem Vorschlag – aber
`vehicleId`/`driverId` auf der Zeile bleiben stehen. Folgen: (a) die Fahrt hängt visuell weiter am
jetzt nicht verfügbaren Fahrzeug; (b) `fahrzeugZuweisen`s Konfliktprüfung zählt diese Fahrt
weiterhin gegen dieses Fahrzeug für jede andere, zeitlich nahe Zuweisung – ein falscher
"schon belegt"-Konflikt gegen ein Fahrzeug, das eigentlich frei ist.

### 6. [Mittel-hoch] `problems[]` ist (fast) nur additiv – Fahrten bleiben dauerhaft in „Braucht Sie" hängen

Per Grep bestätigt: einziger Löschpunkt ist `zuweisen.ts:100` (nur `"KEIN_FAHRZEUG"`). Alle
anderen Stellen pushen nur (`erfassen.ts:84`, `fahrerAusfall.ts:33`, `planFuerMorgen.ts:79`,
`vorschlagSpeichern.ts:84`). Dazu: `fahrtAendern` behandelt Status `PROBLEM` in keinem seiner
Zweige (aendern.ts:79/82) – fällt durch zu `{ok:true, neuVorgeschlagen:false}`, Status und
`problems[]` bleiben unverändert, die Fahrt kommt nie zurück in die Vorschlagspipeline. Zusammen
mit Fund 5: eine Fahrt, die einmal einen Fahrerausfall hatte und später korrekt neu besetzt wurde,
zeigt dauerhaft in "Braucht Sie" mit einem längst überholten "Fahrer fällt aus"-Grund.

### 7. [Mittel] Hin-/Rückfahrt-Kopplung (`returnOfId`) ist nur geschrieben, nirgends gelesen

Per erschöpfendem Grep über `src/core` und `src/app` bestätigt: `returnOfId` wird nur einmal bei
Anlage gesetzt (`erfassen.ts:117`) und sonst nirgendwo gelesen. Verschieben oder Stornieren der
Hinfahrt hat null Auswirkung auf und null Warnung für die verknüpfte Rückfahrt – das muss der
Dispatcher komplett unaufgefordert selbst im Kopf behalten.

### 8. [Mittel] Eskalations-SMS-Dedup ist für immer an die `rideId` gebunden, überlebt Neuzuweisung

**Fundort:** `src/core/notify/eskalation.ts` (`bestaetigungenPruefen`).

Dedup nur über `rideId`+`kind`, keine Zeit-/Fahrer-Eingrenzung. Einmal gefeuert, kann diese
SMS für diese Fahrt nie wieder feuern – selbst wenn `fahrzeugZuweisen` später `driverAckAt`
zurücksetzt und ein komplett neuer Fahrer ebenfalls nicht bestätigt. Das
"Fahrer-hat-nicht-bestätigt"-Sicherheitsnetz ist nach der ersten Eskalation für jede neu
zugewiesene Fahrt tot. Gleiches Muster bei `keinFahrzeugAlarmPruefen`.

### 9. [Mittel] Widersprüchliche Doppel-Push bei kombinierter Zeit+Fahrzeug(+Fahrer)-Verschiebung

`actions.ts:479-493` ruft `fahrtAendern` (schickt "Fahrt geändert" an den *aktuellen* Fahrer)
vor `fahrzeugZuweisen` (schickt "Fahrt entzogen" an denselben Fahrer, sobald ein Fahrerwechsel
erkannt wird). Der Push-Dedup aus Runde-1-Historie greift nur, wenn der Fahrer gleich bleibt – bei
einer Verschiebung, die gleichzeitig Zeit *und* Fahrzeug/Fahrer ändert, bekommt derselbe Fahrer
erst "geändert, App öffnen" und direkt danach "dir entzogen" für eine Aktion.

### 10. [Mittel] Serien (`RideSeries`) haben keine Bearbeiten/Vorzeitig-Stoppen-Funktion

Per Grep bestätigt: nur `serieAnlegen` und `serienVerlaengern` fassen eine `RideSeries`-Zeile an.
Kein Update-Template, keine Vorzeitig-Stopp-Funktion. Einzelne Termine lassen sich stornieren,
aber die Serie läuft aus dem bei Anlage eingefrorenen Template bis zum ursprünglichen `until`
weiter – das einzige Mittel, eine Serie wirklich früher zu beenden, ist jeden einzelnen künftigen
Termin manuell zu stornieren, Tag für Tag.

### 11. [Niedrig-mittel] Voice-Agent-Werkzeuge prüfen keine Fahrgast-Eigentümerschaft der `rideId`

**Fundort:** `src/core/voice/werkzeuge.ts:272-289` (`fahrt_aendern`/`fahrt_stornieren`).

Nehmen eine bloße `rideId` ohne serverseitige Prüfung, dass sie zum gerade identifizierten
Fahrgast gehört. Verlässt sich allein auf die Nicht-Erratbarkeit der cuid und die
Gesprächsdisziplin des Sprachmodells (zuerst `fahrt_finden` aufzurufen), nicht auf eine
erzwungene Prüfung.

## Geprüft und ausgeschlossen (Runde 2)

- `fahrtVerschieben` lässt eine Fahrt bei echtem `FahrzeugKonfliktError` dauerhaft in `ERFASST` –
  korrekt als `{ok:false, grund}` an den Dispatcher gemeldet, kein Bug, sondern Design.
- `serienVerlaengern` doppelt laufend bei überlappenden Cron-Ticks – idempotent durch
  `vorhandeneDaten`-Prüfung, bestätigt harmlos.
- `loeschfristen` löscht eine Hinfahrt unter einer gleichtägigen Rückfahrt weg oder bricht
  `seriesId`-Referenzen – beide altern in der Praxis zusammen, kein FK-Kaskaden-Problem gefunden.
- `driverAckAt`/`dispatchMode`-Veralterung bei erfolgreicher (nicht racender) Neuzuweisung –
  durchgängig korrekt zurückgesetzt in `fahrzeugZuweisen` und `fahrzeugZuweisungAufheben`.
- Fehlende, von einem Aufrufer benötigte Status-Übergänge – keine gefunden außer Fund 6.
- Mandantentrennung der vier neu geprüften Cron-Routen (eskalation, planFuerMorgen,
  serienVerlaengern, loeschfristen) – alle nutzen rohes `prisma` nur zum Aufzählen der Mandanten,
  `withTenant()` für jede mandantenbezogene Abfrage, passend zum in Runde 1 dokumentierten,
  bewussten Muster. Keine neue Mandanten-Leckage gefunden.

## Status Runde 2

Alle 11 Punkte: **offen**, noch nichts davon behoben (Stand 30.10.2026). Fund 1 und 2 sind
schwerer einzuschätzen als alles aus Runde 1 (stiller Datenfehler statt sichtbarem Crash) und
sollten vor einem erneuten „100/100"-Anspruch priorisiert werden.

---

# Runde 3 – Fahrer-App, Auth/Berechtigungen, Push-Lebenszyklus (Stand 30.10.2026)

Dritte Runde: Fokus auf die Fahrer-App (`src/app/fahrer/**`), Authentifizierung/Rollen
(`src/lib/auth.ts`), den Push-Subscription-Lebenszyklus und `fahrtStornieren`. Keine Überlappung
mit Runde 1/2.

**Verdikt Runde 3:** 11 weitere Funde, 3 davon schwer – ein Status-Automat-Ausbruch über die
Fahrer-Server-Action, ein TOCTOU, der dem *alten* Fahrer erlaubt, in die Fahrt des *neuen* Fahrers
zu schreiben, und ein Stornieren, das auch funktioniert, während der Fahrgast schon im Fahrzeug
sitzt.

### 1. [Kritisch] Fahrer kann über die Server-Action jeden beliebigen Status setzen, nicht nur die drei der UI

**Fundort:** `src/app/fahrer/actions.ts:72-94` (`fahrtStatusSetzenFahrer`), `src/core/rides/status.ts:11-22`.

Die Action nimmt `status: RideStatus` direkt vom Client entgegen, ohne Laufzeit-Whitelist – der
TypeScript-Typ schützt eine Server Action zur Laufzeit nicht. Einziger Schutz ist die
Eigentümerschaft (`driverId === fahrer.id`) plus die generische, rollenunabhängige
Übergangstabelle. Von `DISPONIERT` erlaubt diese Tabelle auch `ERFASST`, `PROBLEM`,
`STORNIERT` – nichts, was die UI je sendet, aber die Action führt es aus, wenn direkt
aufgerufen (trivial über Devtools). Konkret: ein Fahrer kann mit `"STORNIERT"` seine eigene Fahrt
komplett an `fahrtStornieren()` vorbei stornieren – keine "Fahrt entfällt"-Push, kein
`Notification`-Eintrag, der Dispatcher merkt nichts. Oder mit `"ERFASST"` eine bestätigte Fahrt
zurück in die Warteschlange werfen, während `vehicleId`/`driverId` auf der Fahrt kleben bleiben –
genau die Stale-Fahrzeug-Korruption aus Runde 2 (Fund 5, dort über Fahrerausfall), hier über einen
komplett anderen, fahrergesteuerten Weg erreichbar.

### 2. [Kritisch/Hoch] TOCTOU: Eigentümerprüfung und Schreiben sind getrennte, unskopierte DB-Aufrufe – der alte Fahrer kann in die Fahrt des neuen Fahrers schreiben

**Fundort:** `actions.ts:81-94,131-152,174-186,96-118`.

`fahrtStatusSetzenFahrer`, `problemMelden`, `gesehenBestaetigen`, `schichtAktion` prüfen
Eigentümerschaft per `findUnique`, dann folgt ein separater `update`, dessen `where` nur nach
`id` filtert, nie nach `driverId`, ohne Transaktion. `fahrzeugZuweisen` setzt bei Neuzuweisung
`driverId`/`driverAckAt` neu. Szenario: Dispatcher weist Fahrt R von Fahrer A zu Fahrer B neu, genau
während A's "Fahrgast abgeholt"-Anfrage ihre (veraltete) Eigentümerprüfung passiert hat. A's
Schreiben landet dann auf B's Fahrt: Status springt auf `AN_BORD`, B's Dispo-Board zeigt einen
Fortschritt, den B nie gemacht hat – und B's eigene erzwungene "Gesehen"-Vollbildsperre
(`GesehenUeberlagerung.tsx`) kann durch A's früheren `gesehenBestaetigen`-Aufruf genauso
umgangen werden.

### 3. [Hoch] Stornieren ist aus jedem Status erlaubt, auch `AN_BORD` (Fahrgast schon im Fahrzeug)

**Fundort:** `src/core/rides/stornieren.ts`, `status.ts:16-17`, `TripModal.tsx:85-93`,
`src/core/passengers/loeschung.ts:73`, `src/core/voice/werkzeuge.ts:287`.

`ERLAUBTE_UEBERGAENGE` erlaubt `UNTERWEGS→STORNIERT` und `AN_BORD→STORNIERT`. Drei Aufrufer ohne
Status-Sonderbehandlung: die generische "Sicher?"-Bestätigung im Dispo-UI, der
DSGVO-Löschungs-Pfad, und der **Voice-Agent** (ohne Status- und laut Runde 2 Fund 11 auch ohne
Eigentümerschafts-Prüfung – ein Telefonanruf könnte eine laufende Fahrt eines fremden Fahrgasts
stornieren). Einmal storniert, verschwindet die Fahrt beim nächsten Laden einfach aus der Liste
des Fahrers (`status: {notIn:["STORNIERT"]}`) – nur die generische "Fahrt entfällt"-Push, nichts
unterscheidet "vor Abholung storniert" von "Fahrgast sitzt gerade drin und die Fahrt verschwindet
einfach vom Handy".

### 4. [Hoch] Es gibt überhaupt keine Fahrer-Deaktivierung/Offboarding

Grep über die gesamte App auf `driver.delete`/Rollen-Update/„fahrerEntfernen" findet nichts außer
generierten Prisma-Kommentaren. `Driver` hat kein Aktiv/Gesperrt-Feld. Einziger Hebel ist
`fahrerGeraetAbmelden` (`src/app/dispo/fahrer/actions.ts:157-170`), das eine `Session`-Zeile
einzeln löscht und voraussetzt, dass der Admin die `sessionId` schon kennt. Bei 30 Tagen
Sitzungsdauer (`auth.ts:17`) hat ein gekündigter Fahrer vollen Zugriff – eigene Fahrten, Status,
GPS, Push – bis jedes einzelne Geräte-Session händisch gefunden und gelöscht wird.

### 5. [Mittel-hoch] Alle Push-Benachrichtigungen teilen denselben `tag` – eine zweite löscht die ungelesene erste lautlos

**Fundort:** `public/sw.js:63` (`tag: daten.tag || "fahrdienst-ki"`), kein Aufrufer von
`pushAnFahrer` übergibt je einen `tag`. Zwei Notifications mit gleichem Tag verschmelzen im
System-Tray zu einer – die neuere ersetzt die ältere, egal ob gelesen. Runde 2 Fund 9 zeigte schon
"Fahrt geändert" direkt gefolgt von "Fahrt entzogen" für denselben Fahrer bei kombinierter
Zeit+Fahrer-Änderung; mit dieser Tag-Kollision sieht der Fahrer die "entzogen"-Meldung
möglicherweise gar nicht erst, nicht nur in verwirrender Reihenfolge.

### 6. [Mittel] Rolle wird in `/fahrer`-Server-Actions nie erneut geprüft – nur "existiert eine Driver-Zeile"

**Fundort:** `actions.ts:12-19` (`eigenerFahrer`), `proxy.ts:42`.

Prüft nur Existenz der Driver-Zeile, nicht `role === "FAHRER"`. Das Rollen-Gate in `proxy.ts` ist
pfadbasierte Middleware und schützt die Server-Action-RPC selbst nicht zwangsläufig. Da keine
Stelle eine `Driver`-Zeile bei Rollenwechsel löscht/deaktiviert (per Grep bestätigt), behält
jeder ADMIN/DISPONENT mit einer übriggebliebenen Driver-Zeile aus der Zeit vor einer Beförderung
vollen Zugriff auf alle Funktionen in `fahrer/actions.ts`, inklusive `fahrerFaelltAus()`.

### 7. [Mittel] Offline-Warteschlange: Cross-Tab-Race sendet doppelt

**Fundort:** `src/app/fahrer/warteschlange.ts`, `OfflineSync.tsx:34,65-66`.

`localStorage` + eigenes In-Page-Event statt des Cross-Tab-`storage`-Events; der
"sendetGerade"-Schutz gilt nur pro Tab. Zwei offene Tabs/Geräte für denselben Fahrer können
denselben wartenden Eintrag beide lesen, bevor einer ihn entfernt – doppeltes Senden. Für
`problemMelden` nicht idempotent (pusht nur auf `problems[]`), verdoppelt also z. B. eine
"Verspätung +10 Min"-Meldung.

### 8. [Mittel] GPS-Meldung hängt am Vordergrund-Tab – der eigene Navigations-Button schickt ihn in den Hintergrund

**Fundort:** `GpsTracking.tsx:28`, `FahrerClient.tsx:150-152,293-300` (`window.open` zu Google
Maps). Der Navigations-Button öffnet Google Maps extern – genau dann, wenn der Fahrer tatsächlich
fährt, geht der PWA-Tab in den vom Mobilbrowser gedrosselten Hintergrund. GPS kann exakt dann über
das 10-Minuten-Fenster veralten, wenn es am wichtigsten wäre (sicherer Fehlschlag, aber bricht das
Feature im häufigsten echten Nutzungsmuster).

### 9. [Mittel] Dauerhafte Fehler werden wie Verbindungsabbrüche behandelt und dann lautlos verworfen

**Fundort:** `FahrerClient.tsx:132-182`, `OfflineSync.tsx:50-53`.

Optimistisches UI-Update vor dem Server-Aufruf; jeder Fehler (auch die Eigentümerschaftsablehnung
aus Fund 2, oder ein ungültiger Übergang) landet in derselben Offline-Retry-Queue wie ein echter
Netzwerkausfall. Nach einem weiteren Versuch wird der Eintrag einfach entfernt – eine echte
Ablehnung bekommt einen Retry und wird dann verworfen, das optimistische UI wird nie
zurückgerollt, der Fahrer erfährt nichts.

### 10. [Niedrig-mittel] Service-Worker-Cache mit Fahrgast-PII kann die vorgesehene Ein-Tages-Frist überleben

**Fundort:** `public/sw.js:7-9,12-18,38`. Cache nach lokalem Kalendertag geschlüsselt, wird aber
nur bei einem tatsächlichen `fetch`/`activate`-Event bereinigt. Ein über Mitternacht offline
bleibendes Gerät (Nachtschicht) behält den gestrigen Fahrgast-PII-Cache über die in
`docs/08-datenschutz-sicherheit.md` vorgesehene Ein-Tages-Frist hinaus.

### 11. [Niedrig] Push-Anmeldung hat keine Fehlerbehandlung für die (bewusst korrekte) Mandanten-Kollisionsprüfung

**Fundort:** `src/lib/db.ts:75-96` (Upsert-Schutz wirft korrekt bei fremdem Mandanten für
denselben Endpoint), `PushAktivieren.tsx:41-65` (kein try/catch). Der Wurf wird zur unbehandelten
Promise-Ablehnung, der Zustand erreicht nie `"aktiv"`, und da der Browser den Endpoint schon hält,
wiederholt jeder weitere Klick denselben Fehler – der Fahrer bleibt auf diesem Gerät dauerhaft
ohne Push, ohne jede Fehlermeldung.

## Geprüft und ausgeschlossen (Runde 3)

- GPS-Frische-Bedingung schlägt bei fehlenden/veralteten Daten korrekt fehl und basiert auf
  einem serverseitigen Zeitstempel – kein Client-Zeitstempel-Vertrauensproblem.
- Push-404/410-Bereinigung löscht korrekt nur die tote Subscription-Zeile, Geschwistergeräte
  bleiben unberührt – keine Geister-Subscription.
- Mehrgeräte-Push funktioniert korrekt.
- `vehicleId`/`driverId` nach `fahrtStornieren` bleiben stehen, aber harmlos (Konfliktprüfung
  schließt `STORNIERT`/`ERLEDIGT` explizit aus) – anders als der `fahrerAusfall`-Fall aus Runde 2.
- Doppelte GPS-Zeilen durch zwei gleichzeitig offene Tabs – harmlos, nur die neueste `at` wird
  gelesen.
- Kein client-seitig übergebener `tenantId`-Parameter in irgendeiner geprüften Action gefunden –
  keine neue Mandanten-Leckage über Runde 1 hinaus.

## Status Runde 3

Alle 11 Punkte: **offen**, noch nichts davon behoben (Stand 30.10.2026). Insgesamt jetzt
**29 offene Punkte** über drei Runden.
