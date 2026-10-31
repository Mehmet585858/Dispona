-- Maßnahme M-07: Rückfahrt mit offener Uhrzeit. Bestandsdaten: alle vorhandenen Fahrten haben eine
-- feste Zeit, deshalb Standard false ohne weitere Umschreibung.
ALTER TABLE "Ride" ADD COLUMN "returnTimeOpen" BOOLEAN NOT NULL DEFAULT false;
