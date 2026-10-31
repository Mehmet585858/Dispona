-- Maßnahme M-22 (Prüfbericht S2-005, docs/13 R2-10): Serien pausieren. Bestandsserien: keine Pause.
ALTER TABLE "RideSeries" ADD COLUMN "pausedFrom" TIMESTAMP(3);
ALTER TABLE "RideSeries" ADD COLUMN "pausedUntil" TIMESTAMP(3);
