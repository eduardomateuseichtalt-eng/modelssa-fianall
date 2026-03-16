-- CreateTable
CREATE TABLE "AgeVerificationSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgeVerificationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgeVerificationSession_tokenHash_key" ON "AgeVerificationSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AgeVerificationSession_expiresAt_idx" ON "AgeVerificationSession"("expiresAt");

-- AlterTable
ALTER TABLE "Media" ADD COLUMN "isExplicit" BOOLEAN NOT NULL DEFAULT false;
