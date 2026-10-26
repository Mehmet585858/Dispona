export const ROLES = ["ADMIN", "DISPONENT", "FAHRER"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Wohin nach der Anmeldung weitergeleitet wird (docs/02-architektur.md). */
export function startSeiteFuer(role: Role, tenantSetupDoneAt: Date | null): string {
  if (role === "FAHRER") {
    return "/fahrer";
  }
  if (role === "ADMIN" && !tenantSetupDoneAt) {
    return "/einrichtung";
  }
  return "/dispo";
}
