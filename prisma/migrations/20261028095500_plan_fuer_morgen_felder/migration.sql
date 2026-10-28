-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "planFuerMorgenLauf" TIMESTAMP(3),
ADD COLUMN     "planFuerMorgenZeit" TEXT NOT NULL DEFAULT '18:00';
