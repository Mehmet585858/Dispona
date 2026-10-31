-- Maßnahme M-23 (Prüfbericht S2-011): Ratenbegrenzung der Registrierung. Neue Tabelle, kein Bestand.
CREATE TABLE "Registrierungsversuch" (
    "id" TEXT NOT NULL,
    "schluessel" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registrierungsversuch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Registrierungsversuch_schluessel_at_idx" ON "Registrierungsversuch"("schluessel", "at");
