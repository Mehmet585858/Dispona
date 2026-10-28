import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { withTenant } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { berlinerMitternacht } from "@/core/shifts/week";
import {
  exportZeilenBauen,
  spaltenReihenfolgeBereinigen,
  type FahrtFuerExport,
} from "@/core/export/abrechnung";

/**
 * Export erledigter Fahrten für die Abrechnung (docs/07-adapter.md): CSV oder Excel, als
 * authentifizierter Download (GET statt Server Action, damit der Browser den Dateinamen und
 * die Downloadbox normal anzeigt). Markiert die enthaltenen Fahrten als exportiert.
 */
export async function GET(request: NextRequest) {
  const { tenantId, userId } = await requireSession();
  const params = request.nextUrl.searchParams;
  const vonIso = params.get("von");
  const bisIso = params.get("bis");
  const format = params.get("format") === "xlsx" ? "xlsx" : "csv";
  const nurNichtExportierte = params.get("nurNichtExportierte") !== "false";

  if (!vonIso || !bisIso) {
    return NextResponse.json({ error: "Zeitraum fehlt (von, bis)." }, { status: 400 });
  }

  const db = withTenant(tenantId);
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { paket: true } });
  if (tenant?.paket === "LITE") {
    return NextResponse.json({ error: "Das Fahrtenbuch ist Teil des Pakets Pro." }, { status: 403 });
  }

  const von = berlinerMitternacht(vonIso);
  const bis = new Date(berlinerMitternacht(bisIso));
  bis.setDate(bis.getDate() + 1);

  const fahrtenRoh = await db.ride.findMany({
    where: {
      status: "ERLEDIGT",
      pickupAt: { gte: von, lt: bis },
      exportedAt: nurNichtExportierte ? null : undefined,
    },
    include: { passenger: true, pickupPlace: true, dropoffPlace: true, vehicle: { select: { plate: true } } },
    orderBy: { pickupAt: "asc" },
  });

  if (fahrtenRoh.length === 0) {
    return NextResponse.json({ error: "Keine erledigten Fahrten im gewählten Zeitraum gefunden." }, { status: 404 });
  }

  const fahrerIds = [...new Set(fahrtenRoh.map((f) => f.driverId).filter((id): id is string => id !== null))];
  const fahrer = await db.driver.findMany({
    where: { id: { in: fahrerIds } },
    select: { id: true, user: { select: { name: true } } },
  });
  const fahrerNameNachId = new Map(fahrer.map((f) => [f.id, f.user.name]));

  const fahrten: FahrtFuerExport[] = fahrtenRoh.map((f) => ({
    passenger: {
      firstName: f.passenger.firstName,
      lastName: f.passenger.lastName,
      birthDate: f.passenger.birthDate,
      insurer: f.passenger.insurer,
    },
    pickupAt: f.pickupAt,
    completedAt: f.completedAt,
    pickupPlace: f.pickupPlace,
    dropoffPlace: f.dropoffPlace,
    transportType: f.transportType,
    distanceKm: f.distanceKm,
    vehiclePlate: f.vehicle?.plate ?? null,
    fahrerName: f.driverId ? (fahrerNameNachId.get(f.driverId) ?? null) : null,
    prescription: f.prescription,
    approval: f.approval,
    seriesId: f.seriesId,
    assistanceNotes: f.assistanceNotes,
    problems: f.problems,
  }));

  const settings = await db.tenantSettings.findUnique({ where: { tenantId }, select: { exportTemplate: true } });
  const spalten = spaltenReihenfolgeBereinigen(settings?.exportTemplate);
  const { kopf, zeilen } = exportZeilenBauen(fahrten, spalten);

  const dateiname = `abrechnung-${vonIso}-bis-${bisIso}.${format}`;

  await db.ride.updateMany({
    where: { id: { in: fahrtenRoh.map((f) => f.id) } },
    data: { exportedAt: new Date() },
  });
  await db.auditLog.create({
    data: {
      tenantId,
      userId,
      action: "ride.export_abrechnung",
      entity: "Ride",
      entityId: `${vonIso}..${bisIso} (${fahrtenRoh.length})`,
    },
  });

  if (format === "csv") {
    const csv = Papa.unparse({ fields: kopf, data: zeilen });
    return new NextResponse(`﻿${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${dateiname}"`,
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  const blatt = workbook.addWorksheet("Abrechnung");
  blatt.addRow(kopf);
  for (const zeile of zeilen) blatt.addRow(zeile);
  blatt.getRow(1).font = { bold: true };
  const puffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(puffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${dateiname}"`,
    },
  });
}
