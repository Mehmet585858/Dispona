import { NextResponse, type NextRequest } from "next/server";
import { withTenant } from "@/lib/db";
import { mitUhrzeit } from "@/core/shifts/week";
import { DEMO_TENANT_ID } from "@/core/demo/const";
import type { TransportType } from "@/generated/prisma/enums";

/**
 * EINMALIGER Korrektur-Lauf (nicht in vercel.json eingetragen, nach Gebrauch wieder löschen):
 * behebt bestehende Fahrgast-Namenskollisionen aus der Zeit vor dem Hin-/Rückfahrt-Fix in
 * betriebSimulieren.ts, OHNE die Fahrten selbst zu löschen - nur passengerId wird bei Bedarf auf
 * einen heute noch unbenutzten Namen aus dem Roster umgebogen. Dieselbe Regel wie im laufenden
 * Betrieb: jeder Name höchstens zweimal "heute", das zweite Mal nur als exakte Rückfahrt
 * (umgekehrte Route, gleiche Transportart). Reicht das Roster nicht für alle Korrekturen, bleibt
 * der Rest unverändert (lieber eine Restkollision als eine Fahrt kaputt machen) - läuft über die
 * normale stündliche demoZuruecksetzen-Aufräumung ohnehin aus.
 */
type TagesInfo = {
  pickupPlaceId: string;
  dropoffPlaceId: string;
  transportType: TransportType;
  anzahl: number;
};

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const erlaubnis = request.headers.get("authorization");
  if (!secret || erlaubnis !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const tenantId = DEMO_TENANT_ID;
  const db = withTenant(tenantId);
  const jetzt = new Date();
  const tagesStart = mitUhrzeit(jetzt, "00:00");
  const tagesEnde = mitUhrzeit(jetzt, "23:59");

  const [passagiere, fahrten] = await Promise.all([
    db.passenger.findMany({ select: { id: true, firstName: true, lastName: true } }),
    db.ride.findMany({
      where: { pickupAt: { gte: tagesStart, lte: tagesEnde }, status: { not: "STORNIERT" } },
      include: { pickupPlace: true, dropoffPlace: true },
      orderBy: { pickupAt: "asc" },
    }),
  ]);

  const tagesInfo = new Map<string, TagesInfo>();
  let korrigiert = 0;
  let unaufloesbar = 0;

  for (const fahrt of fahrten) {
    const bestehend = tagesInfo.get(fahrt.passengerId);
    let istGueltig: boolean;
    if (!bestehend) {
      istGueltig = true; // erste Fahrt für diesen Namen heute
    } else if (bestehend.anzahl === 1) {
      istGueltig =
        bestehend.transportType === fahrt.transportType &&
        bestehend.pickupPlaceId === fahrt.dropoffPlaceId &&
        bestehend.dropoffPlaceId === fahrt.pickupPlaceId;
    } else {
      istGueltig = false; // dritte+ Fahrt für denselben Namen - nie gültig
    }

    let zielPassagierId = fahrt.passengerId;
    if (!istGueltig) {
      const frischerKandidat = passagiere.find((p) => !tagesInfo.has(p.id));
      if (frischerKandidat) {
        zielPassagierId = frischerKandidat.id;
        await db.ride.update({ where: { id: fahrt.id }, data: { passengerId: frischerKandidat.id } });
        korrigiert += 1;
      } else {
        unaufloesbar += 1; // Roster für heute komplett verplant - bleibt wie es ist
      }
    }

    const vorher = tagesInfo.get(zielPassagierId);
    tagesInfo.set(zielPassagierId, {
      pickupPlaceId: fahrt.pickupPlaceId,
      dropoffPlaceId: fahrt.dropoffPlaceId,
      transportType: fahrt.transportType,
      anzahl: (vorher?.anzahl ?? 0) + 1,
    });
  }

  return NextResponse.json({ geprueft: fahrten.length, korrigiert, unaufloesbar });
}
