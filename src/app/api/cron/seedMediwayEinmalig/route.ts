import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/db";

/**
 * EINMALIGE Anlage des echten Testmandanten "Mediway Krankenfahrdienst (Live Test)" für den
 * Live-Anruftest mit der neuen Vapi-Testnummer (+18583994019), über Vercel Cron (CRON_SECRET)
 * statt per Hand mit der echten DATABASE_URL - siehe seedDemoTenantEinmalig für denselben Ansatz.
 * Prüft erst, ob der Mandant per Name schon existiert (Name-Guard statt fester ID, da dieser
 * Mandant anders als der Demo-Mandant kein dauerhaftes Infrastruktur-Konstrukt ist), damit ein
 * versehentlicher zweiter Cron-Lauf keine Dubletten anlegt. Nach dem ersten erfolgreichen Lauf
 * wieder aus vercel.json entfernen.
 */
const NAME = "Mediway Krankenfahrdienst (Live Test)";
const TESTNUMMER = "+18583994019";
// Berlin Mitte, vom Nutzer als Standort für den Testmandanten gewählt.
const STANDORT = { lat: 52.52, lng: 13.405 };

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const erlaubnis = request.headers.get("authorization");
  if (!secret || erlaubnis !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const vorhanden = await prisma.tenant.findFirst({ where: { name: NAME } });
  if (vorhanden) {
    return NextResponse.json({ bereitsVorhanden: true, tenantId: vorhanden.id });
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: NAME,
      street: "Teststraße 1",
      zip: "10178",
      city: "Berlin",
      paket: "PRO",
    },
  });
  const db = withTenant(tenant.id);

  await db.tenantSettings.create({
    data: {
      tenantId: tenant.id,
      aiActive: true,
      greeting:
        "Willkommen bei Mediway Krankenfahrdienst! Dieses Gespräch wird zu Testzwecken von einer KI geführt " +
        "und aufgezeichnet. Wie kann ich Ihnen helfen?",
      voiceId: "de-freundlich-1",
      escalationNumber: "",
      openingHours: { "mo-so": "00:00-23:59" },
      serviceAreaCenter: STANDORT,
      serviceAreaKm: 30,
      depotAddress: STANDORT,
      autoMode: "IMMER",
      requireDocsForAuto: false,
      autoModeMinMargin: 0,
      dataRetentionDays: 7,
      audioRetentionDays: 7,
    },
  });

  await db.phoneNumber.create({ data: { tenantId: tenant.id, e164: TESTNUMMER, provider: "VAPI" } });

  const fahrzeug = await db.vehicle.create({
    data: { tenantId: tenant.id, active: true, plate: "MEDIWAY-1", seats: 4, wheelchairSpots: 0, carryChair: false, stretcher: false },
  });

  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      tenantId: tenant.id,
      email: `test-fahrer-${tenant.id}@mediway-test.invalid`,
      name: "Test Fahrer",
      role: "FAHRER",
      emailVerified: true,
    },
  });
  const driver = await prisma.driver.create({ data: { tenantId: tenant.id, userId: user.id } });

  const schichtStart = new Date();
  const schichtEnde = new Date(schichtStart.getTime());
  schichtEnde.setFullYear(schichtEnde.getFullYear() + 1);
  await db.shift.create({ data: { tenantId: tenant.id, driverId: driver.id, vehicleId: fahrzeug.id, start: schichtStart, end: schichtEnde } });

  return NextResponse.json({ tenantId: tenant.id, telefonnummer: TESTNUMMER });
}
