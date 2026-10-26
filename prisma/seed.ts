import "dotenv/config";
import { randomUUID } from "node:crypto";
import { berlinerMitternacht, datumIso, mitUhrzeit, tagVerschieben } from "../src/core/shifts/week";
import { prisma } from "../src/lib/prisma";

const heute = berlinerMitternacht(datumIso(new Date()));

function uhrzeit(tag: Date, stunde: number, minute = 0): Date {
  return mitUhrzeit(tag, `${String(stunde).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
}

function morgen(): Date {
  return berlinerMitternacht(tagVerschieben(datumIso(heute), 1));
}

async function main() {
  console.log("Lösche alte Beispieldaten …");
  await prisma.rideStatusEvent.deleteMany();
  await prisma.suggestion.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.ride.deleteMany();
  await prisma.rideSeries.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.vehicleLocation.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.place.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.passenger.deleteMany();
  await prisma.user.deleteMany({ where: { tenant: { name: "Muster Krankenfahrten" } } });
  await prisma.phoneNumber.deleteMany();
  await prisma.tenantSettings.deleteMany();
  await prisma.tenant.deleteMany({ where: { name: "Muster Krankenfahrten" } });

  console.log("Lege Firma 'Muster Krankenfahrten' an …");
  const tenant = await prisma.tenant.create({
    data: {
      name: "Muster Krankenfahrten",
      street: "Industriestraße 8",
      zip: "52499",
      city: "Baesweiler",
      settings: {
        create: {
          greeting:
            "Willkommen bei Muster Krankenfahrten. Dieses Gespräch wird von einer KI geführt und zur Bearbeitung aufgezeichnet.",
          voiceId: "de-freundlich-1",
          escalationNumber: "+4924019999999",
          openingHours: { "mo-fr": "07:00-18:00", sa: "08:00-13:00" },
          serviceAreaCenter: { lat: 50.7753, lng: 6.0839 },
          serviceAreaKm: 30,
          depotAddress: {
            street: "Industriestraße 8",
            zip: "52499",
            city: "Baesweiler",
            lat: 50.9036,
            lng: 6.1894,
          },
        },
      },
    },
  });

  console.log("Lege Büro-Nutzer an (1 Admin, 2 Disponenten) …");
  const admin = await prisma.user.create({
    data: {
      id: randomUUID(),
      tenantId: tenant.id,
      email: "admin@muster-krankenfahrten.de",
      name: "Anja Admin",
      role: "ADMIN",
      emailVerified: true,
    },
  });
  // Echter Zugang für den Auftraggeber zum Ausprobieren.
  await prisma.user.create({
    data: {
      id: randomUUID(),
      tenantId: tenant.id,
      email: "mehmet.yurtseven.58@hotmail.com",
      name: "Mehmet Yurtseven",
      role: "ADMIN",
      emailVerified: true,
    },
  });
  await prisma.user.createMany({
    data: [
      {
        id: randomUUID(),
        tenantId: tenant.id,
        email: "disponent1@muster-krankenfahrten.de",
        name: "Dirk Disponent",
        role: "DISPONENT",
        emailVerified: true,
      },
      {
        id: randomUUID(),
        tenantId: tenant.id,
        email: "disponent2@muster-krankenfahrten.de",
        name: "Doris Disponent",
        role: "DISPONENT",
        emailVerified: true,
      },
    ],
  });

  console.log("Lege 5 Fahrzeuge an …");
  const fahrzeugDaten = [
    { plate: "AC-MK 101", seats: 4, wheelchairSpots: 0, carryChair: false, stretcher: false },
    { plate: "AC-MK 102", seats: 4, wheelchairSpots: 0, carryChair: false, stretcher: false },
    { plate: "AC-MK 201", seats: 3, wheelchairSpots: 1, carryChair: false, stretcher: false },
    { plate: "AC-MK 301", seats: 2, wheelchairSpots: 0, carryChair: true, stretcher: false },
    { plate: "AC-MK 401", seats: 1, wheelchairSpots: 0, carryChair: false, stretcher: true },
  ];
  const fahrzeuge = [];
  for (const daten of fahrzeugDaten) {
    fahrzeuge.push(await prisma.vehicle.create({ data: { tenantId: tenant.id, ...daten } }));
  }

  console.log("Lege 4 Fahrer mit Schichten heute und morgen an …");
  const fahrerDaten = [
    { name: "Fatih Fahrer", email: "fatih@muster-krankenfahrten.de", phone: "+491701000001" },
    { name: "Petra Pilot", email: "petra@muster-krankenfahrten.de", phone: "+491701000002" },
    { name: "Said Steuer", email: "said@muster-krankenfahrten.de", phone: "+491701000003" },
    { name: "Nina Navi", email: "nina@muster-krankenfahrten.de", phone: "+491701000004" },
  ];
  const fahrer = [];
  for (const [index, daten] of fahrerDaten.entries()) {
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        tenantId: tenant.id,
        email: daten.email,
        name: daten.name,
        phone: daten.phone,
        role: "FAHRER",
        emailVerified: true,
      },
    });
    const driver = await prisma.driver.create({
      data: { tenantId: tenant.id, userId: user.id },
    });
    const vehicle = fahrzeuge[index];
    await prisma.shift.create({
      data: {
        tenantId: tenant.id,
        driverId: driver.id,
        vehicleId: vehicle.id,
        start: uhrzeit(heute, 6),
        end: uhrzeit(heute, 14),
      },
    });
    await prisma.shift.create({
      data: {
        tenantId: tenant.id,
        driverId: driver.id,
        vehicleId: vehicle.id,
        start: uhrzeit(morgen(), 6),
        end: uhrzeit(morgen(), 14),
      },
    });
    fahrer.push({ user, driver, vehicle });
  }

  console.log("Lege 10 bekannte Orte in der Region Aachen an …");
  const orteDaten = [
    {
      label: "Praxis Dr. Meier",
      street: "Kapuzinergraben 1",
      zip: "52062",
      city: "Aachen",
      lat: 50.7765,
      lng: 6.0875,
      type: "PRAXIS" as const,
    },
    {
      label: "Praxis Dr. Keller",
      street: "Jülicher Straße 20",
      zip: "52070",
      city: "Aachen",
      lat: 50.785,
      lng: 6.0956,
      type: "PRAXIS" as const,
    },
    {
      label: "Uniklinik RWTH Aachen",
      street: "Pauwelsstraße 30",
      zip: "52074",
      city: "Aachen",
      lat: 50.7724,
      lng: 6.0477,
      type: "KLINIK" as const,
    },
    {
      label: "Luisenhospital Aachen",
      street: "Boxgraben 99",
      zip: "52064",
      city: "Aachen",
      lat: 50.7765,
      lng: 6.0795,
      type: "KLINIK" as const,
    },
    {
      label: "Dialysezentrum Aachen",
      street: "Mauerfeldchen 25",
      zip: "52074",
      city: "Aachen",
      lat: 50.7822,
      lng: 6.0569,
      type: "DIALYSE" as const,
    },
    {
      label: "Dialysezentrum Baesweiler",
      street: "Oidtweilerstraße 1",
      zip: "52499",
      city: "Baesweiler",
      lat: 50.9041,
      lng: 6.1902,
      type: "DIALYSE" as const,
    },
    {
      label: "Seniorenheim St. Anna",
      street: "Lütticher Straße 10",
      zip: "52064",
      city: "Aachen",
      lat: 50.7701,
      lng: 6.0752,
      type: "PFLEGEHEIM" as const,
    },
    {
      label: "Pflegeheim Am Wald",
      street: "Waldstraße 5",
      zip: "52499",
      city: "Baesweiler",
      lat: 50.9078,
      lng: 6.185,
      type: "PFLEGEHEIM" as const,
    },
    {
      label: "Praxis Dr. Berg",
      street: "Roermonder Straße 60",
      zip: "52072",
      city: "Aachen",
      lat: 50.7977,
      lng: 6.0631,
      type: "PRAXIS" as const,
    },
    {
      label: "Klinik am Europaplatz",
      street: "Europaplatz 2",
      zip: "52068",
      city: "Aachen",
      lat: 50.7691,
      lng: 6.0921,
      type: "KLINIK" as const,
    },
  ];
  const orte = [];
  for (const daten of orteDaten) {
    orte.push(
      await prisma.place.create({ data: { tenantId: tenant.id, usageCount: 0, ...daten } }),
    );
  }

  console.log("Lege 10 Fahrgäste an …");
  const fahrgastDaten = [
    { firstName: "Erika", lastName: "Schmitz", phones: ["+4924190000001"], insurer: "AOK" },
    { firstName: "Hans", lastName: "Müller", phones: ["+4924190000002"], insurer: "TK" },
    { firstName: "Anna", lastName: "Weber", phones: ["+4924190000003"], insurer: "Barmer" },
    { firstName: "Peter", lastName: "Fischer", phones: ["+4924190000004"], insurer: "AOK" },
    { firstName: "Maria", lastName: "Wagner", phones: ["+4924190000005"], insurer: "DAK" },
    { firstName: "Josef", lastName: "Becker", phones: ["+4924190000006"], insurer: "TK" },
    { firstName: "Ingrid", lastName: "Schulz", phones: ["+4924190000007"], insurer: "AOK" },
    { firstName: "Klaus", lastName: "Hoffmann", phones: ["+4924190000008"], insurer: "Barmer" },
    { firstName: "Gertrud", lastName: "Koch", phones: ["+4924190000009"], insurer: "DAK" },
    { firstName: "Werner", lastName: "Richter", phones: ["+4924190000010"], insurer: "AOK" },
  ];
  const fahrgaeste = [];
  for (const daten of fahrgastDaten) {
    fahrgaeste.push(
      await prisma.passenger.create({
        data: {
          tenantId: tenant.id,
          birthDate: new Date(1945 + fahrgaeste.length, 0, 1),
          ...daten,
        },
      }),
    );
  }

  console.log("Lege 10 Fahrten heute an …");
  const transportarten = ["SITZEND", "SITZEND", "ROLLSTUHL", "SITZEND", "TRAGESTUHL"] as const;
  for (let i = 0; i < 10; i += 1) {
    const fahrgast = fahrgaeste[i % fahrgaeste.length];
    const abholort = orte[i % orte.length];
    const zielort = orte[(i + 3) % orte.length];
    await prisma.ride.create({
      data: {
        tenantId: tenant.id,
        passengerId: fahrgast.id,
        pickupPlaceId: abholort.id,
        dropoffPlaceId: zielort.id,
        pickupAt: uhrzeit(heute, 8 + i, (i % 4) * 15),
        transportType: transportarten[i % transportarten.length],
        prescription: "JA",
        approval: "NICHT_NOETIG",
        status: "ERFASST",
        source: "MANUELL",
      },
    });
  }

  console.log("");
  console.log("Fertig. Zum Testen anmelden unter /anmeldung mit:");
  console.log(`  Admin:      ${admin.email}  (E-Mail-Code)`);
  console.log(`  Disponent:  disponent1@muster-krankenfahrten.de  (E-Mail-Code)`);
  console.log(`  Fahrer:     ${fahrer[0].user.email}  (Einmal-Link)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
