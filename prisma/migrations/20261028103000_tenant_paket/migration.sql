-- CreateEnum
CREATE TYPE "TenantPaket" AS ENUM ('LITE', 'PRO');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "paket" "TenantPaket" NOT NULL DEFAULT 'PRO';
