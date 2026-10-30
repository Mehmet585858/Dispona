/**
 * Legt den dauerhaften Demo-Mandanten für die öffentliche Live-Demo an (marketing Seite ->
 * app.dispona.de/live, src/core/demo/const.ts). Sicher mehrfach ausführbar (Upserts). Fahrten und
 * Anrufe entstehen nicht hier, sondern laufend durch src/core/demo/betriebSimulieren.ts (Cron
 * /api/cron/demoBetrieb) und werden vom Cron /api/cron/demoZuruecksetzen wieder aufgeräumt.
 *
 * Eigenständige Funktion statt nur im Skript (scripts/seed-demo-tenant.ts), damit sie auch von
 * einem einmaligen, CRON_SECRET-gesicherten Cron-Aufruf (für die Produktions-Erstbefüllung ohne
 * dass DATABASE_URL je lokal auftaucht) genutzt werden kann.
 */
import { randomUUID } from "node:crypto";
import { prisma as db } from "@/lib/prisma";
import { DEMO_PASSAGIER_ROSTER, DEMO_TENANT_ID } from "./const";

export async function seedDemoTenant() {
  await db.tenant.upsert({
    where: { id: DEMO_TENANT_ID },
    create: {
      id: DEMO_TENANT_ID,
      // Ein erfundener, aber konkreter Firmenname wirkt für Demo-Anrufer glaubwürdiger als
      // "Dispona Live-Demo" (Nutzerwunsch) - siehe DEMO_TENANT_ID in const.ts.
      name: "Mediway Krankenfahrdienst",
      // Echte Berliner Adresse (Mitte) statt "Musterstraße".
      street: "Torstraße 1",
      zip: "10119",
      city: "Berlin",
      paket: "PRO",
    },
    // Auch bei erneutem Lauf setzen (self-healing), falls der Mandant vor diesen Namen/Adressen
    // angelegt wurde.
    update: { name: "Mediway Krankenfahrdienst", street: "Torstraße 1", zip: "10119", city: "Berlin" },
  });

  // Alexanderplatz als Mittelpunkt - zentral genug, dass alle Stadtteil-Adressen unten innerhalb
  // des 50-km-Einzugsgebiets liegen.
  const BERLIN_ZENTRUM = { lat: 52.5219, lng: 13.4132 };

  await db.tenantSettings.upsert({
    where: { tenantId: DEMO_TENANT_ID },
    create: {
      tenantId: DEMO_TENANT_ID,
      aiActive: true,
      greeting:
        "Willkommen bei Mediway Krankenfahrdienst! Dies ist eine Dispona-Live-Demo: Das Gespräch führt eine KI, " +
        "wird zu Vorführzwecken aufgezeichnet und der Gesprächsverlauf läuft live und für jeden Besucher sichtbar " +
        "auf dispona.de/live mit. Bitte nennen Sie keine echten persönlichen Daten. Bestellen Sie gerne eine " +
        "Fahrt – im Dashboard auf dispona.de sehen Sie direkt, wie Dispona sie einplant.",
      // Echter Name aus Vapis eigenem Sprachanbieter ("Vapi Voices"), nicht länger ein
      // erfundener Platzhalter - siehe src/providers/voice/vapi.ts.
      voiceId: "Clara",
      // Bewusst leer: diese Demo leitet nicht an einen Menschen weiter (src/core/notify/voicePrompt.ts).
      escalationNumber: "",
      openingHours: { "mo-so": "00:00-23:59" },
      serviceAreaCenter: BERLIN_ZENTRUM,
      serviceAreaKm: 50,
      // Ohne depotAddress bricht vorschlagBerechnenUndSpeichern sofort ab ("Einrichtung noch nicht
      // abgeschlossen") - die Demo-Fahrt bliebe für immer bei ERFASST stehen, ohne Fahrzeugvorschlag.
      depotAddress: BERLIN_ZENTRUM,
      // Automatikmodus "immer" + keine Dokumente nötig, damit jede simulierte Fahrt (siehe
      // betriebSimulieren.ts) ohne Disponenten-Klick sofort disponiert wird - das ist der
      // eigentliche Vorführeffekt ("wie es arbeitet").
      autoMode: "IMMER",
      requireDocsForAuto: false,
      // Die Demo-Fahrzeuge haben oft sehr nah beieinanderliegende Vorschlagsscores. Der normale
      // Default (5 Punkte Mindestabstand zur Alternative, Bedingung 2 in automodus.ts) würde eine
      // Demo-Fahrt dann dauerhaft zum Disponenten schicken statt sie vorzuführen - für die Demo
      // reicht "mindestens genauso gut".
      autoModeMinMargin: 0,
      // Kurze Aufbewahrung: Demo-Daten sind ohnehin erfunden, nicht 10 Jahre wie bei echten Kunden.
      dataRetentionDays: 7,
      audioRetentionDays: 7,
    },
    // depotAddress/autoModeMinMargin/voiceId/greeting auch bei einem erneuten Lauf setzen
    // (self-healing), falls ein Mandant vor diesen Fixes angelegt wurde.
    update: {
      serviceAreaCenter: BERLIN_ZENTRUM,
      depotAddress: BERLIN_ZENTRUM,
      autoModeMinMargin: 0,
      voiceId: "Clara",
      greeting:
        "Willkommen bei Mediway Krankenfahrdienst! Dies ist eine Dispona-Live-Demo: Das Gespräch führt eine KI, " +
        "wird zu Vorführzwecken aufgezeichnet und der Gesprächsverlauf läuft live und für jeden Besucher sichtbar " +
        "auf dispona.de/live mit. Bitte nennen Sie keine echten persönlichen Daten. Bestellen Sie gerne eine " +
        "Fahrt – im Dashboard auf dispona.de sehen Sie direkt, wie Dispona sie einplant.",
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

  // Kennzeichen im echten deutschen Format (Stadt-Kürzel "B" für Berlin) - altesKennzeichen lässt
  // ein schon angelegtes Fahrzeug umbenennen (self-healing per Rename statt Löschen+Neuanlegen),
  // damit bestehende Schichten/Fahrten weiter auf dieselbe Fahrzeug-ID zeigen.
  const fahrzeugDaten = [
    { plate: "B-DEM 100", altesKennzeichen: "AC-DEM 100", seats: 4, wheelchairSpots: 0, carryChair: false, stretcher: false },
    { plate: "B-DEM 101", altesKennzeichen: "AC-DEM 101", seats: 4, wheelchairSpots: 0, carryChair: false, stretcher: false },
    { plate: "B-DEM 102", altesKennzeichen: "AC-DEM 102", seats: 3, wheelchairSpots: 0, carryChair: false, stretcher: false },
    { plate: "B-DEM 200", altesKennzeichen: "AC-DEM 200", seats: 3, wheelchairSpots: 1, carryChair: false, stretcher: false },
    { plate: "B-DEM 201", altesKennzeichen: "AC-DEM 201", seats: 2, wheelchairSpots: 2, carryChair: false, stretcher: false },
    { plate: "B-DEM 202", altesKennzeichen: "AC-DEM 202", seats: 3, wheelchairSpots: 1, carryChair: false, stretcher: false },
    { plate: "B-DEM 300", altesKennzeichen: "AC-DEM 300", seats: 2, wheelchairSpots: 0, carryChair: true, stretcher: false },
    { plate: "B-DEM 301", altesKennzeichen: "AC-DEM 301", seats: 2, wheelchairSpots: 0, carryChair: true, stretcher: false },
    { plate: "B-DEM 400", altesKennzeichen: "AC-DEM 400", seats: 1, wheelchairSpots: 0, carryChair: false, stretcher: true },
    { plate: "B-DEM 401", altesKennzeichen: "AC-DEM 401", seats: 1, wheelchairSpots: 0, carryChair: false, stretcher: true },
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

  // Echte Berliner Einrichtungen (für Abholung/Ziel in simulierten Fahrten, siehe
  // betriebSimulieren.ts) - altesLabel lässt eine schon angelegte Aachener Adresse auf die neue
  // umschreiben (self-healing per Rename statt Löschen+Neuanlegen), falls eine laufende Fahrt noch
  // auf die alte ID zeigt.
  const einrichtungenDaten = [
    {
      label: "Dispona-Betriebshof",
      altesLabel: "Dispona-Betriebshof",
      street: "Torstraße 1",
      zip: "10119",
      city: "Berlin",
      lat: 52.5283,
      lng: 13.3959,
      type: "SONSTIGES" as const,
    },
    {
      label: "Klinikum Berlin-Mitte",
      altesLabel: "Klinikum Aachen-Mitte",
      street: "Charitéplatz 1",
      zip: "10117",
      city: "Berlin",
      lat: 52.5253,
      lng: 13.3773,
      type: "KLINIK" as const,
    },
    {
      label: "Pflegeheim Sonnenhof",
      altesLabel: undefined as string | undefined,
      street: "Kastanienallee 10",
      zip: "10435",
      city: "Berlin",
      lat: 52.5392,
      lng: 13.4106,
      type: "PFLEGEHEIM" as const,
    },
    {
      label: "Praxis am Kollwitzplatz",
      altesLabel: "Praxis am Markt",
      street: "Kollwitzstraße 1",
      zip: "10405",
      city: "Berlin",
      lat: 52.5386,
      lng: 13.4172,
      type: "PRAXIS" as const,
    },
    {
      label: "Dialysezentrum Berlin",
      altesLabel: "Dialysezentrum Aachen",
      street: "Kurfürstendamm 50",
      zip: "10707",
      city: "Berlin",
      lat: 52.5035,
      lng: 13.329,
      type: "DIALYSE" as const,
    },
  ];
  // Wohnadressen, über ganz Berlin verteilt - als Abholung/Ziel der simulierten Fahrten
  // (betriebSimulieren.ts), damit Fahrzeuge auf echten Routen quer durch die Stadt unterwegs sind
  // statt nur am Betriebshof zu stehen. Label ist die vollständige Adresse selbst (Straße, PLZ,
  // Stadt) statt eines generischen "Wohnung X" - im Gespräch und im Detail-Fenster steht sonst nur
  // ein Platzhalter-Name statt einer echten Abholadresse.
  const wohnorteDaten = [
    { label: "Schönhauser Allee 120, 10437 Berlin", altesLabel: "Wohnung Prenzlauer Berg", street: "Schönhauser Allee 120", zip: "10437", city: "Berlin", lat: 52.5476, lng: 13.4126, type: "WOHNUNG" as const },
    { label: "Kantstraße 45, 10625 Berlin", altesLabel: "Wohnung Charlottenburg", street: "Kantstraße 45", zip: "10625", city: "Berlin", lat: 52.5058, lng: 13.3192, type: "WOHNUNG" as const },
    { label: "Karl-Marx-Straße 66, 12043 Berlin", altesLabel: "Wohnung Neukölln", street: "Karl-Marx-Straße 66", zip: "12043", city: "Berlin", lat: 52.4817, lng: 13.4357, type: "WOHNUNG" as const },
    { label: "Altstädter Ring 2, 13597 Berlin", altesLabel: "Wohnung Spandau", street: "Altstädter Ring 2", zip: "13597", city: "Berlin", lat: 52.5355, lng: 13.2007, type: "WOHNUNG" as const },
    { label: "Bahnhofstraße 30, 12555 Berlin", altesLabel: "Wohnung Köpenick", street: "Bahnhofstraße 30", zip: "12555", city: "Berlin", lat: 52.4559, lng: 13.5752, type: "WOHNUNG" as const },
    { label: "Residenzstraße 80, 13409 Berlin", altesLabel: "Wohnung Reinickendorf", street: "Residenzstraße 80", zip: "13409", city: "Berlin", lat: 52.5698, lng: 13.3496, type: "WOHNUNG" as const },
  ];
  const orteDaten = [...einrichtungenDaten, ...wohnorteDaten];
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

  // Fester Fahrgast-Stamm für die simulierten Anrufe (betriebSimulieren.ts, Liste gemeinsam mit
  // dort in const.ts) - echte Passenger-Datensätze, damit eine simulierte Fahrt ein ganz normaler,
  // über fahrtErfassen() angelegter Ride ist.
  const passagierDaten = DEMO_PASSAGIER_ROSTER;
  for (const daten of passagierDaten) {
    const vorhanden = await db.passenger.findFirst({
      where: { tenantId: DEMO_TENANT_ID, firstName: daten.firstName, lastName: daten.lastName },
    });
    if (!vorhanden) {
      await db.passenger.create({ data: { tenantId: DEMO_TENANT_ID, phones: [], ...daten } });
    }
  }

  return {
    tenantId: DEMO_TENANT_ID,
    fahrzeuge: fahrzeuge.length,
    fahrer: fahrerDaten.length,
    orte: orteDaten.length,
    passagiere: passagierDaten.length,
    telefonnummerZugeordnet,
  };
}
