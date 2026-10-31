/**
 * Ein Fahrzeug (und damit den Fahrer aus der Schicht) einer Fahrt zuweisen – "Bestätigen" durch
 * den Disponenten (docs/05-disposition.md) und die automatische Disposition (dispatchMode "AUTO",
 * src/core/disposition/automatischDisponieren.ts) laufen beide hierüber.
 */
import { referenzenPruefen, withTenant, type TenantTx } from "@/lib/db";
import { fahrtStatusAendern, istUebergangErlaubt } from "@/core/rides/status";
import { pushAnFahrer } from "@/core/notify/push";
import { fahrtEntzogenText } from "@/core/notify/texte";
import { fahrerNachAenderungBenachrichtigen } from "@/core/rides/fahrerBenachrichtigen";
import { geplantesEnde } from "@/core/shifts/dauer";
import { pruefeFahrerImDienst } from "./automodus";

/** Wird geworfen, wenn das Zielfahrzeug zur Abholzeit schon anderweitig eingeplant ist - von
 * allen vier Aufrufern von fahrzeugZuweisen separat abgefangen (siehe dort), nie unbehandelt
 * durchgereicht. */
export class FahrzeugKonfliktError extends Error {}

/**
 * Maßnahme M-72 (Prüfbericht Durchgang 4, S1-008): Wird geworfen, wenn für das Zielfahrzeug zur
 * Abholzeit kein einsatzfähiger Fahrer eingeteilt ist. Vorher wurde die Fahrt trotzdem DISPONIERT
 * – mit driverId null: keine Push, keine Bestätigungs-SMS, kein Alarm, nicht in "Braucht Sie".
 * Wie FahrzeugKonfliktError von allen Aufrufern abgefangen und dem Disponenten als Meldung gezeigt.
 */
export class KeinFahrerError extends Error {}

/**
 * Bestimmt den Fahrer, der ein Fahrzeug zur Abholzeit tatsächlich fährt: Schicht läuft, Fahrer
 * nicht ausgefallen ("Ich falle aus"), nicht in Pause, nicht deaktiviert – dieselbe Regel wie
 * Sicherheitsbedingung 4 des Automodus (pruefeFahrerImDienst). Gibt es mehrere Schichten auf dem
 * Fahrzeug (z. B. Ersatzfahrer nach einem Ausfall), zählt die erste einsatzfähige. Ohne Treffer
 * KeinFahrerError mit dem Grund der zuletzt geprüften Schicht.
 */
export async function einsatzfaehigenFahrerFinden(
  db: TenantTx,
  vehicleId: string,
  pickupAt: Date,
): Promise<{ driverId: string }> {
  const schichten = await db.shift.findMany({
    where: { vehicleId, start: { lte: pickupAt }, end: { gte: pickupAt } },
    select: { driverId: true, start: true, end: true, onBreak: true, unavailable: true, driver: { select: { active: true } } },
    orderBy: { start: "asc" },
  });
  let grund = "Fahrer ist zur Abholzeit nicht im Dienst";
  for (const schicht of schichten) {
    const ergebnis = schicht.driver.active ? pruefeFahrerImDienst(schicht, pickupAt) : { erlaubt: false, grund: "Fahrer ist deaktiviert" };
    if (ergebnis.erlaubt) return { driverId: schicht.driverId };
    grund = ergebnis.grund ?? grund;
  }
  throw new KeinFahrerError(`${grund}. Erst eine Schicht für dieses Fahrzeug eintragen oder ein anderes Fahrzeug wählen.`);
}

function uhrzeitBerlin(datum: Date): string {
  return datum.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
}

/**
 * Probleme, die nur die Fahrzeugsuche betreffen und mit einer erfolgreichen Zuweisung erledigt sind
 * (Maßnahme M-20, docs/13 R2-6). Probleme der Fahrt selbst (GENEHMIGUNG_FEHLT, DOPPELBUCHUNG …)
 * bleiben stehen.
 */
export const DISPOSITIONS_PROBLEME = ["KEIN_FAHRZEUG", "Fahrer fällt aus", "FAHRT_ABGEBROCHEN"];

