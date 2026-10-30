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
      // Echte Aachener Adresse statt "Musterstraße" - wirkt für Demo-Anrufer glaubwürdiger.
      street: "Jülicher Straße 112",
      zip: "52070",
      city: "Aachen",
      paket: "PRO",
    },
    // Auch bei erneutem Lauf setzen (self-healing), falls der Mandant vor diesen Namen/Adressen
    // angelegt wurde.
    update: { name: "Mediway Krankenfahrdienst", street: "Jülicher Straße 112", zip: "52070", city: "Aachen" },
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

  // Kennzeichen im echten deutschen Format (Stadt-Kürzel "AC" für Aachen) statt "DEMO-101" -
  // altesKennzeichen lässt ein schon angelegtes Fahrzeug umbenennen (self-healing per Rename statt
  // Löschen+Neuanlegen), damit bestehende Schichten/Fahrten weiter auf dieselbe Fahrzeug-ID zeigen.
  const fahrzeugDaten = [
    { plate: "AC-DEM 100", altesKennzeichen: "DEMO-100", seats: 4, wheelchairSpots: 0, carryChair: false, stretcher: false },
    { plate: "AC-DEM 101", altesKennzeichen: "DEMO-101", seats: 4, wheelchairSpots: 0, carryChair: false, stretcher: false },
    { plate: "AC-DEM 102", altesKennzeichen: "DEMO-102", seats: 3, wheelchairSpots: 0, carryChair: false, stretcher: false },
    { plate: "AC-DEM 200", altesKennzeichen: "DEMO-200", seats: 3, wheelchairSpots: 1, carryChair: false, stretcher: false },
    { plate: "AC-DEM 201", altesKennzeichen: "DEMO-201", seats: 2, wheelchairSpots: 2, carryChair: false, stretcher: false },
    { plate: "AC-DEM 202", altesKennzeichen: "DEMO-202", seats: 3, wheelchairSpots: 1, carryChair: false, stretcher: false },
    { plate: "AC-DEM 300", altesKennzeichen: "DEMO-300", seats: 2, wheelchairSpots: 0, carryChair: true, stretcher: false },
    { plate: "AC-DEM 301", altesKennzeichen: "DEMO-301", seats: 2, wheelchairSpots: 0, carryChair: true, stretcher: false },
    { plate: "AC-DEM 400", altesKennzeichen: "DEMO-400", seats: 1, wheelchairSpots: 0, carryChair: false, stretcher: true },
    { plate: "AC-DEM 401", altesKennzeichen: "DEMO-401", seats: 1, wheelchairSpots: 0, carryChair: false, stretcher: true },
  ];
  const fahrzeuge = [];
  for (const { altesKennzeichen, ...daten } of fahrzeugDaten) {
    const vorhanden = await db.vehicle.findFirst({
      where: { tenantId: DEMO_TENANT_ID, plate: { in: [daten.plate, altesKennzeichen] } },
    });
    fahrzeuge.push(
      vorhanden
        ? await db.vehicle.update({ where: { id: vorhanden.id }, data: { ...daten, active: true } })
        : await db.vehicle.create({ data: { tenantId: DEMO_TENANT_ID, active: true, ...daten } }),
    );
  }

  // Echte Vor- und Nachnamen statt durchnummerierter "Demo Fahrer N" - wirkt glaubwürdiger und
  // nachname() (actions.ts) zeigt im Zeitstrahl ohnehin nur das letzte Wort des Namens an, hätte
  // bei "Demo Fahrer 2" sonst die Zahl selbst als "Nachname" angezeigt (z. B. "2 · 4").
  const DEMO_FAHRER_NAMEN = [
    "Thomas Berger",
    "Sabine Winter",
    "Markus Falk",
    "Julia Keller",
    "Stefan Vogel",
    "Nicole Brandt",
    "Michael Lindner",
    "Anna Schuster",
    "Daniel Fink",
    "Laura Weiss",
  ];
  const fahrerDaten = fahrzeugDaten.map((_, i) => ({
    name: DEMO_FAHRER_NAMEN[i % DEMO_FAHRER_NAMEN.length],
    email: `demo-fahrer-${i + 1}@dispona-demo.invalid`,
  }));
  // Eine einzige, sehr lang laufende Schicht statt täglich neuer - die Demo soll jederzeit
  // funktionieren, ohne dass ein Cron sie Tag für Tag verlängern muss.
  const schichtStart = new Date();
  const schichtEnde = new Date(schichtStart.getTime());
  schichtEnde.setFullYear(schichtEnde.getFullYear() + 2);

  const fahrerIds: string[] = [];
  const fahrzeugIdJeFahrer = new Map<string, string>(); // driverId -> vehicleId, für die Aufräumrunde unten
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
    fahrerIds.push(driver.id);
    const vehicle = fahrzeuge[index];
    fahrzeugIdJeFahrer.set(driver.id, vehicle.id);
    const vorhandeneSchicht = await db.shift.findFirst({ where: { driverId: driver.id, vehicleId: vehicle.id } });
    if (!vorhandeneSchicht) {
      await db.shift.create({
        data: { tenantId: DEMO_TENANT_ID, driverId: driver.id, vehicleId: vehicle.id, start: schichtStart, end: schichtEnde },
      });
    }
  }
  // Räumt Schichten auf einem anderen Fahrzeug auf, die ein Demo-Fahrer aus einer früheren Flotten-
  // größe (z. B. vor der Erweiterung auf 10 Fahrzeuge) noch hat - sonst zeigt eine Fahrzeugzeile
  // mehrere Fahrernamen ("Winter · Keller") statt des einen, der dem Fahrzeug jetzt zugeordnet ist.
  await db.shift.deleteMany({
    where: {
      tenantId: DEMO_TENANT_ID,
      driverId: { in: fahrerIds },
      NOT: fahrerIds.map((driverId) => ({ driverId, vehicleId: fahrzeugIdJeFahrer.get(driverId) })),
    },
  });

  // Echte Aachener Adressen statt "Beispielweg"/"Musterstadt" - altesLabel lässt eine schon
  // angelegte Platzhalter-Adresse auf die neue umschreiben (self-healing per Rename statt
  // Löschen+Neuanlegen), falls eine laufende Demo-Fahrt noch auf die alte ID zeigt.
  const orteDaten = [
    { label: "Dispona-Betriebshof", street: "Jülicher Straße 112", zip: "52070", city: "Aachen", lat: 50.7847, lng: 6.0825, type: "SONSTIGES" as const },
    {
      label: "Klinikum Aachen-Mitte",
      altesLabel: "Klinikum Musterstadt",
      street: "Goethestraße 1",
      zip: "52064",
      city: "Aachen",
      lat: 50.7762,
      lng: 6.0865,
      type: "KLINIK" as const,
    },
    { label: "Pflegeheim Sonnenhof", street: "Lousbergstraße 10", zip: "52064", city: "Aachen", lat: 50.7831, lng: 6.0774, type: "PFLEGEHEIM" as const },
    { label: "Praxis am Markt", street: "Am Markt 5", zip: "52062", city: "Aachen", lat: 50.7753, lng: 6.0839, type: "PRAXIS" as const },
    {
      label: "Dialysezentrum Aachen",
      altesLabel: "Dialysezentrum Musterstadt",
      street: "Roermonder Straße 20",
      zip: "52072",
      city: "Aachen",
      lat: 50.7682,
      lng: 6.0651,
      type: "DIALYSE" as const,
    },
  ];
  for (const { altesLabel, ...daten } of orteDaten) {
    const vorhanden = await db.place.findFirst({
      where: { tenantId: DEMO_TENANT_ID, label: { in: [daten.label, ...(altesLabel ? [altesLabel] : [])] } },
    });
    if (vorhanden) {
      await db.place.update({ where: { id: vorhanden.id }, data: daten });
    } else {
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
