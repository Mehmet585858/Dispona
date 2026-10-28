/**
 * Legt Beispiel-Fahrzeuge, -Fahrer, -Fahrgäste und -Fahrten für HEUTE an, damit das Dashboard
 * so voll aussieht wie die Referenz (mehrere Fahrzeuge, viele Fahrten), nicht leer. Nur zum
 * Anschauen gedacht – alle angelegten Zeilen sind klar mit "DEMO" markiert (Kennzeichen, Name,
 * Place-Label), damit sie sich später leicht wieder löschen lassen. Sicher mehrfach ausführbar:
 * bereits vorhandene Fahrzeuge/Fahrer/Fahrgäste/Fahrten werden übersprungen statt dupliziert.
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

  // ---------------------------------------------------------------- Helfer, die nichts doppelt anlegen
  async function ortSicherstellen(o: { label: string; street: string; zip: string; city: string; dx: number; dy: number }) {
    const bestehend = await db.place.findFirst({ where: { tenantId, label: o.label } });
    if (bestehend) return bestehend;
    return db.place.create({
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
    });
  }

  async function fahrgastSicherstellen(p: { firstName: string; lastName: string; insurer: string; phone: string }) {
    const bestehend = await db.passenger.findFirst({ where: { tenantId, firstName: p.firstName, lastName: p.lastName } });
    if (bestehend) return bestehend;
    return db.passenger.create({
      data: { tenantId, firstName: p.firstName, lastName: p.lastName, insurer: p.insurer, phones: [p.phone] },
    });
  }

  async function fahrzeugSicherstellen(plate: string, data: { seats: number; stretcher?: boolean; carryChair?: boolean; wheelchairSpots?: number }) {
    return db.vehicle.upsert({
      where: { tenantId_plate: { tenantId, plate } },
      update: {},
      create: { tenantId, plate, ...data },
    });
  }

  async function fahrerSicherstellen(name: string, email: string) {
    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: { id: randomUUID(), tenantId, email, name, role: "FAHRER", emailVerified: true },
    });
    const bestehenderDriver = await db.driver.findUnique({ where: { userId: user.id } });
    if (bestehenderDriver) return bestehenderDriver;
    return db.driver.create({ data: { tenantId, userId: user.id } });
  }

  async function schichtSicherstellen(driverId: string, vehicleId: string, start: Date, end: Date) {
    const bestehend = await db.shift.findFirst({ where: { tenantId, driverId, vehicleId, start } });
    if (bestehend) return bestehend;
    return db.shift.create({ data: { tenantId, driverId, vehicleId, start, end } });
  }

  type FahrtDaten = Parameters<typeof db.ride.create>[0]["data"];
  async function fahrtSicherstellen(data: FahrtDaten) {
    const bestehend = await db.ride.findFirst({
      where: { tenantId, passengerId: data.passengerId as string, pickupPlaceId: data.pickupPlaceId as string, pickupAt: data.pickupAt as Date },
    });
    if (bestehend) return bestehend;
    return db.ride.create({ data });
  }

  // ---------------------------------------------------------------- Orte
  const orteDaten = [
    { label: "DEMO Uniklinik", street: "Krankenhausstr. 1", zip: "99974", city: "Mühlhausen", dx: 0.01, dy: 0.01 },
    { label: "DEMO Pflegeheim St. Anna", street: "Amtsstr. 4", zip: "99830", city: "Treffurt", dx: -0.02, dy: -0.01 },
    { label: "DEMO Dialysezentrum", street: "Bahnhofstr. 9", zip: "99974", city: "Mühlhausen", dx: 0.005, dy: -0.015 },
    { label: "DEMO Wohnung Wanfried", street: "Marktplatz 2", zip: "37213", city: "Wanfried", dx: -0.03, dy: 0.02 },
  ] as const;
  const orte = [];
  for (const o of orteDaten) orte.push(await ortSicherstellen(o));

  // ---------------------------------------------------------------- Fahrgäste
  const fahrgaesteDaten = [
    { firstName: "DEMO-Grete", lastName: "Hoffmann", insurer: "AOK Rheinland/Hamburg", phone: "+4936011100001" },
    { firstName: "DEMO-Karl", lastName: "Beyer", insurer: "Techniker Krankenkasse", phone: "+4936011100002" },
    { firstName: "DEMO-Inge", lastName: "Vogel", insurer: "BARMER", phone: "+4936011100003" },
    { firstName: "DEMO-Otto", lastName: "Lang", insurer: "DAK-Gesundheit", phone: "+4936011100004" },
    { firstName: "DEMO-Paul", lastName: "Richter", insurer: "AOK Rheinland/Hamburg", phone: "+4936011100005" },
    { firstName: "DEMO-Anna", lastName: "Scholz", insurer: "Techniker Krankenkasse", phone: "+4936011100006" },
    { firstName: "DEMO-Theo", lastName: "Bauer", insurer: "BARMER", phone: "+4936011100007" },
    { firstName: "DEMO-Lena", lastName: "Keller", insurer: "DAK-Gesundheit", phone: "+4936011100008" },
  ] as const;
  const fahrgaeste = [];
  for (const p of fahrgaesteDaten) fahrgaeste.push(await fahrgastSicherstellen(p));

  // ---------------------------------------------------------------- Die drei "Haupt"-Fahrzeuge (Demo-Interaktionen)
  const liegewagen = await fahrzeugSicherstellen("DEMO-100", { seats: 2, stretcher: true });
  const rollstuhlwagen = await fahrzeugSicherstellen("DEMO-200", { seats: 3, wheelchairSpots: 1 });
  const taxi = await fahrzeugSicherstellen("DEMO-300", { seats: 4 });

  const fahrer1 = await fahrerSicherstellen("DEMO-Sabine Krüger", `demo-fahrer-1-${tenantId}@dispona-demo.invalid`);
  const fahrer2 = await fahrerSicherstellen("DEMO-Timo Nowak", `demo-fahrer-2-${tenantId}@dispona-demo.invalid`);
  await schichtSicherstellen(fahrer1.id, liegewagen.id, uhr(8, 0), uhr(16, 0));
  await schichtSicherstellen(fahrer2.id, rollstuhlwagen.id, uhr(8, 0), uhr(16, 0));

  // ---------------------------------------------------------------- Fahrten der drei Haupt-Fahrzeuge
  const jetzt = new Date();

  await fahrtSicherstellen({
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
  });

  await fahrtSicherstellen({
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
  });

  await fahrtSicherstellen({
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
  });

  await fahrtSicherstellen({
    tenantId,
    passengerId: fahrgaeste[3].id,
    pickupPlaceId: orte[3].id,
    dropoffPlaceId: orte[0].id,
    pickupAt: new Date(jetzt.getTime() + 90 * 60_000),
    transportType: "SITZEND",
    status: "DISPONIERT",
    source: "MANUELL",
    vehicleId: rollstuhlwagen.id,
    driverId: fahrer2.id,
    dispatchMode: "AUTO",
  });

  const ausnahmeFahrt = await fahrtSicherstellen({
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
  });
  const bestehendeSuggestion = await db.suggestion.findFirst({ where: { tenantId, rideId: ausnahmeFahrt.id } });
  if (!bestehendeSuggestion) {
    await db.suggestion.create({
      data: {
        tenantId,
        rideId: ausnahmeFahrt.id,
        decision: "OFFEN",
        options: [{ vehicleId: taxi.id, plate: taxi.plate, etaMin: 12, onTime: true, score: 3, reason: "frei ab jetzt · 4 km Anfahrt" }],
      },
    });
  }

  // Laufender Anruf, an die offene Ausnahme-Fahrt gekoppelt – neu bei jedem Lauf, damit er nicht
  // nach 30 Minuten aus dem Dashboard verschwindet.
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

  // ---------------------------------------------------------------- Fünf weitere Fahrzeuge, nur damit das
  // Board so voll wirkt wie die Referenz – je drei Fahrten über den Tag verteilt.
  const weitereFahrzeuge: { plate: string; data: { seats: number; stretcher?: boolean; carryChair?: boolean; wheelchairSpots?: number }; art: "LIEGEND" | "ROLLSTUHL" | "TRAGESTUHL" | "SITZEND" }[] = [
    { plate: "DEMO-400", data: { seats: 2, stretcher: true }, art: "LIEGEND" },
    { plate: "DEMO-500", data: { seats: 3, wheelchairSpots: 1 }, art: "ROLLSTUHL" },
    { plate: "DEMO-600", data: { seats: 3, carryChair: true }, art: "TRAGESTUHL" },
    { plate: "DEMO-700", data: { seats: 4 }, art: "SITZEND" },
    { plate: "DEMO-800", data: { seats: 3, wheelchairSpots: 1 }, art: "ROLLSTUHL" },
  ];
  const fahrerNamenPool = [
    ["DEMO-Jens Albers", "DEMO-Nora Brandt"],
    ["DEMO-Ella Wendt"],
    ["DEMO-Finn Celik"],
    ["DEMO-Greta Ott"],
    ["DEMO-Noah Becker"],
  ];
  const zeitSlots = [
    [8, 15, 45],
    [11, 30, 40],
    [14, 0, 35],
  ] as const;

  let fahrgastIndex = 4;
  for (let i = 0; i < weitereFahrzeuge.length; i++) {
    const v = weitereFahrzeuge[i];
    const fahrzeug = await fahrzeugSicherstellen(v.plate, v.data);
    const fahrerName = fahrerNamenPool[i].join(" · ");
    const fahrer = await fahrerSicherstellen(fahrerName, `demo-fahrer-${i + 3}-${tenantId}@dispona-demo.invalid`);
    await schichtSicherstellen(fahrer.id, fahrzeug.id, uhr(8, 0), uhr(16, 0));

    for (let s = 0; s < zeitSlots.length; s++) {
      const [stunde, minute, dauer] = zeitSlots[s];
      const pickupAt = uhr(stunde, minute);
      const passagier = fahrgaeste[fahrgastIndex % fahrgaeste.length];
      fahrgastIndex++;
      const vonOrt = orte[s % orte.length];
      const nachOrt = orte[(s + 1) % orte.length];
      const istVergangenheit = pickupAt.getTime() < jetzt.getTime();
      await fahrtSicherstellen({
        tenantId,
        passengerId: passagier.id,
        pickupPlaceId: vonOrt.id,
        dropoffPlaceId: nachOrt.id,
        pickupAt,
        transportType: v.art,
        status: istVergangenheit ? "ERLEDIGT" : "DISPONIERT",
        source: "MANUELL",
        vehicleId: fahrzeug.id,
        driverId: fahrer.id,
        dispatchMode: "AUTO",
        completedAt: istVergangenheit ? new Date(pickupAt.getTime() + dauer * 60_000) : undefined,
        distanceKm: istVergangenheit ? 5 + s * 2 : undefined,
      });
    }
  }

  console.log("Fertig. Angelegt bzw. schon vorhanden:");
  console.log(`  Fahrzeuge: DEMO-100 … DEMO-800 (8 insgesamt)`);
  console.log(`  Fahrgäste: ${fahrgaeste.map((f) => f.firstName + " " + f.lastName).join(", ")}`);
  console.log("Zum Aufräumen: alle Zeilen mit 'DEMO' im Namen/Kennzeichen/Label wieder löschen.");

  await db.$disconnect();
}

main().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});
