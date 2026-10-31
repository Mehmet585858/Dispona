-- Maßnahme M-16 (Prüfbericht S2-010, S3-011, docs/13 R2-3): Laufprotokoll und Laufsperre der Crons.
-- Neue Tabelle, Bestandsdaten unberührt.
CREATE TABLE "CronLauf" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cron" TEXT NOT NULL,
    "laeuftSeit" TIMESTAMP(3),
    "letzterStart" TIMESTAMP(3),
    "letzterErfolg" TIMESTAMP(3),
    "letzterFehler" TEXT,
    "letzterFehlerAm" TIMESTAMP(3),
    "alarmGesendetAm" TIMESTAMP(3),

    CONSTRAINT "CronLauf_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CronLauf_tenantId_cron_key" ON "CronLauf"("tenantId", "cron");
CREATE INDEX "CronLauf_tenantId_idx" ON "CronLauf"("tenantId");
