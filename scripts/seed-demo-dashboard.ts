/**
 * Legt ein paar Beispiel-Fahrzeuge, -Fahrer, -Fahrgäste und -Fahrten für HEUTE an, damit das
 * Dashboard nicht leer ist. Nur zum Anschauen gedacht – alle angelegten Zeilen sind klar mit
 * "DEMO" markiert (Kennzeichen, Name, Place-Label), damit sie sich später leicht wieder löschen
 * lassen. Einmalig von Hand auszuführen, siehe README-Hinweis am Ende der Ausgabe.
 *
 * Aufruf (mit der echten DATABASE_URL, z. B. aus Vercel/Neon):
 *   $env:DATABASE_URL = "postgres://...neon.tech/neondb?sslmode=require"
 *   npx tsx scripts/seed-demo-dashboard.ts
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { berlinerMitternacht, datumIso } from "../src/core/shifts/week";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL fehlt. Bitte vor dem Aufruf setzen (siehe Kommentar oben im Script).");
  }
  const adapter = new PrismaPg({ connectionString });
  const db = new PrismaClient({ adapter });

  const tenants = await db.tenant.findMany({ select: { id: true, name: true } });
  if (tenants.length !== 1) {
    console.error(
      `Erwarte genau 1 Mandant in dieser Datenbank, gefunden: ${tenants.length}. Abgebrochen, bitte tenantId im Script fest eintragen.`,
    );
    console.error(tenants);
    process.exit(1);
  }
  const tenantId = tenants[0].id;
  console.log(`Mandant: ${tenants[0].name} (${tenantId})`);

  const settings = await db.tenantSettings.findUnique({ where: { tenantId } });
  const zentrum = (settings?.serviceAreaCenter as { lat: number; lng: number } | undefined) ?? {
    lat: 51.206,
    lng: 10.305,
  };

  const heuteIso = datumIso(new Date());
  const heuteMitternacht = berlinerMitternacht(heuteIso);
  function uhr(stunde: number, minute: number): Date {
    const datum = new Date(heuteMitternacht);
    datum.setHours(stunde, minute, 0, 0);
    return datum;
  }

  // Orte --------------------------------------------------------------------
  const orteDaten = [
    { label: "DEMO Uniklinik", street: "Krankenhausstr. 1", zip: "99974", city: "Mühlhausen", dx: 0.01, dy: 0.01 },
    { label: "DEMO Pflegeheim St. Anna", street: "Amtsstr. 4", zip: "99830", city: "Treffurt", dx: -0.02, dy: -0.01 },
    { label: "DEMO Dialysezentrum", street: "Bahnhofstr. 9", zip: "99974", city: "Mühlhausen", dx: 0.005, dy: -0.015 },
    { label: "DEMO Wohnung Wanfried", street: "Marktplatz 2", zip: "37213", city: "Wanfried", dx: -0.03, dy: 0.02 },
  ] as const;
  const orte = [];
  for (const o of orteDaten) {
    orte.push(
      await db.place.create({
        data: {
          tenantId,
          label: o.label,
          street: o.street,
          zip: o.zip,
          city: o.city,
          lat: zentrum.lat + o.dy,
          lng: zentrum.lng + o.dx,
          type: "SONSTIGES",
          usageCount: 1,
        },
      }),
    );
  }

  // Fahrgäste -----------------------------------------------------------------
  const fahrgaesteDaten = [
    { firstName: "DEMO-Grete", lastName: "Hoffmann", insurer: "AOK Rheinland/Hamburg", phone: "+4936011100001" },
    { firstName: "DEMO-Karl", lastName: "Beyer", insurer: "Techniker Krankenkasse", phone: "+4936011100002" },
    { firstName: "DEMO-Inge", lastName: "Vogel", insurer: "BARMER", phone: "+4936011100003" },
    { firstName: "DEMO-Otto", lastName: "Lang", insurer: "DAK-Gesundheit", phone: "+4936011100004" },
  ] as const;
  const fahrgaeste = [];
  for (const p of fahrgaesteDaten) {
    fahrgaeste.push(
      await db.passenger.create({
        data: { tenantId, firstName: p.firstName, lastName: p.lastName, insurer: p.insurer, phones: [p.phone] },
      }),
    );
  }

  // Fahrzeuge + Fahrer ----------------------------------------------------
  const liegewagen = await db.vehicle.create({
    data: { tenantId, plate: "DEMO-100", seats: 2, stretcher: true, active: true },
  });
  const rollstuhlwagen = await db.vehicle.create({
    data: { tenantId, plate: "DEMO-200", seats: 3, wheelchairSpots: 1, active: true },
  });
  const taxi = await db.vehicle.create({ data: { tenantId, plate: "DEMO-300", seats: 4, active: true } });

  async function fahrerAnlegen(name: string, email: string) {
    const user = await db.user.create({
      data: { id: randomUUID(), tenantId, email, name, role: "FAHRER", emailVerified: true },
    });
    return db.driver.create({ data: { tenantId, userId: user.id } });
  }
  const fahrer1 = await fahrerAnlegen("DEMO-Sabine Krüger", `demo-fahrer-1-${tenantId}@dispona-demo.invalid`);
  const fahrer2 = await fahrerAnlegen("DEMO-Timo Nowak", `demo-fahrer-2-${tenantId}@dispona-demo.invalid`);

  await db.shift.create({ data: { tenantId, driverId: fahrer1.id, vehicleId: liegewagen.id, start: uhr(8, 0), end: uhr(16, 0) } });
  await db.shift.create({ data: { tenantId, driverId: fahrer2.id, vehicleId: rollstuhlwagen.id, start: uhr(8, 0), end: uhr(16, 0) } });

  // Fahrten -----------------------------------------------------------------
  const jetzt = new Date();

  await db.ride.create({
    data: {
      tenantId,
      passengerId: fahrgaeste[0].id,
      pickupPlaceId: orte[0].id,
      dropoffPlaceId: orte[1].id,
      pickupAt: uhr(9, 0),
      transportType: "LIEGEND",
      status: "ERLEDIGT",
      source: "MANUELL",
      vehicleId: liegewagen.id,
      driverId: fahrer1.id,
      dispatchMode: "AUTO",
      completedAt: uhr(9, 45),
      distanceKm: 8.2,
    },
  });

  await db.ride.create({
    data: {
      tenantId,
      passengerId: fahrgaeste[1].id,
      pickupPlaceId: orte[2].id,
      dropoffPlaceId: orte[0].id,
      pickupAt: new Date(jetzt.getTime() - 20 * 60_000),
      transportType: "LIEGEND",
      status: "UNTERWEGS",
      source: "MANUELL",
      vehicleId: liegewagen.id,
      driverId: fahrer1.id,
      dispatchMode: "AUTO",
    },
  });

  await db.ride.create({
    data: {
      tenantId,
      passengerId: fahrgaeste[2].id,
      pickupPlaceId: orte[1].id,
      dropoffPlaceId: orte[3].id,
      pickupAt: uhr(10, 30),
      transportType: "ROLLSTUHL",
      status: "NICHT_ANGETROFFEN",
      source: "MANUELL",
      vehicleId: rollstuhlwagen.id,
      driverId: fahrer2.id,
      dispatchMode: "MANUELL",
      problems: ["Fahrgast nicht angetroffen, Klingel ohne Reaktion"],
    },
  });

  const spaeterePickupAt = new Date(jetzt.getTime() + 90 * 60_000);
  await db.ride.create({
    data: {
      tenantId,
      passengerId: fahrgaeste[3].id,
      pickupPlaceId: orte[3].id,
      dropoffPlaceId: orte[0].id,
      pickupAt: spaeterePickupAt,
      transportType: "SITZEND",
      status: "DISPONIERT",
      source: "MANUELL",
      vehicleId: rollstuhlwagen.id,
      driverId: fahrer2.id,
      dispatchMode: "AUTO",
    },
  });

  const ausnahmeFahrt = await db.ride.create({
    data: {
      tenantId,
      passengerId: fahrgaeste[0].id,
      pickupPlaceId: orte[0].id,
      dropoffPlaceId: orte[1].id,
      pickupAt: new Date(jetzt.getTime() + 45 * 60_000),
      transportType: "ROLLSTUHL",
      status: "VORGESCHLAGEN",
      source: "ANRUF",
      dispatchMode: null,
      autoSkipReason: "Kein Rollstuhl-Fahrzeug in der Nähe frei",
    },
  });
  await db.suggestion.create({
    data: {
      tenantId,
      rideId: ausnahmeFahrt.id,
      decision: "OFFEN",
      options: [{ vehicleId: taxi.id, plate: taxi.plate, etaMin: 12, onTime: true, score: 3, reason: "frei ab jetzt · 4 km Anfahrt" }],
    },
  });

  // Laufender Anruf, an die offene Ausnahme-Fahrt gekoppelt ------------------
  await db.call.create({
    data: {
      tenantId,
      providerCallId: `demo-${randomUUID()}`,
      fromNumber: "+4936011199999",
      toNumber: "+4936099900000",
      startedAt: new Date(jetzt.getTime() - 90_000),
      rides: { connect: { id: ausnahmeFahrt.id } },
    },
  });

  console.log("Fertig. Angelegt:");
  console.log(`  Fahrzeuge: ${liegewagen.plate}, ${rollstuhlwagen.plate}, ${taxi.plate}`);
  console.log(`  Fahrer: ${fahrer1.id}, ${fahrer2.id}`);
  console.log(`  Fahrgäste: ${fahrgaeste.map((f) => f.firstName + " " + f.lastName).join(", ")}`);
  console.log("Zum Aufräumen: alle Zeilen mit 'DEMO' im Namen/Kennzeichen/Label wieder löschen.");

  await db.$disconnect();
}

main().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});
