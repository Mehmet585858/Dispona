import { headers } from "next/headers";
import { auth } from "./auth";
import { isRole, type Role } from "./roles";

/** Liest die aktuelle Anmeldung aus den Request-Headern (Server-Komponenten, Server Actions). */
export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Wie getServerSession(), wirft aber einen Fehler, wenn niemand angemeldet ist. Für Server Actions. */
export async function requireSession(): Promise<{
  tenantId: string;
  role: Role;
  userId: string;
  name: string;
  email: string;
}> {
  const session = await getServerSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }
  return {
    tenantId: session.user.tenantId,
    role: isRole(session.user.role) ? session.user.role : "DISPONENT",
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
  };
}
