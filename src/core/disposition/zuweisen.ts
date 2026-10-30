/**
 * Ein Fahrzeug (und damit den Fahrer aus der Schicht) einer Fahrt zuweisen – "Bestätigen" durch
 * den Disponenten (docs/05-disposition.md) und die automatische Disposition (dispatchMode "AUTO",
 * src/core/disposition/automatischDisponieren.ts) laufen beide hierüber.
 */
import { withTenant } from "@/lib/db";
import { fahrtStatusAendern } from "@/core/rides/status";
import { pushAnFahrer } from "@/core/notify/push";
import { fahrtEntzogenText, neueFahrtText } from "@/core/notify/texte";
import { geplantesEnde } from "@/core/shifts/dauer";

/** Wird geworfen, wenn das Zielfahrzeug zur Abholzeit schon anderweitig eingeplant ist - von
 * allen vier Aufrufern von fahrzeugZuweisen separat abgefangen (siehe dort), nie unbehandelt
 * durchgereicht. */
export class FahrzeugKonfliktError extends Error {}

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
      transportType: true,
      pickupPlace: { select: { label: true, lat: true, lng: true } },
      dropoffPlace: { select: { label: true, lat: true, lng: true } },
    },
  });
  if (!fahrt) throw new Error("Fahrt nicht gefunden.");
  const vorherigerFahrerId = fahrt.driverId;

  // Einziger Ort, der eine Doppelbuchung des Fahrzeugs zuverlässig abfängt: automatische
  // Disposition, "Plan für morgen", das manuelle Bestätigen/Umbesetzen und das Ziehen im
  // Zeitstrahl laufen alle hierüber. Ein beim Vorschlag geprüfter freier Slot kann seitdem durch
  // eine andere, inzwischen zugewiesene Fahrt belegt worden sein (z. B. zwei Vorschläge aus
  // unterschiedlichen Automodus-Läufen, die unabhängig voneinander dasselbe Fahrzeug als beste
  // Option hatten) - das wird hier anhand des tatsächlichen, aktuellen Fahrplans geprüft statt
  // anhand einer möglicherweise veralteten Momentaufnahme.
  const eigenesEnde = geplantesEnde(fahrt.pickupAt, fahrt.transportType, fahrt.pickupPlace, fahrt.dropoffPlace);
  const fensterVon = new Date(fahrt.pickupAt.getTime() - 24 * 60 * 60_000);
  const fensterBis = new Date(fahrt.pickupAt.getTime() + 24 * 60 * 60_000);
  const andereFahrtenDesFahrzeugs = await db.ride.findMany({
    where: {
      vehicleId,
      id: { not: rideId },
      status: { notIn: ["STORNIERT", "ERLEDIGT"] },
      pickupAt: { gte: fensterVon, lte: fensterBis },
    },
    select: {
      pickupAt: true,
      transportType: true,
      pickupPlace: { select: { lat: true, lng: true } },
      dropoffPlace: { select: { lat: true, lng: true } },
    },
  });
  const konflikt = andereFahrtenDesFahrzeugs.find((andere) => {
    const andereEnde = geplantesEnde(andere.pickupAt, andere.transportType, andere.pickupPlace, andere.dropoffPlace);
    return fahrt.pickupAt < andereEnde && andere.pickupAt < eigenesEnde;
  });
  if (konflikt) {
    throw new FahrzeugKonfliktError(
      `Dieses Fahrzeug ist um ${uhrzeitBerlin(konflikt.pickupAt)} Uhr schon für eine andere Fahrt eingeplant.`,
    );
  }

  const schicht = await db.shift.findFirst({
    where: { vehicleId, start: { lte: fahrt.pickupAt }, end: { gte: fahrt.pickupAt } },
    select: { driverId: true },
  });

  await db.ride.update({
    where: { id: rideId },
    data: {
      vehicleId,
      // driverId braucht das explizite "?? null": Prisma lässt ein undefined-Feld unangetastet,
      // ohne Schicht (kein Fahrer für Fahrzeug+Uhrzeit gefunden) würde sonst der vorherige Fahrer
      // in der Datenbank stehen bleiben, obwohl niemand mehr zuständig ist.
      driverId: schicht?.driverId ?? null,
      dispatchMode: optionen.dispatchMode,
      driverAckAt: null,
      // Veralteter Grund eines früheren, gescheiterten Automodus-Versuchs darf nach erfolgreicher
      // Zuweisung nicht stehen bleiben - sonst zeigt die Fahrt dauerhaft einen längst überholten
      // Grund an, obwohl sie jetzt erfolgreich disponiert ist.
      autoSkipReason: null,
    },
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

/** Hebt eine Fahrzeugzuweisung wieder auf ("Rückgängig" nach "Auto zuweisen", docs/DISPO-SPEZ.md
 * 3.4) - setzt die Fahrt zurück auf ERFASST ohne Fahrzeug/Fahrer und benachrichtigt den bisherigen
 * Fahrer, falls einer zugewiesen war, symmetrisch zu fahrzeugZuweisen() selbst. Nur aus DISPONIERT
 * erlaubt (passend zum Übergang in status.ts) - eine schon losgefahrene Fahrt lässt sich nicht
 * einfach zurücknehmen. */
export async function fahrzeugZuweisungAufheben(tenantId: string, rideId: string, optionen: { userId?: string }) {
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({
    where: { id: rideId },
    select: { status: true, driverId: true, pickupAt: true },
  });
  if (!fahrt) throw new Error("Fahrt nicht gefunden.");
  if (fahrt.status !== "DISPONIERT") {
    throw new Error("Diese Zuweisung kann nicht mehr rückgängig gemacht werden.");
  }
  const bisherigerFahrerId = fahrt.driverId;

  await fahrtStatusAendern(tenantId, rideId, "ERFASST", { userId: optionen.userId });
  await db.ride.update({
    where: { id: rideId },
    data: { vehicleId: null, driverId: null, dispatchMode: null, driverAckAt: null },
  });

  if (bisherigerFahrerId) {
    await pushAnFahrer(tenantId, bisherigerFahrerId, {
      title: "Fahrt entzogen",
      body: fahrtEntzogenText(uhrzeitBerlin(fahrt.pickupAt)),
      url: "/fahrer",
    });
    await db.notification.create({
      data: { tenantId, channel: "PUSH", toRef: bisherigerFahrerId, rideId, kind: "FAHRT_ENTZOGEN" },
    });
  }
}
