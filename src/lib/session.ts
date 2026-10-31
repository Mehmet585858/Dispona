import { headers } from "next/headers";
import { auth } from "./auth";
import { isRole, type Role } from "./roles";

/** Niemand angemeldet – API-Routen antworten damit 401, Server Actions werfen weiter. */
export class NichtAngemeldetError extends Error {
  constructor() {
    super("Nicht angemeldet.");
  }
}

/** Angemeldet, aber die Rolle darf das nicht – API-Routen antworten damit 403. */
export class KeineBerechtigungError extends Error {
  constructor(meldung = "Keine Berechtigung.") {
    super(meldung);
  }
}

/** Liest die aktuelle Anmeldung aus den Request-Headern (Server-Komponenten, Server Actions). */
export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}

export type Sitzung = {
  tenantId: string;
  role: Role;
  userId: string;
  name: string;
  email: string;
};

/** Wie getServerSession(), wirft aber einen Fehler, wenn niemand angemeldet ist. Für Server Actions. */
export async function requireSession(): Promise<Sitzung> {
  const session = await getServerSession();
  if (!session) {
    throw new NichtAngemeldetError();
  }
  return {
    tenantId: session.user.tenantId,
    role: isRole(session.user.role) ? session.user.role : "DISPONENT",
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
  };
}

/**
 * Nur Büro (ADMIN, DISPONENT). Fahrer haben in der Fahrer-App keinen Zugriff auf Stammdaten,
 * Abrechnung oder Disposition (docs/08-datenschutz-sicherheit.md) – Prüfbericht S1-001.
 */
export async function requireBueroSession(): Promise<Sitzung> {
  const sitzung = await requireSession();
  if (sitzung.role === "FAHRER") {
    throw new KeineBerechtigungError("Nur das Büro darf diese Funktion nutzen.");
  }
  return sitzung;
}