export async function fahrzeugZuweisen(
  tenantId: string,
  rideId: string,
  vehicleId: string,
  optionen: {
    dispatchMode: "MANUELL" | "AUTO";
    userId?: string;
    /** Maßnahme M-20: false, wenn der Aufrufer mehrere Schritte bündelt und selbst einmal meldet. */
    benachrichtigen?: boolean;
  },
) {
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({
    where: { id: rideId },
    select: {
      pickupAt: true,
      status: true,
      driverId: true,
      transportType: true,
      problems: true,
      pickupPlace: { select: { label: true, lat: true, lng: true } },
      dropoffPlace: { select: { label: true, lat: true, lng: true } },
    },
  });
  if (!fahrt) throw new Error("Fahrt nicht gefunden.");
  const vorherigerFahrerId = fahrt.driverId;
  // Prüfbericht S2-008: das Fahrzeug muss diesem Mandanten gehören (die Schichtsuche unten ist
  // zwar mandantengefiltert, der Fremdschlüssel vehicleId wäre es ohne diese Prüfung nicht).
  await referenzenPruefen(tenantId, { vehicle: [vehicleId] });

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

  // Prüfbericht S1-004: Prüfen und Schreiben passieren in EINER Transaktion, und davor holt sich
  // die Transaktion eine Postgres-Sperre je Fahrzeug (pg_advisory_xact_lock, wird am Ende der
  // Transaktion automatisch freigegeben). Zwei gleichzeitige Zuweisungen desselben Fahrzeugs –
  // Automodus-Cron und Disponenten-Klick zur selben Sekunde – laufen dadurch nacheinander: die
  // zweite sieht die erste schon im Fahrplan und bekommt den FahrzeugKonfliktError. Ohne Sperre
  // lasen beide "frei" und buchten beide (gegen Postgres reproduziert).
  // Maßnahme M-04 (R2-2, R1-1): auch der Statuswechsel nach DISPONIERT läuft in DERSELBEN
  // Transaktion (fahrtStatusAendern mit tx). Vorher wurden Fahrzeug und Fahrer geschrieben und erst
  // danach der Übergang geprüft – schlug der fehl (z. B. zwei überlappende Automodus-Läufe, die
  // dieselbe Fahrt auf verschiedene Fahrzeuge legen), zeigte die Fahrt auf ein Fahrzeug und einen
  // Fahrer, die nie benachrichtigt wurden. Jetzt rollt ein abgelehnter Übergang alles zurück.
  const schicht = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${vehicleId}))`;

    const aktuell = await tx.ride.findUnique({ where: { id: rideId }, select: { status: true } });
    if (!aktuell) throw new Error("Fahrt nicht gefunden.");
    if (!istUebergangErlaubt(aktuell.status, "DISPONIERT")) {
      throw new Error(`Übergang von ${aktuell.status} nach DISPONIERT ist nicht erlaubt.`);
    }

    const andereFahrtenDesFahrzeugs = await tx.ride.findMany({
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

    // Maßnahme M-72 (S1-008): ohne einsatzfähigen Fahrer keine Zuweisung – vorher wurde die Fahrt
    // auch ohne Schicht (oder mit ausgefallenem, pausierendem, deaktiviertem Fahrer) DISPONIERT,
    // mit driverId null. Der KeinFahrerError rollt die Transaktion zurück; zusätzlich lehnt die
    // Datenbank selbst jede DISPONIERT-Zeile ohne Fahrzeug und Fahrer ab (Migration
    // 20261031180000_disponiert_nur_mit_fahrer).
    const schichtInTx = await einsatzfaehigenFahrerFinden(tx, vehicleId, fahrt.pickupAt);

    await tx.ride.update({
      where: { id: rideId },
      data: {
        vehicleId,
        driverId: schichtInTx.driverId,
        dispatchMode: optionen.dispatchMode,
        driverAckAt: null,
        // Veralteter Grund eines früheren, gescheiterten Automodus-Versuchs darf nach erfolgreicher
        // Zuweisung nicht stehen bleiben - sonst zeigt die Fahrt dauerhaft einen längst überholten
        // Grund an, obwohl sie jetzt erfolgreich disponiert ist.
        autoSkipReason: null,
        // "KEIN_FAHRZEUG" widerspricht sich selbst, sobald genau das hier passiert (ein Fahrzeug
        // wird zugewiesen) - ohne diese Bereinigung blieb die Fahrt für immer in "Braucht Sie"
        // hängen (alarmFahrten dort prüft NUR problems.length > 0, unabhängig vom Status), auch
        // wenn sie längst erfolgreich disponiert war. Andere Probleme (z. B. GENEHMIGUNG_FEHLT)
        // betreffen die Fahrt selbst, nicht die Fahrzeugverfügbarkeit, und bleiben bewusst stehen.
        // Maßnahme M-20 (R2-6): ebenso ein überholter "Fahrer fällt aus" bzw. Abbruch-Vermerk.
        problems: fahrt.problems.filter((p) => !DISPOSITIONS_PROBLEME.includes(p)),
      },
    });
    await fahrtStatusAendern(tenantId, rideId, "DISPONIERT", { userId: optionen.userId, tx });
    return schichtInTx;
  });

  // Nur bei echtem Fahrerwechsel benachrichtigen (nicht bei bloßer Zeitänderung mit gleichem
  // Fahrer). Der Wechsel kann auch indirekt passieren: gleiches Fahrzeug, aber die neue Uhrzeit
  // fällt aus der Schicht des bisherigen Fahrers – dann muss er aktiv erfahren, dass sie ihm
  // entzogen wurde. Gemeinsame Regel in fahrerNachAenderungBenachrichtigen (Maßnahme M-20).
  if (optionen.benachrichtigen !== false) {
    await fahrerNachAenderungBenachrichtigen(
      tenantId,
      rideId,
      { driverId: vorherigerFahrerId, pickupAt: fahrt.pickupAt, status: fahrt.status },
      { driverId: schicht.driverId, pickupAt: fahrt.pickupAt, status: "DISPONIERT" },
      { geaendert: false },
    );
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
