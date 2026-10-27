import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRole, startSeiteFuer } from "@/lib/roles";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    if (pathname === "/anmeldung") {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/anmeldung", request.url));
  }

  const role = isRole(session.user.role) ? session.user.role : "DISPONENT";

  // Büro-Sitzungen gelten nur 12 Stunden (docs/08-datenschutz-sicherheit.md), Fahrer bleiben die
  // vollen 30 Tage angemeldet (src/lib/auth.ts) – better-auth kennt keine rollenabhängige
  // Sitzungsdauer, deshalb hier zusätzlich durchgesetzt statt die Sitzung selbst zu verkürzen.
  const BUERO_SITZUNG_MAX_MS = 12 * 60 * 60 * 1000;
  if (role !== "FAHRER") {
    const alterMs = Date.now() - new Date(session.session.createdAt).getTime();
    if (alterMs > BUERO_SITZUNG_MAX_MS && pathname !== "/anmeldung") {
      return NextResponse.redirect(new URL("/anmeldung", request.url));
    }
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { setupDoneAt: true },
  });
  const ziel = startSeiteFuer(role, tenant?.setupDoneAt ?? null);

  if (pathname === "/anmeldung" || pathname === "/") {
    return NextResponse.redirect(new URL(ziel, request.url));
  }

  const istErlaubt =
    (pathname.startsWith("/fahrer") && role === "FAHRER") ||
    (pathname.startsWith("/einrichtung") && role === "ADMIN") ||
    (pathname.startsWith("/dispo") && role !== "FAHRER");

  if (!istErlaubt) {
    return NextResponse.redirect(new URL(ziel, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/anmeldung", "/dispo/:path*", "/einrichtung/:path*", "/fahrer/:path*"],
};
