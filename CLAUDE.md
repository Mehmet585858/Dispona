# Fahrdienst-KI – Projektregeln für Claude Code

Diese Datei liest Claude Code bei jedem Start. Sie gilt für das ganze Projekt.

## Worum es geht

Eine Komplettlösung für Krankenfahrdienste in Deutschland, **ohne fremde Dispo-Software**:

1. **KI am Telefon** nimmt Anrufe an, erfasst und prüft Fahrten, erkennt Stammkunden.
2. **Eigene Disposition** schlägt das passende Fahrzeug vor (tagsüber bestätigt der Disponent mit einem Klick) und plant eindeutige Fälle nachts und am Wochenende selbst (Automodus).
3. **Eigene Fahrer-App** (PWA): Fahrer bekommen ihre Fahrten aufs Handy, melden Status, senden GPS.

DMRZ und andere Abrechnungssoftware sind im Pilot **nicht angebunden**. Für die Abrechnung gibt es einen Export als Datei. Eine Anbindung kommt später (`docs/07-adapter.md`).
Mehrere Fahrdienste nutzen dieselbe Plattform (mandantenfähig).

Ausführlich: `docs/01-produkt.md`. Bauplan mit Reihenfolge: `docs/09-bauplan.md`.

## Wer das Projekt steuert

Der Auftraggeber ist Marketing-Profi, kein Entwickler. Deshalb:

- Erkläre jeden Schritt in einfachem Deutsch, ohne Fachjargon. Wenn ein Fachbegriff nötig ist, erkläre ihn in einem Halbsatz.
- Sag am Ende jeder Aufgabe in 3–5 Sätzen: was gebaut wurde, wie man es ausprobiert, was als Nächstes kommt.
- Frag nach, bevor du etwas tust, das Geld kostet (kostenpflichtige Dienste, Telefonnummern, Server) oder Daten löscht.
- Lege niemals echte Zugangsdaten (API-Schlüssel, Passwörter) in Dateien ab, die ins Git kommen. Nur in `.env`, und `.env` steht in `.gitignore`.

## Technik (fest, nicht ohne Rückfrage ändern)

| Baustein             | Wahl                                                                                                                                                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprache              | TypeScript, strikt (`strict: true`)                                                                                                                                                                                                                                                 |
| Web-App und API      | Next.js (App Router), eine App für Einrichtung, Disposition und Fahrer-App                                                                                                                                                                                                          |
| Datenbank            | PostgreSQL mit Prisma                                                                                                                                                                                                                                                               |
| Oberfläche           | Tailwind CSS, eigene kleine Komponenten (siehe `docs/06-oberflaeche.md`)                                                                                                                                                                                                            |
| Anmeldung            | E-Mail mit Einmal-Code (Better Auth) für Büro; Fahrer per Einmal-Link; Rollen: ADMIN, DISPONENT, FAHRER. **Geändert am 26.10.2026:** Bauplan sah Auth.js vor; Auth.js ist laut eigener Aussage (authjs.dev) inzwischen in Better Auth aufgegangen. Mit dem Auftraggeber abgestimmt. |
| Voice-Agent          | über eine austauschbare Schnittstelle `VoiceProvider`; erster Anbieter: Vapi (siehe `docs/04-voice-agent.md`)                                                                                                                                                                       |
| Routing / Fahrzeiten | über Schnittstelle `RoutingProvider`; erster Anbieter: OpenRouteService, später Google oder HERE                                                                                                                                                                                    |
| Fahrer-App           | Progressive Web-App (PWA) im selben Projekt unter `/fahrer`, mit Push-Benachrichtigungen                                                                                                                                                                                            |
| Karte                | Leaflet + OpenStreetMap                                                                                                                                                                                                                                                             |
| Tests                | Vitest für Logik, Playwright für die wichtigsten Klickwege                                                                                                                                                                                                                          |
| Hosting              | nur Server in der EU (Details in `docs/08-datenschutz-sicherheit.md`)                                                                                                                                                                                                               |

Vor dem Einsatz einer Bibliothek oder eines externen Dienstes: aktuelle Doku prüfen, nicht aus dem Gedächtnis programmieren.

## Ordnerstruktur

```
src/
  app/                 Next.js-Seiten
    (auth)/            Anmeldung
    einrichtung/       Einrichtungsassistent (8 Schritte)
    dispo/             Disponenten-Oberfläche
    fahrer/            Fahrer-App (PWA)
    api/               Webhooks und interne API
  core/                Fachlogik, unabhängig von Next.js
    disposition/       Fahrzeugwahl, Planung, Automodus
    rides/             Fahrten, Serien, Prüfungen, Status
    passengers/        Fahrgäste, Abgleich
    notify/            Push und SMS an Fahrer und Inhaber
  providers/           Anbindungen an externe Dienste
    voice/             VoiceProvider + Vapi
    routing/           RoutingProvider + OpenRouteService
    telephony/         Rufnummern, Weiterleitung
    sms/               SmsProvider
  adapters/            (später) Anbindung an Abrechnungssoftware; im Pilot nur Datei-Export
  lib/                 Hilfsfunktionen (db, auth, logging, crypto)
prisma/                schema.prisma, Migrationen, Seed
docs/                  Spezifikation (nicht ändern ohne Auftrag)
tests/
```

