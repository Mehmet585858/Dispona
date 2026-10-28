# 12 – Betrieb (Phase 12)

Einfache Schritte für die alltäglichen Aufgaben im laufenden Betrieb – kein Entwickler-Wissen
nötig. Für alles, was hier nicht steht, gilt wie immer: Claude Code fragen.

**Hosting (Stand heute):** Vercel (die App selbst) + Neon (die Postgres-Datenbank). Jeder `git
push` auf den Branch `master` baut automatisch neu und spielt die neue Version live – kein
manueller Schritt nötig.

---

## 1. Update einspielen

Ein "Update" ist bei uns einfach ein Commit, den Claude Code auf `master` pusht – das passiert
im normalen Arbeiten automatisch. Zwei Dinge musst du selbst im Blick behalten:

1. **Datenbank-Änderungen.** Wenn sich das Datenmodell ändert (neue Tabelle, neues Feld), muss
   die Migration einmal gegen die echte Produktions-Datenbank laufen. Das übernimmt Claude Code
   für dich, wenn du danach fragst – es braucht dafür die echte `DATABASE_URL` aus den
   Vercel-Umgebungsvariablen (Project Settings → Environment Variables → Production).
2. **Neue Umgebungsvariable.** Taucht eine neue Variable in `.env.example` auf (z. B. heute
   `SENTRY_DSN`), musst du sie auch bei Vercel eintragen (Project Settings → Environment
   Variables), sonst bleibt die neue Funktion dort aus, bis du es nachholst.

**Falls ein Update etwas kaputt gemacht hat:** Bei Vercel unter "Deployments" den vorherigen,
funktionierenden Stand suchen und "Promote to Production" klicken – das macht die Seite sofort
wieder lauffähig, ohne dass Claude Code etwas reparieren muss. Datenbank-Änderungen macht das
aber nicht rückgängig (siehe Abschnitt 2, falls das nötig wird).

---

## 2. Backup zurückholen

Neon sichert die Datenbank automatisch fortlaufend (kein täglicher Cron-Job nötig). Wie lange du
zurück kannst, hängt von deinem Neon-Tarif ab (kostenlos meist 24 Stunden, bezahlte Tarife
mehrere Tage bis 30 Tage) – das einmal im Neon-Dashboard unter **Backups** oder **Branches**
prüfen, damit du weißt, wie viel Spielraum du hast.

