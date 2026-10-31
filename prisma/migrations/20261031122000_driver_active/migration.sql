-- Maßnahme M-12: Fahrer deaktivieren (Offboarding). Bestandsdaten: alle vorhandenen Fahrer bleiben aktiv.
ALTER TABLE "Driver" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Driver" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
