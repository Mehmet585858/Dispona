/**
 * Gemeinsame Sitzungsquelle für Tests, die `@/lib/auth` mocken.
 *
 * vitest läuft mit `isolate: false` (vitest.config.ts): alle Testdateien teilen sich einen
 * Modul-Cache. `src/lib/session.ts` wird deshalb nur einmal geladen und bleibt an den
 * `@/lib/auth`-Mock der ERSTEN Testdatei gebunden. Hatte jede Datei ihren eigenen
 * Sitzungsspeicher, las die Prüfung je nach Reihenfolge den Speicher einer fremden Datei
 * (rote Tests nur in manchen Läufen). Mit einem einzigen, gemeinsam genutzten Speicher ist
 * die Reihenfolge egal.
 *
 * Nutzung:
 *   vi.mock("@/lib/auth", async () => (await import("../hilfen/sitzungsMock")).authMock);
 *   import { testSitzung } from "../hilfen/sitzungsMock";
 *   testSitzung.wert = { tenantId, userId, role: "FAHRER" };
 */
export type TestSitzung = {
  tenantId: string;
  userId: string;
  role: string;
  /** Beginn der Sitzung; ohne Angabe „gerade eben“. */
  createdAt?: Date;
};

export const testSitzung: { wert: TestSitzung | null } = { wert: null };

export const authMock = {
  auth: {
    api: {
      getSession: async () =>
        testSitzung.wert
          ? {
              user: {
                id: testSitzung.wert.userId,
                tenantId: testSitzung.wert.tenantId,
                role: testSitzung.wert.role,
                name: "PRUEF Test",
                email: "pruef@test.invalid",
              },
              session: { createdAt: testSitzung.wert.createdAt ?? new Date() },
            }
          : null,
    },
  },
};
