import { prisma } from "./prisma";

/**
 * Modelle mit einer tenantId-Spalte. Tenant, TenantSettings und Integration haben
 * tenantId als Primärschlüssel (dort reicht die normale Schlüsselprüfung), Job ist
 * mandantenübergreifend. Alle anderen werden hier automatisch gefiltert.
 */
const TENANT_MODELS = new Set([
  "User",
  "PhoneNumber",
  "Vehicle",
  "Driver",
  "PushSubscription",
  "Shift",
  "VehicleLocation",
  "Passenger",
  "Place",
  "Approval",
  "Ride",
  "RideStatusEvent",
  "RideSeries",
  "Suggestion",
  "Call",
  "Notification",
  "AuditLog",
  "VoiceToolCall",
]);

const READ_MANY_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);
const READ_UNIQUE_OPS = new Set(["findUnique", "findUniqueOrThrow"]);
const WRITE_MANY_OPS = new Set(["updateMany", "deleteMany"]);
// upsert wird unten eigenständig behandelt (nicht hier), weil die Zeile bei einem Upsert noch gar
// nicht existieren muss.
const WRITE_UNIQUE_OPS = new Set(["update", "delete"]);

type Args = { where?: Record<string, unknown>; data?: unknown } & Record<string, unknown>;

/**
 * Gibt einen Prisma-Client zurück, der jede Abfrage automatisch nach tenantId filtert.
 * Nie prisma.ride.findMany() o. Ä. direkt aufrufen – immer withTenant(tenantId) nutzen.
 */
export function withTenant(tenantId: string) {
  return prisma.$extends({
    name: "withTenant",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) {
            return query(args);
          }
          try {
            return await mandantenAbfrage(tenantId, model, operation, args as Args, query);
          } catch (fehler) {
            // Maßnahme M-11: Die Datenbank lehnt Fremdschlüssel auf Zeilen eines anderen Mandanten
            // ab (Trigger aus Migration 20261031130000_mandant_fremdschluessel). Nach außen wie
            // referenzenPruefen(): FremdeReferenzError mit verständlichem Text.
            const fremd = fremdeReferenzAusFehler(fehler);
            if (fremd) throw new FremdeReferenzError(`${fremd} nicht gefunden.`);
            throw fehler;
          }
        },
      },
    },
  });
}

async function mandantenAbfrage(
  tenantId: string,
  model: string,
  operation: string,
  typedArgs: Args,
  query: (args: Args) => Promise<unknown>,
): Promise<unknown> {
  if (READ_MANY_OPS.has(operation) || WRITE_MANY_OPS.has(operation)) {
    typedArgs.where = { ...(typedArgs.where ?? {}), tenantId };
    return query(typedArgs);
  }

  if (operation === "create") {
    typedArgs.data = { ...(typedArgs.data as Record<string, unknown>), tenantId };
    return query(typedArgs);
  }

  if (operation === "createMany") {
    const items = typedArgs.data as Record<string, unknown>[];
    typedArgs.data = items.map((item) => ({ ...item, tenantId }));
    return query(typedArgs);
  }

  if (operation === "upsert") {
    // Die sonstige Eigentums-Prüfung unten (findFirst mit tenantId im where) würde bei
    // einem Upsert immer "nicht gefunden" ergeben, solange die Zeile noch nicht existiert
    // (z. B. erstmalige Push-Registrierung eines Geräts) - der Datensatz könnte dann nie
    // angelegt werden. Deshalb hier stattdessen: irgendeine Zeile mit diesem where suchen
    // (egal welcher Mandant), und nur ablehnen, wenn sie einem ANDEREN Mandanten gehört.
    // Gehört sie niemandem, darf der Upsert anlegen - create() verlangt ohnehin tenantId
    // im data.create, genau wie der normale create-Fall oben.
    const client = prisma as unknown as Record<
      string,
      { findFirst: (a: unknown) => Promise<{ tenantId: string } | null> }
    >;
    const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
    const bestehend = await client[modelKey]?.findFirst({
      where: typedArgs.where ?? {},
      select: { tenantId: true },
    });
    if (bestehend && bestehend.tenantId !== tenantId) {
      throw new Error("Nicht gefunden.");
    }
    return query(typedArgs);
  }

  if (READ_UNIQUE_OPS.has(operation) || WRITE_UNIQUE_OPS.has(operation)) {
    // tenantId wird direkt in das where des eindeutigen Zugriffs aufgenommen (Prisma erlaubt
    // in findUnique/update/delete zusätzliche Nicht-Unique-Felder). Vorher lief hier ein
    // getrennter findFirst über den globalen Client – der sah innerhalb einer Transaktion
    // (db.$transaction) eine gerade erst angelegte Zeile nicht und meldete "Nicht gefunden."
    // (Maßnahme M-04/M-23: Zuweisung und Erfassen laufen jetzt in Transaktionen). Die
    // Prüfung bleibt unabhängig vom select/include des Aufrufers.
    typedArgs.where = { ...(typedArgs.where ?? {}), tenantId };
    try {
      return await query(typedArgs);
    } catch (fehler) {
      // Fremde oder fehlende Zeile: Prisma meldet P2025 – nach außen wie bisher "Nicht gefunden.".
      if (istNichtGefundenFehler(fehler)) {
        throw new Error("Nicht gefunden.");
      }
      throw fehler;
    }
  }

  return query(typedArgs);
}

