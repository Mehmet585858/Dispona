import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Maßnahme M-02: Sitzung, Rolle UND Sitzungsalter werden zentral geprüft (src/lib/session.ts).
 * Prüfbericht S3-018: die 12-Stunden-Grenze für Bürositzungen galt nur für Seiten (proxy.ts),
 * nicht für API-Routen und Server Actions. Hier wird nur die Quelle der Sitzung gemockt, die
 * Prüfung selbst läuft echt.
 */
const sitzung = vi.hoisted(() => ({
  wert: null as null | { tenantId: string; userId: string; role: string; createdAt: Date },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () =>
        sitzung.wert
          ? {
              user: { id: sitzung.wert.userId, tenantId: sitzung.wert.tenantId, role: sitzung.wert.role, name: "Test", email: "t@t.de" },
              session: { createdAt: sitzung.wert.createdAt },
            }
          : null,
      ),
    },
  },
}));

import { GET } from "@/app/api/export/abrechnung/route";
import {
  BUERO_SITZUNG_MAX_MS,
  istBueroSitzungAbgelaufen,
  KeineBerechtigungError,
  NichtAngemeldetError,
  requireBueroSession,
  requireFahrerSession,
} from "@/lib/session";

const VOR_13_STUNDEN = new Date(Date.now() - 13 * 60 * 60 * 1000);

describe("M-02: Sitzungsalter und Rolle zentral", () => {
  beforeEach(() => {
    sitzung.wert = null;
  });

  it("istBueroSitzungAbgelaufen: Büro nach 12 h, Fahrer nie", () => {
    const jetzt = new Date();
    const knappDrunter = new Date(jetzt.getTime() - BUERO_SITZUNG_MAX_MS + 1000);
    expect(istBueroSitzungAbgelaufen("ADMIN", knappDrunter, jetzt)).toBe(false);
    expect(istBueroSitzungAbgelaufen("DISPONENT", VOR_13_STUNDEN, jetzt)).toBe(true);
    expect(istBueroSitzungAbgelaufen("FAHRER", VOR_13_STUNDEN, jetzt)).toBe(false);
  });

  it("M-02 (S3-018): 13 Stunden alte Büro-Sitzung wird am Export mit 401 abgelehnt", async () => {
    sitzung.wert = { tenantId: "t1", userId: "u1", role: "ADMIN", createdAt: VOR_13_STUNDEN };
    const antwort = await GET(new NextRequest("http://localhost:3000/api/export/abrechnung?von=2026-10-01&bis=2026-10-31"));
    expect(antwort.status).toBe(401);
  });

  it("M-02: requireBueroSession wirft bei abgelaufener Büro-Sitzung NichtAngemeldetError", async () => {
    sitzung.wert = { tenantId: "t1", userId: "u1", role: "DISPONENT", createdAt: VOR_13_STUNDEN };
    await expect(requireBueroSession()).rejects.toBeInstanceOf(NichtAngemeldetError);
  });

  it("M-02 (R3-6): requireFahrerSession lehnt Büro-Rollen ab, akzeptiert alte Fahrer-Sitzungen", async () => {
    sitzung.wert = { tenantId: "t1", userId: "u1", role: "ADMIN", createdAt: new Date() };
    await expect(requireFahrerSession()).rejects.toBeInstanceOf(KeineBerechtigungError);
    sitzung.wert = { tenantId: "t1", userId: "u2", role: "FAHRER", createdAt: VOR_13_STUNDEN };
    await expect(requireFahrerSession()).resolves.toMatchObject({ role: "FAHRER", userId: "u2" });
  });

  it("requireBueroSession lehnt FAHRER weiterhin mit KeineBerechtigungError ab (S1-001)", async () => {
    sitzung.wert = { tenantId: "t1", userId: "u1", role: "FAHRER", createdAt: new Date() };
    await expect(requireBueroSession()).rejects.toBeInstanceOf(KeineBerechtigungError);
  });
});
