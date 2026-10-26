# 03 – Datenmodell

Vorlage für `prisma/schema.prisma`. Claude Code darf Felder ergänzen, wenn eine Phase es braucht, und vermerkt das hier.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id            String   @id @default(cuid())
  name          String
  street        String?
  zip           String?
  city          String?
  phoneNumbers  PhoneNumber[]
  settings      TenantSettings?
  setupStep     Int      @default(1)   // Einrichtungsassistent: aktueller Schritt 1–8
  setupDoneAt   DateTime?
  createdAt     DateTime @default(now())
  users         User[]
  vehicles      Vehicle[]
  drivers       Driver[]
  passengers    Passenger[]
  places        Place[]
  rides         Ride[]
  series        RideSeries[]
  calls         Call[]
  integration   Integration?
}

model TenantSettings {
  tenantId          String  @id
  tenant            Tenant  @relation(fields: [tenantId], references: [id])
  aiActive          Boolean @default(false)    // Schalter "KI nimmt Anrufe an"
  aiSchedule        Json?                      // z. B. nur nachts/Wochenende
  greeting          String                     // Begrüßungstext
  voiceId           String                     // gewählte Stimme beim VoiceProvider
  escalationNumber  String                     // Weiterleitung an Menschen
  openingHours      Json
  serviceAreaCenter Json                       // {lat,lng}
  serviceAreaKm     Int     @default(30)
  depotAddress      Json?                      // Betriebshof {street,zip,city,lat,lng} – Startpunkt für Vorschläge
  autoMode          AutoMode @default(AUS)     // automatisch disponieren
  autoModeSchedule  Json?                      // z. B. {"weekdays":"18:00-07:00","weekend":"ganztags"}
  autoModeMinMargin Int     @default(5)        // Abstand bester zu zweitbestem Vorschlag
  autoModeMaxDaysAhead Int  @default(3)
  requireDocsForAuto Boolean @default(true)    // Automodus nur, wenn Transportschein/Genehmigung nicht UNKLAR
  driverAckMinutes  Int     @default(5)        // Zeit für "Gesehen" in der Fahrer-App
  alertPhone        String?                    // SMS an Inhaber/Bereitschaft
  alertEmail        String?
  exportTemplate    Json?                      // Spaltenvorlage Abrechnungs-Export
  audioRetentionDays Int    @default(30)
  dataRetentionDays  Int    @default(3650)     // nach Vorgabe des Kunden
}

model PhoneNumber {
  id        String @id @default(cuid())
  tenantId  String
  tenant    Tenant @relation(fields: [tenantId], references: [id])
  e164      String @unique        // Nummer, unter der die KI erreichbar ist
  provider  String                // z. B. "vapi", "twilio", "sipgate"
  providerId String?
}

enum AutoMode { AUS NACHTS_WOCHENENDE IMMER }

enum Role { ADMIN DISPONENT FAHRER }

model User {
  id        String  @id @default(cuid())
  tenantId  String
  tenant    Tenant  @relation(fields: [tenantId], references: [id])
  email     String? @unique
  phone     String?
  name      String
  role      Role
  driver    Driver?
}

enum TransportType { SITZEND ROLLSTUHL TRAGESTUHL LIEGEND }

model Vehicle {
  id              String  @id @default(cuid())
  tenantId        String
  tenant          Tenant  @relation(fields: [tenantId], references: [id])
  plate           String                 // Kennzeichen
  seats           Int     @default(4)
  wheelchairSpots Int     @default(0)
  carryChair      Boolean @default(false) // Tragestuhl
  stretcher       Boolean @default(false) // liegend
  active          Boolean @default(true)
  externalId      String?                // ID in DMRZ o. Ä.
  locations       VehicleLocation[]
  rides           Ride[]
  shifts          Shift[]
  @@unique([tenantId, plate])
}

model Driver {
  id        String  @id @default(cuid())
  tenantId  String
  tenant    Tenant  @relation(fields: [tenantId], references: [id])
  userId    String  @unique
  user      User    @relation(fields: [userId], references: [id])
  shifts    Shift[]
  pushSubscriptions PushSubscription[]
  gpsConsentAt DateTime?
}

model PushSubscription {   // Web-Push der Fahrer-App (ein Eintrag je Gerät)
  id        String   @id @default(cuid())
  tenantId  String
  driverId  String
  driver    Driver   @relation(fields: [driverId], references: [id])
  endpoint  String   @unique
  keys      Json
  createdAt DateTime @default(now())
  lastOkAt  DateTime?
}

