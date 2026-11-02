-- Schichtplan (02.11.2026, Bauplan freigegeben): Besatzung einer Schicht (Fahrer + optionaler
-- Beifahrer + Scalamobil an Bord), Aushilfen und Scalamobil-Einweisung am Personal, Anzahl der
-- Scalamobile je Betrieb und Treppe an Orten. Regeln: docs/05-disposition.md, Code:
-- src/core/shifts/besatzung.ts und src/core/shifts/schichtplan.ts.
--
-- Bestandsdaten: Es wird nichts umgeschrieben. Alle neuen Spalten haben unschädliche Vorgaben
-- (kein Beifahrer, kein Scalamobil, keine Aushilfe, keine Einweisung, 0 Scalamobile, keine Treppe).
-- Hinweis für Betriebe mit Liegend-Fahrten: Ab jetzt braucht eine Liegend-Fahrt einen Beifahrer in
-- der Schicht. Bestehende Schichten haben keinen – sie müssen im Schichtplan ergänzt werden, sonst
-- werden Liegend-Fahrten nicht mehr zugewiesen (Bauprotokoll 2026-11-02, offene Frage).

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "istAushilfe" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scalamobilEinweisung" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "treppe" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "beifahrerId" TEXT,
ADD COLUMN     "scalamobil" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "scalamobilAnzahl" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Shift_tenantId_vehicleId_start_idx" ON "Shift"("tenantId", "vehicleId", "start");

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_beifahrerId_fkey" FOREIGN KEY ("beifahrerId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fahrer und Beifahrer sind nie dieselbe Person (zweite Linie hinter src/core/shifts/schichtplan.ts).
-- Prisma bildet CHECK-Regeln nicht im Schema ab; `prisma migrate diff` bleibt davon unberührt.
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_beifahrer_nicht_fahrer"
  CHECK ("beifahrerId" IS NULL OR "beifahrerId" <> "driverId");

-- Maßnahme M-11 fortgeschrieben: Auch der Beifahrer muss zum Mandanten der Schicht gehören.
-- Der Trigger aus 20261031130000_mandant_fremdschluessel prüfte nur driverId und vehicleId; er wird
-- mit derselben Prüffunktion (dispona_mandant_referenzen_pruefen) und zusätzlich beifahrerId neu
-- angelegt. Fehler wie bisher: SQLSTATE 23503, Text beginnt mit FREMDE_REFERENZ.
-- Achtung: `prisma db push` (Workaround aus CLAUDE.md) installiert Trigger und CHECK NICHT – danach
-- `prisma migrate resolve --applied` plus das SQL hier von Hand ausführen.
DROP TRIGGER IF EXISTS "Shift_mandant_referenzen" ON "Shift";
CREATE TRIGGER "Shift_mandant_referenzen"
  BEFORE INSERT OR UPDATE OF "tenantId", "driverId", "vehicleId", "beifahrerId"
  ON "Shift" FOR EACH ROW
  EXECUTE FUNCTION dispona_mandant_referenzen_pruefen('driverId', 'Driver', 'vehicleId', 'Vehicle', 'beifahrerId', 'Driver');