/** Wird geworfen, wenn eine referenzierte Zeile (Fahrgast, Ort, Fahrzeug, …) nicht zu diesem Mandanten gehört. */
export class FremdeReferenzError extends Error {}

const REFERENZ_LABEL = {
  passenger: "Fahrgast",
  place: "Ort",
  vehicle: "Fahrzeug",
  driver: "Fahrer",
  ride: "Fahrt",
  shift: "Schicht",
} as const;
export type ReferenzModell = keyof typeof REFERENZ_LABEL;

/**
 * Prüft vor dem Schreiben, dass alle übergebenen IDs zu diesem Mandanten gehören (Prüfbericht
 * S2-008): withTenant() filtert nur die Zieltabelle, nicht die Fremdschlüssel in `data`. Eine
 * Fahrt für Mandant A konnte so auf Fahrgast und Ort von Mandant B zeigen – und A sah über
 * include anschließend dessen Namen. Unbekannte oder fremde IDs werfen FremdeReferenzError.
 */
export async function referenzenPruefen(
  tenantId: string,
  referenzen: Partial<Record<ReferenzModell, (string | null | undefined)[]>>,
): Promise<void> {
  const db = withTenant(tenantId);
  // Je Modell eine eigene, typisierte count-Funktion (Prisma-Signaturen lassen sich nicht als
  // Union aufrufen). withTenant() ergänzt tenantId im where.
  const zaehlen: Record<ReferenzModell, (ids: string[]) => Promise<number>> = {
    passenger: (ids) => db.passenger.count({ where: { id: { in: ids } } }),
    place: (ids) => db.place.count({ where: { id: { in: ids } } }),
    vehicle: (ids) => db.vehicle.count({ where: { id: { in: ids } } }),
    driver: (ids) => db.driver.count({ where: { id: { in: ids } } }),
    ride: (ids) => db.ride.count({ where: { id: { in: ids } } }),
    shift: (ids) => db.shift.count({ where: { id: { in: ids } } }),
  };
  for (const [modell, roh] of Object.entries(referenzen) as [
    ReferenzModell,
    (string | null | undefined)[],
  ][]) {
    const ids = [
      ...new Set((roh ?? []).filter((id): id is string => typeof id === "string" && id.length > 0)),
    ];
    if (ids.length === 0) continue;
    const anzahl = await zaehlen[modell](ids);
    if (anzahl !== ids.length) {
      throw new FremdeReferenzError(`${REFERENZ_LABEL[modell]} nicht gefunden.`);
    }
  }
}

/** Spalte → Bezeichnung für die Meldung, wenn der Mandanten-Trigger (M-11) einen Fremdschlüssel ablehnt. */
const SPALTEN_LABEL: Record<string, string> = {
  passengerId: "Fahrgast",
  pickupPlaceId: "Ort",
  dropoffPlaceId: "Ort",
  homePlaceId: "Ort",
  vehicleId: "Fahrzeug",
  chosenVehicleId: "Fahrzeug",
  driverId: "Fahrer",
  rideId: "Fahrt",
  returnOfId: "Fahrt",
  seriesId: "Serie",
  callId: "Anruf",
  userId: "Nutzer",
  byUserId: "Nutzer",
  decidedByUserId: "Nutzer",
};

/**
 * Erkennt die Ablehnung durch den Mandanten-Trigger (Text beginnt mit FREMDE_REFERENZ, siehe
 * Migration 20261031130000_mandant_fremdschluessel) und liefert die Bezeichnung der Spalte –
 * sonst null. Prisma meldet ihn als P2003; der Originaltext steht in meta.driverAdapterError.
 */
export function fremdeReferenzAusFehler(fehler: unknown): string | null {
  if (typeof fehler !== "object" || fehler === null) return null;
  const f = fehler as {
    message?: string;
    meta?: { driverAdapterError?: { cause?: { originalMessage?: string } } };
  };
  const text = f.meta?.driverAdapterError?.cause?.originalMessage ?? f.message ?? "";
  const treffer = /FREMDE_REFERENZ \w+\.(\w+)/.exec(text);
  if (!treffer) return null;
  return SPALTEN_LABEL[treffer[1]] ?? "Verknüpfte Angabe";
}

/** Prisma-Fehler P2002: Eindeutigkeitsregel verletzt (z. B. E-Mail oder Rufnummer schon vergeben). */
export function istEindeutigkeitsFehler(fehler: unknown): boolean {
  return (
    typeof fehler === "object" && fehler !== null && (fehler as { code?: string }).code === "P2002"
  );
}

/** Prisma-Fehler P2025: Zeile für update/delete/findUniqueOrThrow nicht gefunden. */
export function istNichtGefundenFehler(fehler: unknown): boolean {
  return (
    typeof fehler === "object" && fehler !== null && (fehler as { code?: string }).code === "P2025"
  );
}

/** Mandantengefilterter Client (Rückgabe von withTenant) und der Client innerhalb von db.$transaction(). */
export type TenantDb = ReturnType<typeof withTenant>;
type TransaktionsRueckruf = Parameters<TenantDb["$transaction"]>[0];
export type TenantTx = TransaktionsRueckruf extends (tx: infer T) => unknown ? T : never;
