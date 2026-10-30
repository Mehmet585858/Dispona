/**
 * Legt den dauerhaften Demo-Mandanten für die öffentliche Live-Demo an (marketing Seite ->
 * app.dispona.de/live, src/core/demo/const.ts). Sicher mehrfach ausführbar (Upserts), legt aber
 * nie Fahrten/Anrufe an - die entstehen live durch echte Demo-Anrufer und werden vom Cron
 * /api/cron/demoZuruecksetzen wieder aufgeräumt.
 *
 * Eigenständige Funktion statt nur im Skript (scripts/seed-demo-tenant.ts), damit sie auch von
 * einem einmaligen, CRON_SECRET-gesicherten Cron-Aufruf (für die Produktions-Erstbefüllung ohne
 * dass DATABASE_URL je lokal auftaucht) genutzt werden kann.
 */
import { randomUUID } from "node:crypto";
import { prisma as db } from "@/lib/prisma";
import { DEMO_TENANT_ID } from "./const";

export async function seedDemoTenant() {
  await db.tenant.upsert({
    where: { id: DEMO_TENANT_ID },
    create: {
      id: DEMO_TENANT_ID,
      // Ein erfundener, aber konkreter Firmenname wirkt für Demo-Anrufer glaubwürdiger als
      // "Dispona Live-Demo" (Nutzerwunsch) - siehe DEMO_TENANT_ID in const.ts.
      name: "Mediway Krankenfahrdienst",
      street: "Musterstraße 1",
      zip: "52062",
      city: "Aachen",
      paket: "PRO",
    },
    // Name auch bei erneutem Lauf setzen (self-healing), falls der Mandant vor der Umbenennung
    // angelegt wurde.
    update: { name: "Mediway Krankenfahrdienst" },
  });

  await db.tenantSettings.upsert({
    where: { tenantId: DEMO_TENANT_ID },
    create: {
      tenantId: DEMO_TENANT_ID,
      aiActive: true,
      greeting:
        "Willkommen bei Mediway Krankenfahrdienst! Dies ist eine Dispona-Live-Demo: Das Gespräch führt eine KI, " +
        "wird zu Vorführzwecken aufgezeichnet und der Gesprächsverlauf läuft live und für jeden Besucher sichtbar " +
        "auf dispona.de/live mit. Bitte nennen Sie keine echten persönlichen Daten. Bestellen Sie gerne eine " +
        "Beispielfahrt – im Dashboard auf dispona.de sehen Sie direkt, wie Dispona sie einplant.",
      // Echter Name aus Vapis eigenem Sprachanbieter ("Vapi Voices"), nicht länger ein
      // erfundener Platzhalter - siehe src/providers/voice/vapi.ts.
      voiceId: "Clara",
      // Bewusst leer: diese Demo leitet nicht an einen Menschen weiter (src/core/notify/voicePrompt.ts).
      escalationNumber: "",
      openingHours: { "mo-so": "00:00-23:59" },
      serviceAreaCenter: { lat: 50.7753, lng: 6.0839 },
      serviceAreaKm: 50,
      // Ohne depotAddress bricht vorschlagBerechnenUndSpeichern sofort ab ("Einrichtung noch nicht
      // abgeschlossen") - die Demo-Fahrt bliebe für immer bei ERFASST stehen, ohne Fahrzeugvorschlag.
      depotAddress: { lat: 50.7753, lng: 6.0839 },
      // Automatikmodus "immer" + keine Dokumente nötig, damit die Demo-Fahrt ohne Disponenten-Klick
      // sofort disponiert wird - das ist der eigentliche Vorführeffekt ("wie es arbeitet").
      autoMode: "IMMER",
      requireDocsForAuto: false,
      // Die 4 Demo-Fahrzeuge stehen immer leer am selben Betriebshof - ihre Vorschlagsscores liegen
      // oft sehr nah beieinander. Der normale Default (5 Punkte Mindestabstand zur Alternative,
      // Bedingung 2 in automodus.ts) würde die Demo-Fahrt dann dauerhaft zum Disponenten schicken
      // statt sie vorzuführen - für die Demo reicht "mindestens genauso gut".
      autoModeMinMargin: 0,
      // Kurze Aufbewahrung: Demo-Daten sind ohnehin erfunden, nicht 10 Jahre wie bei echten Kunden.
      dataRetentionDays: 7,
      audioRetentionDays: 7,
    },
    // depotAddress/autoModeMinMargin/voiceId/greeting auch bei einem erneuten Lauf setzen
    // (self-healing), falls ein Mandant vor diesen Fixes angelegt wurde.
    update: {
      depotAddress: { lat: 50.7753, lng: 6.0839 },
      autoModeMinMargin: 0,
      voiceId: "Clara",
      greeting:
        "Willkommen bei Mediway Krankenfahrdienst! Dies ist eine Dispona-Live-Demo: Das Gespräch führt eine KI, " +
        "wird zu Vorführzwecken aufgezeichnet und der Gesprächsverlauf läuft live und für jeden Besucher sichtbar " +
        "auf dispona.de/live mit. Bitte nennen Sie keine echten persönlichen Daten. Bestellen Sie gerne eine " +
        "Beispielfahrt – im Dashboard auf dispona.de sehen Sie direkt, wie Dispona sie einplant.",
    },
  });

  let telefonnummerZugeordnet = false;
  const demoNummer = process.env.DEMO_VAPI_NUMMER;
  if (demoNummer) {
    const vorhanden = await db.phoneNumber.findUnique({ where: { e164: demoNummer } });
    if (!vorhanden) {
      await db.phoneNumber.create({ data: { tenantId: DEMO_TENANT_ID, e164: demoNummer, provider: "VAPI" } });
    }
    telefonnummerZugeordnet = true;
  }

  const fahrzeugDaten = [
    { plate: "DEMO-100", seats: 4, wheelchairSpots: 0, carryChair: false, stretcher: false },
    { plate: "DEMO-101", seats: 4, wheelchairSpots: 0, carryChair: false, stretcher: false },
    { plate: "DEMO-102", seats: 3, wheelchairSpots: 0, carryChair: false, stretcher: false },
    { plate: "DEMO-200", seats: 3, wheelchairSpots: 1, carryChair: false, stretcher: false },
    { plate: "DEMO-201", seats: 2, wheelchairSpots: 2, carryChair: false, stretcher: false },
    { plate: "DEMO-202", seats: 3, wheelchairSpots: 1, carryChair: false, stretcher: false },
    { plate: "DEMO-300", seats: 2, wheelchairSpots: 0, carryChair: true, stretcher: false },
    { plate: "DEMO-301", seats: 2, wheelchairSpots: 0, carryChair: true, stretcher: false },
    { plate: "DEMO-400", seats: 1, wheelchairSpots: 0, carryChair: false, stretcher: true },
    { plate: "DEMO-401", seats: 1, wheelchairSpots: 0, carryChair: false, stretcher: true },
  ];
  const fahrzeuge = [];
  for (const daten of fahrzeugDaten) {
    fahrzeuge.push(
      await db.vehicle.upsert({
        where: { tenantId_plate: { tenantId: DEMO_TENANT_ID, plate: daten.plate } },
        create: { tenantId: DEMO_TENANT_ID, active: true, ...daten },
        update: { active: true },
      }),
    );
  }

  // Nachnamen statt durchnummerierter "Demo Fahrer N" - nachname() (actions.ts) zeigt im
  // Zeitstrahl nur das letzte Wort des Namens an und hätte sonst die Zahl selbst als "Nachname"
  // angezeigt (z. B. "2 · 4" statt eines Namens).
  const DEMO_NACHNAMEN = ["Berger", "Winter", "Falk", "Keller", "Vogel", "Brandt", "Lindner", "Schuster", "Fink", "Weiss"];
  const fahrerDaten = fahrzeugDaten.map((_, i) => ({
    name: `Demo ${DEMO_NACHNAMEN[i % DEMO_NACHNAMEN.length]}`,
    email: `demo-fahrer-${i + 1}@dispona-demo.invalid`,
  }));
  // Eine einzige, sehr lang laufende Schicht statt täglich neuer - die Demo soll jederzeit
  // funktionieren, ohne dass ein Cron sie Tag für Tag verlängern muss.
  const schichtStart = new Date();
  const schichtEnde = new Date(schichtStart.getTime());
  schichtEnde.setFullYear(schichtEnde.getFullYear() + 2);

  for (const [index, daten] of fahrerDaten.entries()) {
    const user = await db.user.upsert({
      where: { email: daten.email },
      create: {
        id: randomUUID(),
        tenantId: DEMO_TENANT_ID,
        email: daten.email,
        name: daten.name,
        role: "FAHRER",
        emailVerified: true,
      },
      // Namen auch bei erneutem Lauf setzen (self-healing), falls der Nutzer noch unter dem alten
      // "Demo Fahrer N"-Schema angelegt wurde.
      update: { name: daten.name },
    });
    let driver = await db.driver.findUnique({ where: { userId: user.id } });
    if (!driver) {
      driver = await db.driver.create({ data: { tenantId: DEMO_TENANT_ID, userId: user.id } });
    }
    const vehicle = fahrzeuge[index];
    const vorhandeneSchicht = await db.shift.findFirst({ where: { driverId: driver.id, vehicleId: vehicle.id } });
    if (!vorhandeneSchicht) {
      await db.shift.create({
        data: { tenantId: DEMO_TENANT_ID, driverId: driver.id, vehicleId: vehicle.id, start: schichtStart, end: schichtEnde },
      });
    }
  }

  const orteDaten = [
    { label: "Dispona-Betriebshof", street: "Musterstraße 1", zip: "52062", city: "Aachen", lat: 50.7753, lng: 6.0839, type: "SONSTIGES" as const },
    { label: "Klinikum Musterstadt", street: "Beispielweg 10", zip: "52070", city: "Aachen", lat: 50.785, lng: 6.0956, type: "KLINIK" as const },
    { label: "Pflegeheim Sonnenhof", street: "Beispielweg 20", zip: "52064", city: "Aachen", lat: 50.7701, lng: 6.0752, type: "PFLEGEHEIM" as const },
    { label: "Praxis am Markt", street: "Beispielweg 30", zip: "52062", city: "Aachen", lat: 50.7765, lng: 6.0875, type: "PRAXIS" as const },
    { label: "Dialysezentrum Musterstadt", street: "Beispielweg 40", zip: "52074", city: "Aachen", lat: 50.7822, lng: 6.0569, type: "DIALYSE" as const },
  ];
  for (const daten of orteDaten) {
    const vorhanden = await db.place.findFirst({ where: { tenantId: DEMO_TENANT_ID, label: daten.label } });
    if (!vorhanden) {
      await db.place.create({ data: { tenantId: DEMO_TENANT_ID, usageCount: 0, ...daten } });
    }
  }

  return {
    tenantId: DEMO_TENANT_ID,
    fahrzeuge: fahrzeuge.length,
    fahrer: fahrerDaten.length,
    orte: orteDaten.length,
    telefonnummerZugeordnet,
  };
}
