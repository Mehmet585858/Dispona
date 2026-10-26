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
const WRITE_UNIQUE_OPS = new Set(["update", "delete", "upsert"]);

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
          const typedArgs = args as Args;

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

          if (READ_UNIQUE_OPS.has(operation) || WRITE_UNIQUE_OPS.has(operation)) {
            // id identifiziert die Zeile eindeutig; das wird hier unabhängig vom select/include
            // des Aufrufers geprüft (nie anhand des Ergebnisses selbst – das könnte tenantId
            // durch ein eigenes select ausblenden).
            const client = prisma as unknown as Record<
              string,
              { findFirst: (a: unknown) => Promise<unknown> }
            >;
            const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
            const owned = await client[modelKey]?.findFirst({
              where: { ...(typedArgs.where ?? {}), tenantId },
              select: { id: true },
            });
            if (!owned) {
              if (operation === "findUniqueOrThrow") {
                throw new Error("Nicht gefunden.");
              }
              if (operation === "findUnique") {
                return null;
              }
              throw new Error("Nicht gefunden.");
            }
            return query(typedArgs);
          }

          return query(typedArgs);
        },
      },
    },
  });
}
