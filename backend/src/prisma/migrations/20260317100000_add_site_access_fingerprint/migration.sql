-- AlterTable
ALTER TABLE "SiteAccess" ADD COLUMN "dayKey" TEXT;
ALTER TABLE "SiteAccess" ADD COLUMN "fingerprintHash" TEXT;

-- CreateIndex
CREATE INDEX "SiteAccess_dayKey_idx" ON "SiteAccess"("dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "SiteAccess_dayKey_fingerprintHash_key" ON "SiteAccess"("dayKey", "fingerprintHash");

UPDATE "SiteAccess"
SET "dayKey" = TO_CHAR("createdAt", 'YYYY-MM-DD'),
    "fingerprintHash" = md5("id");

ALTER TABLE "SiteAccess" ALTER COLUMN "dayKey" SET NOT NULL;
ALTER TABLE "SiteAccess" ALTER COLUMN "fingerprintHash" SET NOT NULL;
