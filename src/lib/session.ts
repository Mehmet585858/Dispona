import { headers } from "next/headers";
import { auth } from "./auth";

/** Liest die aktuelle Anmeldung aus den Request-Headern (Server-Komponenten, Server Actions). */
export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}
