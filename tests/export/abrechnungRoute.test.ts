import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Nur die Quelle der Sitzung wird gemockt (Request-Header + better-auth-Lookup); die eigentliche
// Rollenprüfung in src/lib/session.ts und der Route läuft echt. Prisma-Zugriffe der Route kommen
// erst NACH der Rollenprüfung dran und werden hier nie erreicht.
const sitzung = vi.hoisted(() => ({ wert: null as null | { tenantId: string; userId: string; role: string } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () =>
        sitzung.wert
          ? {
              user: { id: sitzung.wert.userId, tenantId: sitzung.wert.tenantId, role: sitzung.wert.role, name: "Test", email: "t@t.de" },
              session: { createdAt: new Date() },
            }
          : null,
      ),
    },
  },
}));

import { GET } from "@/app/api/export/abrechnung/route";

function anfrage(query = "von=2026-10-01&bis=2026-10-31&nurNichtExportierte=false") {
  return new NextRequest(`http://localhost:3000/api/export/abrechnung?${query}`);
}

describe("GET /api/export/abrechnung – Zugriffsschutz", () => {
  beforeEach(() => {
    sitzung.wert = null;
  });

  it("S1-001: Export verweigert Rolle FAHRER mit 403", async () => {
    sitzung.wert = { tenantId: "t1", userId: "u1", role: "FAHRER" };
    const antwort = await GET(anfrage());
    expect(antwort.status).toBe(403);
    expect(antwort.headers.get("content-type")).not.toContain("text/csv");
  });

  it("S1-001: ohne Sitzung 401 statt 500", async () => {
    const antwort = await GET(anfrage());
    expect(antwort.status).toBe(401);
  });

  it("S1-001 (Härtung): ungültiges Datum → 400 statt 500", async () => {
    sitzung.wert = { tenantId: "t1", userId: "u1", role: "ADMIN" };
    const antwort = await GET(anfrage("von=gestern&bis=2026-10-31"));
    expect(antwort.status).toBe(400);
  });
});
