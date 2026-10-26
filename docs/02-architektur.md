# 02 – Architektur

## Grundidee

Ein **Kern**, der für alle Kunden gleich ist (Annahme, Disposition, Fahrer-App), plus **austauschbare Anbindungen**:

- **Provider** = externe technische Dienste (Voice-KI, Routing, Telefonie, SMS).
- **Adapter** = Abrechnungssoftware des Fahrdienstes (später; im Pilot nur Datei-Export).

```
Anrufer ──Telefon──▶ VoiceProvider (Vapi) ──Webhook/Tools──▶ API (/api/voice/*)
                                                               │
Disponent ◀──Web──▶ /dispo ─────────▶ core/ ◀──────────────────┘
                                      ├─ rides/        Fahrten, Status, Serien
                                      ├─ passengers/   Fahrgäste
                                      ├─ disposition/  Vorschlag, Automodus, Plan für morgen
                                      └─ notify/       Push, SMS
                                           │        │
                                           ▼        ▼
                                     PostgreSQL   RoutingProvider (Fahrzeiten, Geocoding)
                                           │
Fahrer ◀──PWA + Push──▶ /fahrer ◀──────────┘   (Status, GPS zurück)

Abrechnung: Export CSV/Excel  (später: adapters/dmrz u. a.)
```

## Ablauf einer Bestellung per Telefon

1. Anruf kommt bei der Nummer des Fahrdienstes an (Rufumleitung) → VoiceProvider.
2. VoiceProvider ruft `POST /api/voice/assistant-request` auf: Wir liefern je nach angerufener Nummer den passenden Mandanten, Begrüßung, Stimme, Anweisungen (`docs/04-voice-agent.md`).
3. Während des Gesprächs ruft die KI unsere Werkzeuge auf (`/api/voice/tools`): Fahrgast suchen, Adresse prüfen, Fahrt anlegen, an Menschen weiterleiten.
4. Fahrt wird als `Ride` mit Status `ENTWURF` → nach Bestätigung im Gespräch `ERFASST` gespeichert.
5. `core/disposition` berechnet sofort bis zu 3 Fahrzeugvorschläge (`Suggestion`), Status `VORGESCHLAGEN`.
6. **Automodus aktiv und alle Sicherheitsbedingungen erfüllt** → Fahrt wird automatisch disponiert. **Sonst** erscheint sie beim Disponenten unter „Bitte bestätigen“; er bestätigt mit einem Klick oder wählt ein anderes Fahrzeug.
7. Status `DISPONIERT` → Push an den Fahrer, Fahrt erscheint in der Fahrer-App.
8. Fahrer meldet „Losgefahren“ → „Fahrgast an Bord“ → „Erledigt“, GPS läuft mit; Disponent sieht alles live.
9. Gesprächsende: VoiceProvider schickt den End-of-Call-Bericht (Transkript, Dauer) → `Call` wird gespeichert und an die Fahrt gehängt.
10. Erledigte Fahrten landen im Abrechnungs-Export.

## Schnittstellen (TypeScript)

```ts
// src/providers/voice/types.ts
export interface VoiceProvider {
  name: string;
  verifyWebhook(req: Request): Promise<boolean>;          // Signatur prüfen
  buildAssistantConfig(tenant: TenantVoiceSettings): unknown; // Anbieter-spezifisches Format
  parseToolCall(body: unknown): ToolCall[];
  formatToolResult(results: ToolResult[]): unknown;
  parseEndOfCall(body: unknown): CallReport | null;
  transferCall?(callId: string, toNumber: string): Promise<void>;
}

// src/providers/routing/types.ts
export interface RoutingProvider {
  geocode(query: string, near?: LatLng): Promise<GeocodeResult[]>;
  travelTimeMinutes(from: LatLng, to: LatLng, departAt: Date): Promise<number>;
  matrix(from: LatLng[], to: LatLng[], departAt: Date): Promise<number[][]>; // Minuten
}

// src/providers/sms/types.ts
export interface SmsProvider {
  send(toE164: string, text: string): Promise<{ id: string }>;
}
```

## Fahrer-App und Benachrichtigung

- PWA unter `/fahrer`, installierbar auf Android und iPhone („Zum Home-Bildschirm“).
- **Web-Push** (Service Worker + VAPID-Schlüssel) für neue und geänderte Fahrten, mit Ton. Auf dem iPhone funktioniert Web-Push nur, wenn die App zum Home-Bildschirm hinzugefügt wurde – der Einladungs-Link führt Schritt für Schritt dahin.
- **SMS als Rückfall**, wenn Push nicht bestätigt wird (nach 2 Minuten) oder nicht eingerichtet ist. Text nur „Neue Fahrt 09:40 Baesweiler → Aachen. Bitte App öffnen.“ – ohne Namen.
- Fahrer bestätigt jede neue Fahrt mit „Gesehen“. Ohne Bestätigung nach 5 Minuten: Hinweis beim Disponenten (nachts: SMS an Inhaber, wenn die Fahrt in weniger als 60 Minuten beginnt).
- Offline-fähig: Fahrten des Tages zwischengespeichert, Statusmeldungen werden bei Funkloch nachgesendet.

## Mandantenfähigkeit

- Jede Tabelle mit Kundendaten hat `tenantId`.
- `withTenant(tenantId)` in `src/lib/db.ts` gibt einen Prisma-Client zurück, der jede Abfrage automatisch nach `tenantId` filtert (Prisma Client Extension).
- Der Mandant kommt aus der Sitzung (Web) oder aus der angerufenen Rufnummer (Voice-Webhook).
- Ein Test prüft: Daten von Mandant A sind für Mandant B nie sichtbar.

## Hintergrundaufgaben

Einfach halten: eine Tabelle `Job` + ein Cron-Endpunkt (`/api/cron/*`, durch Secret geschützt), aufgerufen jede Minute.

- Offene Vorschläge neu berechnen, wenn sich Fahrzeugpositionen stark ändern oder ein Fahrer Verspätung meldet
- Automodus: offene Fahrten im Zeitfenster prüfen und eindeutige disponieren
- Fahrer-Bestätigungen überwachen (Push → SMS → Hinweis)
- Serienfahrten für die nächsten 14 Tage erzeugen, „Plan für morgen“ (Standard 18:00)
- Löschfristen anwenden (nachts)

## Konfiguration (.env)

```
DATABASE_URL=
AUTH_SECRET=
EMAIL_SERVER=            # für Einmal-Codes
VAPI_API_KEY=
VAPI_WEBHOOK_SECRET=
ORS_API_KEY=             # OpenRouteService
SMS_API_KEY=             # SMS-Anbieter (EU)
VAPID_PUBLIC_KEY=        # Web-Push
VAPID_PRIVATE_KEY=
ENCRYPTION_KEY=          # 32 Byte, für Transkripte
CRON_SECRET=
APP_URL=
```

Für jede Variable eine Zeile in `.env.example` mit Erklärung.