model Shift {          // wer fährt wann welches Fahrzeug
  id        String   @id @default(cuid())
  tenantId  String
  driverId  String
  driver    Driver   @relation(fields: [driverId], references: [id])
  vehicleId String
  vehicle   Vehicle  @relation(fields: [vehicleId], references: [id])
  start     DateTime            // geplant
  end       DateTime
  startedAt DateTime?           // in der App gestartet
  endedAt   DateTime?
  onBreak   Boolean  @default(false)
  unavailable Boolean @default(false) // "Ich falle aus"
}

model VehicleLocation {
  id        String   @id @default(cuid())
  tenantId  String
  vehicleId String
  vehicle   Vehicle  @relation(fields: [vehicleId], references: [id])
  lat       Float
  lng       Float
  at        DateTime @default(now())
  @@index([vehicleId, at])
}

model Passenger {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  firstName   String
  lastName    String
  birthDate   DateTime?
  phones      String[]               // E.164, zur Wiedererkennung
  insurer     String?                // Krankenkasse
  notes       String?                // nur organisatorisch, keine Diagnosen
  homePlaceId String?
  externalId  String?
  rides       Ride[]
  approvals   Approval[]
  @@index([tenantId, lastName])
}

enum PlaceType { WOHNUNG PRAXIS KLINIK DIALYSE PFLEGEHEIM SONSTIGES }

model Place {
  id        String    @id @default(cuid())
  tenantId  String
  tenant    Tenant    @relation(fields: [tenantId], references: [id])
  label     String               // "Dialysezentrum Aachen"
  street    String
  zip       String
  city      String
  lat       Float
  lng       Float
  type      PlaceType
  usageCount Int      @default(0)   // für Vorschläge im Gespräch
}

enum DocStatus { JA NEIN UNKLAR NICHT_NOETIG }

model Approval {        // Genehmigung der Kasse, v. a. für Serien
  id          String   @id @default(cuid())
  tenantId    String
  passengerId String
  passenger   Passenger @relation(fields: [passengerId], references: [id])
  validFrom   DateTime
  validUntil  DateTime
  maxRides    Int?
  reference   String?           // Aktenzeichen o. Ä.
}

// ENTWURF → ERFASST → VORGESCHLAGEN → DISPONIERT → UNTERWEGS → AN_BORD → ERLEDIGT
// jederzeit möglich: PROBLEM, STORNIERT; NICHT_ANGETROFFEN nach UNTERWEGS
enum RideStatus { ENTWURF ERFASST VORGESCHLAGEN DISPONIERT UNTERWEGS AN_BORD ERLEDIGT NICHT_ANGETROFFEN STORNIERT PROBLEM }
enum RideSource { ANRUF MANUELL IMPORT SERIE }

model Ride {
  id              String        @id @default(cuid())
  tenantId        String
  tenant          Tenant        @relation(fields: [tenantId], references: [id])
  passengerId     String
  passenger       Passenger     @relation(fields: [passengerId], references: [id])
  pickupPlaceId   String
  dropoffPlaceId  String
  pickupAt        DateTime              // gewünschte Abholzeit
  appointmentAt   DateTime?             // Termin am Ziel
  transportType   TransportType
  companion       Boolean   @default(false)
  assistanceNotes String?               // "Hilfe bis zur Wohnung", "3. OG ohne Aufzug"
  prescription    DocStatus @default(UNKLAR)   // Transportschein
  approval        DocStatus @default(UNKLAR)   // Genehmigung
  status          RideStatus @default(ENTWURF)
  source          RideSource
  vehicleId       String?
  vehicle         Vehicle?  @relation(fields: [vehicleId], references: [id])
  seriesId        String?
  series          RideSeries? @relation(fields: [seriesId], references: [id])
  returnOfId      String?               // Rückfahrt zu einer Hinfahrt
  callId          String?
  call            Call?     @relation(fields: [callId], references: [id])
  problems        String[]              // z. B. ["GENEHMIGUNG_FEHLT", "ADRESSE_UNSICHER"]
  completedAt     DateTime?
  distanceKm      Float?                // gefahrene km mit Fahrgast, für die Abrechnung
  driverId        String?               // Fahrer laut Schicht zum Zeitpunkt der Disposition
  dispatchMode    String?               // "MANUELL" | "AUTO"
  autoSkipReason  String?               // warum der Automodus nicht disponiert hat
  driverAckAt     DateTime?             // Fahrer hat "Gesehen" gedrückt
  driverDelayMin  Int?                  // gemeldete Verspätung
  externalId      String?               // ID in Abrechnungssoftware (später)
  exportedAt      DateTime?             // im Abrechnungs-Export enthalten
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  suggestions     Suggestion[]
  statusEvents    RideStatusEvent[]
  @@index([tenantId, pickupAt])
  @@index([tenantId, status])
}

