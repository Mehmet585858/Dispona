import { headers } from "next/headers";
import { auth } from "./auth";
import { isRole, type Role } from "./roles";

/** Niemand angemeldet – API-Routen antworten damit 401, Server Actions werfen weiter. */
export class NichtAngemeldetError extends Error {
  constructor(meldung = "Nicht angemeldet.") {
    super(meldung);
  }
}

/** Angemeldet, aber die Rolle darf das nicht – API-Routen antworten damit 403. */
export class KeineBerechtigungError extends Error {
  constructor(meldung = "Keine Berechtigung.") {
    super(meldung);
  }
}

/**
 * Büro-Sitzungen gelten nur 12 Stunden (docs/08-datenschutz-sicherheit.md), Fahrer bleiben die
 * vollen 30 Tage angemeldet (src/lib/auth.ts). better-auth kennt keine rollenabhängige
 * Sitzungsdauer – deshalb wird die Grenze hier (Server Actions, API-Routen) und in src/proxy.ts
 * (Seiten) durchgesetzt. Maßnahme M-02 / Prüfbericht S3-018: vorher galt sie nur für Seiten.
 */
export const BUERO_SITZUNG_MAX_MS = 12 * 60 * 60 * 1000;

export function istBueroSitzungAbgelaufen(role: Role, createdAt: Date, jetzt: Date = new Date()): boolean {
  if (role === "FAHRER") return false;
  return jetzt.getTime() - createdAt.getTime() > BUERO_SITZUNG_MAX_MS;
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

/**
 * Sitzung lesen, Rolle und (fürs Büro) Sitzungsalter prüfen. Nicht direkt aus Actions aufrufen –
 * dort immer requireBueroSession() oder requireFahrerSession(), damit die Rolle nie vergessen wird
 * (tests/sicherheit/serverActions.test.ts prüft das für jede "use server"-Datei).
 */
export async function requireSession(): Promise<Sitzung> {
  const session = await getServerSession();
  if (!session) {
    throw new NichtAngemeldetError();
  }
  const role: Role = isRole(session.user.role) ? session.user.role : "DISPONENT";
  if (istBueroSitzungAbgelaufen(role, new Date(session.session.createdAt))) {
    throw new NichtAngemeldetError("Die Anmeldung ist abgelaufen. Bitte erneut anmelden.");
  }
  return {
    tenantId: session.user.tenantId,
    role,
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

/** Nur der Inhaber (ADMIN). */
export async function requireAdminSession(): Promise<Sitzung> {
  const sitzung = await requireBueroSession();
  if (sitzung.role !== "ADMIN") {
    throw new KeineBerechtigungError("Nur der Inhaber (Admin) darf diese Funktion nutzen.");
  }
  return sitzung;
}

/**
 * Nur Fahrer. Die Fahrer-App-Actions prüften vorher nur "es gibt eine Driver-Zeile zu diesem
 * Konto" – ein Büro-Konto mit versehentlich angelegtem Fahrerprofil hätte sie nutzen können
 * (docs/13 R3-6, Maßnahme M-02).
 */
export async function requireFahrerSession(): Promise<Sitzung> {
  const sitzung = await requireSession();
  if (sitzung.role !== "FAHRER") {
    throw new KeineBerechtigungError("Nur Fahrer dürfen diese Funktion nutzen.");
  }
  return sitzung;
}