## Regeln für den Code

- Fachlogik gehört nach `src/core/` und hat Tests. Seiten und API-Routen rufen nur `core/` auf.
- Jede Datenbankabfrage filtert nach `tenantId`. Nutze dafür die Hilfsfunktion `withTenant()` aus `src/lib/db.ts`; nie direkt `prisma.ride.findMany()` ohne Mandant.
- Externe Dienste nur über ihre Schnittstelle in `providers/` ansprechen, damit Anbieter austauschbar bleiben.
- Gesundheitsnahe Daten (Fahrgast, Fahrten, Gesprächsprotokolle) nie in Logs, Push-Texten oder SMS. Logs enthalten nur IDs; Push/SMS an Fahrer nur Uhrzeit und Ort, kein Name.
- Alle Texte der Oberfläche auf Deutsch, in kurzer, freundlicher Sprache (Sie-Form). Texte in `src/app/**/texte.ts` sammeln, nicht im Code verstreuen.
- Uhrzeiten intern in UTC speichern, in der Oberfläche in `Europe/Berlin` anzeigen. Datum/Zeit-Rechnung (Wochenstart, "heute", Uhrzeiten setzen) immer über `src/core/shifts/week.ts` – nie `new Date()` direkt mit `setHours()`/`toISOString()` mischen, das ist je nach Server-Zeitzone falsch (siehe Tests in `tests/shifts-week.test.ts`).
- Next.js 16 "Cache Components" (`cacheComponents` in `next.config.ts`) ist **bewusst ausgeschaltet**: Abgebrochene Prerender-Versuche haben die Datenbankverbindung lahmgelegt und auf fast jeder angemeldeten Seite Entwicklungs-Fehler ausgelöst, ohne uns Vorteile zu bringen (jede Seite prüft ohnehin zuerst die Anmeldung). Nicht ohne Rückfrage wieder einschalten.
- Kleine Schritte: pro Aufgabe nur das Nötige ändern. Nach jeder Aufgabe `npm run lint`, `npm run typecheck` und `npm test` ausführen; erst bei grün ist die Aufgabe fertig.
- Lokale Datenbank (`npx prisma dev`): Die Schattendatenbank für `prisma migrate dev` gerät gelegentlich in einen kaputten Zustand ("type X already exists" beim Validieren). Workaround: `npx prisma db push`, um das Schema direkt zu übernehmen, dann die Migrations-SQL von Hand in `prisma/migrations/<zeitstempel>_<name>/migration.sql` anlegen und mit `npx prisma migrate resolve --applied <name>` als angewendet markieren. Bei "Lock file is already being held": die Datei(en) unter `%LOCALAPPDATA%\prisma-dev-nodejs\Data\durable-streams\fahrdienst-ki\server.lock*` löschen und `npx prisma dev --name fahrdienst-ki -d` erneut starten.
- **Nach jedem `npx prisma generate`** (z. B. nach einer Schema-Änderung) UND bei "Connection terminated unexpectedly" oder "Unknown field X" trotz korrektem Schema: nicht nur den Dev-Server neu starten, sondern **zuerst den Ordner `.next/` löschen**. Turbopack cacht kompilierte Chunks auf der Festplatte und lädt sonst eine veraltete Fassung des generierten Prisma-Clients, auch über einen Server-Neustart hinweg. Reihenfolge: Server stoppen → `.next/` löschen → `npm run dev` neu starten.

## Befehle

- `npm run dev` – App lokal starten (http://localhost:3000)
- `npm test` – Tests
- `npm run lint` und `npm run typecheck`
- `npx prisma migrate dev` – Datenbank anpassen
- `npm run seed` – Beispieldaten laden (Firma "Muster Krankenfahrten", 5 Fahrzeuge, 4 Fahrer mit Schichten, 2 Disponenten, 10 Fahrgäste, 10 Fahrten)

## Was die KI am Telefon nie tut

- Keine medizinische Beratung oder Einschätzung.
- Bei Notfall-Stichworten (Atemnot, Brustschmerz, bewusstlos, Unfall …): Hinweis auf 112 und sofort an einen Menschen weiterleiten.
- Keine verbindliche Abholzeit nennen, solange die Fahrt nicht disponiert ist.

## Was der Automodus nie tut

- Disponieren, wenn eine Sicherheitsbedingung verletzt ist (`docs/05-disposition.md`).
- Fahrten stornieren oder Fahrgästen absagen – das bleibt beim Menschen.
- Eine Fahrt einem Fahrer geben, der nicht im Dienst ist oder Pause hat.