model RideStatusEvent {
  id        String     @id @default(cuid())
  tenantId  String
  rideId    String
  ride      Ride       @relation(fields: [rideId], references: [id])
  status    RideStatus
  byUserId  String?
  at        DateTime   @default(now())
  lat       Float?
  lng       Float?
}

model RideSeries {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  passengerId   String
  rrule         String               // RFC 5545, z. B. "FREQ=WEEKLY;BYDAY=MO,WE,FR"
  pickupTime    String               // "07:15" lokale Zeit
  appointmentTime String?
  until         DateTime
  template      Json                 // Orte, Beförderungsart, Rückfahrt …
  rides         Ride[]
}

enum Decision { OFFEN ANGENOMMEN GEAENDERT ABGELEHNT AUTO }

model Suggestion {
  id          String   @id @default(cuid())
  tenantId    String
  rideId      String
  ride        Ride     @relation(fields: [rideId], references: [id])
  options     Json     // [{vehicleId, etaMin, onTime, deadheadKm, score, reason}]  max. 3, beste zuerst
  decision    Decision @default(OFFEN)
  chosenVehicleId String?
  decidedByUserId String?
  decidedAt   DateTime?
  createdAt   DateTime @default(now())
}

enum CallOutcome { FAHRT_ERFASST FAHRT_GEAENDERT FAHRT_STORNIERT AUSKUNFT WEITERGELEITET ABGEBROCHEN NOTFALL_HINWEIS }

model Call {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  providerCallId String  @unique
  fromNumber    String?
  toNumber      String
  startedAt     DateTime
  durationSec   Int?
  transcript    String?            // verschlüsselt speichern
  summary       String?            // 3 Zeilen für den Disponenten
  audioUrl      String?            // nach audioRetentionDays löschen
  outcome       CallOutcome?
  rides         Ride[]
}

// Später (Anbindung Abrechnungssoftware), im Pilot nur mit NONE genutzt:
enum AdapterKey { NONE DMRZ OPTADATA TAXIEXPERTE LAVID }

model Integration {
  tenantId    String     @id
  tenant      Tenant     @relation(fields: [tenantId], references: [id])
  adapter     AdapterKey @default(NONE)
  configEnc   String?    // verschlüsselt (ENCRYPTION_KEY)
  lastSyncAt  DateTime?
  lastError   String?
}

model Notification {   // Push/SMS an Fahrer und Inhaber, zur Nachverfolgung
  id        String   @id @default(cuid())
  tenantId  String
  channel   String             // "PUSH" | "SMS" | "EMAIL"
  toRef     String             // driverId oder "INHABER"
  rideId    String?
  kind      String             // "NEUE_FAHRT", "AENDERUNG", "STORNO", "ALARM"
  sentAt    DateTime @default(now())
  ackAt     DateTime?
  error     String?
}

model AuditLog {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String?
  action    String   // "ride.confirm", "passenger.view", "settings.update"
  entity    String
  entityId  String
  at        DateTime @default(now())
  @@index([tenantId, at])
}

model Job {
  id        String   @id @default(cuid())
  type      String
  payload   Json
  runAt     DateTime @default(now())
  attempts  Int      @default(0)
  doneAt    DateTime?
  error     String?
}
```

## Wichtige Regeln

- `Passenger.notes` und `Ride.assistanceNotes`: nur organisatorische Hinweise. Die KI schreibt keine Diagnosen hinein.
- `Call.transcript` und Adapter-Zugangsdaten werden mit `src/lib/crypto.ts` (AES-256-GCM) verschlüsselt gespeichert.
- Statusübergänge nur über `core/rides/status.ts` (erlaubte Übergänge als Tabelle, jede Änderung erzeugt `RideStatusEvent` und `AuditLog`).

## Änderungen in Phase 1 (26.10.2026)

- **Generator:** `prisma-client` (neuer Prisma-7-Generator) statt `prisma-client-js`, Ausgabe nach `src/generated/prisma`. Die Verbindung steht in `prisma7.config.ts`, nicht mehr als `url = env("DATABASE_URL")` im Schema.
- **User/Session/Account/Verification:** werden von Better Auth verwaltet (`npx auth generate`, siehe `src/lib/auth.ts`). `User` hat zusätzlich `tenantId`, `role`, `phone` (additionalFields) sowie von Hand ergänzt: Relation zu `Tenant` und zu `Driver`. Nach einem erneuten `npx auth generate` müssen diese beiden Relationen im Schema wieder ergänzt werden.
- **Role:** kein Prisma-Enum mehr (Better Auth unterstützt dort nur einfache Typen) – `role` ist ein String, erlaubte Werte stehen in `src/lib/roles.ts` (`ADMIN` | `DISPONENT` | `FAHRER`).
