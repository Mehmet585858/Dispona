/**
 * Ein Fahrzeug (und damit den Fahrer aus der Schicht) einer Fahrt zuweisen – "Bestätigen" durch
 * den Disponenten (docs/05-disposition.md) und die automatische Disposition (dispatchMode "AUTO",
 * src/core/disposition/automatischDisponieren.ts) laufen beide hierüber.
 */
import { withTenant } from "@/lib/db";
import { fahrtStatusAendern } from "@/core/rides/status";
import { pushAnFahrer } from "@/core/notify/push";
import { fahrtEntzogenText, neueFahrtText } from "@/core/notify/texte";

function uhrzeitBerlin(datum: Date): string {
  return datum.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
}

export async function fahrzeugZuweisen(
  tenantId: string,
  rideId: string,
  vehicleId: string,
  optionen: { dispatchMode: "MANUELL" | "AUTO"; userId?: string },
) {
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({
    where: { id: rideId },
    select: {
      pickupAt: true,
      driverId: true,
      pickupPlace: { select: { label: true } },
      dropoffPlace: { select: { label: true } },
    },
  });
  if (!fahrt) throw new Error("Fahrt nicht gefunden.");
  const vorherigerFahrerId = fahrt.driverId;

  const schicht = await db.shift.findFirst({
    where: { vehicleId, start: { lte: fahrt.pickupAt }, end: { gte: fahrt.pickupAt } },
    select: { driverId: true },
  });

  await db.ride.update({
    where: { id: rideId },
    // driverId braucht das explizite "?? null": Prisma lässt ein undefined-Feld unangetastet,
    // ohne Schicht (kein Fahrer für Fahrzeug+Uhrzeit gefunden) würde sonst der vorherige Fahrer in
    // der Datenbank stehen bleiben, obwohl niemand mehr zuständig ist.
    data: { vehicleId, driverId: schicht?.driverId ?? null, dispatchMode: optionen.dispatchMode, driverAckAt: null },
  });
  await fahrtStatusAendern(tenantId, rideId, "DISPONIERT", { userId: optionen.userId });

  // Nur bei echtem Fahrerwechsel benachrichtigen (nicht bei bloßer Zeitänderung mit gleichem
  // Fahrer, z. B. per Drag im Zeitstrahl – sonst doppelte Push mit fahrtAendern). Der Wechsel kann
  // auch indirekt passieren: gleiches Fahrzeug, aber die neue Uhrzeit fällt aus der Schicht des
  // bisherigen Fahrers. Der bisherige Fahrer bekam diese Fahrt zuvor evtl. schon bestätigt und muss
  // aktiv erfahren, dass sie ihm entzogen wurde, sonst fährt er sie im Zweifel trotzdem.
  const fahrerHatSichGeaendert = schicht?.driverId !== vorherigerFahrerId;
  if (vorherigerFahrerId && fahrerHatSichGeaendert) {
    await pushAnFahrer(tenantId, vorherigerFahrerId, {
      title: "Fahrt entzogen",
      body: fahrtEntzogenText(uhrzeitBerlin(fahrt.pickupAt)),
      url: "/fahrer",
    });
    await db.notification.create({
      data: { tenantId, channel: "PUSH", toRef: vorherigerFahrerId, rideId, kind: "FAHRT_ENTZOGEN" },
    });
  }
  if (schicht?.driverId && fahrerHatSichGeaendert) {
    const text = neueFahrtText(uhrzeitBerlin(fahrt.pickupAt), fahrt.pickupPlace.label, fahrt.dropoffPlace.label);
    await pushAnFahrer(tenantId, schicht.driverId, { title: "Neue Fahrt", body: text, url: "/fahrer" });
    await db.notification.create({
      data: { tenantId, channel: "PUSH", toRef: schicht.driverId, rideId, kind: "NEUE_FAHRT" },
    });
  }

  const vorschlag = await db.suggestion.findFirst({
    where: { rideId, decision: "OFFEN" },
    orderBy: { createdAt: "desc" },
  });
  if (vorschlag) {
    const optionenListe = vorschlag.options as { vehicleId: string }[];
    const istBesterVorschlag = optionenListe[0]?.vehicleId === vehicleId;
    await db.suggestion.update({
      where: { id: vorschlag.id },
      data: {
        decision: istBesterVorschlag ? "ANGENOMMEN" : "GEAENDERT",
        chosenVehicleId: vehicleId,
        decidedByUserId: optionen.userId,
        decidedAt: new Date(),
      },
    });
  }
}
