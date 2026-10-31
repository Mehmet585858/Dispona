-- Maßnahme M-13 (Prüfbericht S2-002, docs/13 R2-11): Im Anruf bestätigte Fahrgäste.
-- Bestandsanrufe erhalten eine leere Liste (abgeschlossene Gespräche brauchen keine Bindung mehr).
ALTER TABLE "Call" ADD COLUMN "identifiedPassengerIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