So kommst du an einen alten Stand:
1. Im Neon-Dashboard das Projekt öffnen → **Branches** → **Restore** (oder "Create branch from
   past state").
2. Zeitpunkt wählen (z. B. "vor 2 Stunden", bevor etwas schiefging).
3. Neon legt daraus eine neue, separate Kopie der Datenbank an – die echte Datenbank bleibt dabei
   unberührt, du kannst also in Ruhe nachschauen, ob der Stand der richtige ist.
4. Passt der Stand: entweder den alten Branch zum neuen Hauptstand machen ("Set as default"/
   "Promote"), oder gezielt nur die betroffenen Zeilen von dort in die echte Datenbank
   zurückkopieren (für Letzteres Claude Code dazuholen, das ist kein Klick mehr).

**Wichtig:** Ein Backup zurückzuholen betrifft *alle* Kunden (Mandanten) gleichzeitig, nicht nur
einen. Bevor du etwas zurückholst, kurz überlegen, ob seit dem gewünschten Zeitpunkt andere Kunden
schon wieder neue, echte Daten eingetragen haben, die du dann verlieren würdest.

---

## 3. Neuen Kunden (Fahrdienst) anlegen

Kein Datenbank-Zugriff nötig – es gibt dafür eine eigene Seite:

1. Auf `/registrieren` gehen (z. B. `https://app.dispona.de/registrieren`).
2. Firmenname, Vor-/Nachname und Handynummer der ersten Ansprechperson sowie deren E-Mail-Adresse
   eintragen.
3. Das legt automatisch eine neue, von allen anderen Kunden komplett getrennte Firma
   („Mandant") mit einem ersten Admin-Zugang an.
4. Diese Person meldet sich danach ganz normal über `/anmeldung` mit ihrer E-Mail-Adresse an
   (Einmal-Code kommt per E-Mail) und landet automatisch im Einrichtungsassistenten
   (`/einrichtung`), der sie durch alles Weitere führt (Rufumleitung, Fahrzeuge, Fahrer, Testanruf).

Eine zweite Anmeldung mit derselben E-Mail-Adresse ist nicht möglich (Fehlermeldung: schon
registriert) – die Person soll dann stattdessen `/anmeldung` benutzen.

---

## 4. Was tun bei Alarm

Alarme kommen per SMS an die Nummer, die beim jeweiligen Kunden unter „Alarm-Rufnummer"
hinterlegt ist (`alertPhone` in den Einstellungen). Es gibt drei Arten:

| SMS-Text (sinngemäß) | Bedeutung | Was tun |
| --- | --- | --- |
| „Fahrer hat Fahrt nicht bestätigt" | Ein Fahrer hat eine ihm zugewiesene Fahrt nicht in der App bestätigt, es ist nachts und die Fahrt beginnt in unter einer Stunde | Fahrer anrufen, ggf. manuell auf `/dispo` ein anderes Fahrzeug zuweisen |
| „Für Fahrt X ist noch kein Fahrzeug gefunden" | In den nächsten 2 Stunden gibt es keine passende Fahrzeug-/Fahrer-Kombination für eine Fahrt | Auf `/dispo` unter „Hinweis" nachschauen, manuell ein Fahrzeug finden oder die Fahrt verschieben/stornieren |
| (an den Fahrer selbst, nicht an dich) „Neue Fahrt ... Bitte App öffnen" | Normale Erinnerung an den Fahrer, keine Aktion deinerseits nötig, außer er reagiert gar nicht (siehe oben) |

Bei allen drei gilt: Die Fahrt selbst ist nie „verloren" – sie steht weiter im System, nur eben
ohne bestätigte Zuweisung. Du kannst sie auf `/dispo` jederzeit manuell bearbeiten.

**Fehler-Alarm (technisch, ab heute):** Läuft irgendwo im Programm selbst ein Fehler auf (nicht
ein Dispositions-Alarm, sondern ein echter Programmfehler), landet der automatisch bei Sentry
(siehe Abschnitt 5) – dort siehst du, wie oft und wo genau, ohne dass Fahrgastdaten mitgeschickt
werden. Richte dort unter **Alerts** am besten eine E-Mail- oder Slack-Benachrichtigung ein, sonst
siehst du Fehler erst, wenn du selbst ins Sentry-Dashboard schaust.

---

## 5. Fehler-Monitoring (Sentry) einrichten

Der Code dafür ist bereits eingebaut, läuft aber erst, wenn du einmal ein Sentry-Konto verbindest
(das kann nur du selbst machen – Kontoerstellung bei einem Fremdanbieter mache ich nicht für dich):

1. Auf [sentry.io](https://sentry.io) ein kostenloses Konto anlegen. **Wichtig:** bei der
   Organisations-Erstellung die **EU-Region (Frankfurt)** wählen, nicht die US-Region – das lässt
   sich danach nicht mehr ändern.
2. Ein neues Projekt anlegen, Plattform „Next.js" wählen.
3. Die angezeigte DSN (eine lange `https://...@...ingest.de.sentry.io/...`-Adresse) kopieren.
4. Bei Vercel unter Project Settings → Environment Variables eintragen:
   - `SENTRY_DSN` = diese DSN
   - `NEXT_PUBLIC_SENTRY_DSN` = dieselbe DSN noch einmal
   - Optional, für lesbare Fehlermeldungen statt kryptischem Build-Code: `SENTRY_ORG`,
     `SENTRY_PROJECT` (beide stehen in der Sentry-Projekt-URL) und `SENTRY_AUTH_TOKEN`
     (Sentry → Settings → Auth Tokens, Berechtigung „project:releases").
5. Einmal neu deployen (z. B. "Redeploy" in Vercel klicken) – danach landen echte Fehler im
   Sentry-Dashboard.

Bewusst **nicht** mitgeschickt werden: IP-Adressen, Cookies, Formulardaten, Datenbank-Inhalte und
Variablenwerte aus dem Code – so bleiben keine Fahrgastdaten in Sentry hängen (siehe
`src/sentry.server.config.ts`).

---

## 6. Wichtige Zugänge auf einen Blick

| Was | Wo |
| --- | --- |
| App-Hosting, Umgebungsvariablen, Deployments zurückrollen | Vercel-Dashboard |
| Datenbank, Backups/Zeitreise | Neon-Dashboard |
| Fehler-Monitoring | Sentry-Dashboard (nach Einrichtung, siehe Abschnitt 5) |
| Telefonie (Vapi) | Vapi-Dashboard – siehe `docs/04a-vapi-notizen.md` |
| Code-Repository | GitHub (`Mehmet585858/Dispona`) |
