-- CreateTable
CREATE TABLE "FaqReport" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "contact" TEXT,
    "adminResponse" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "respondedAt" TIMESTAMP(3),
    "respondedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaqReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FaqReport_createdAt_idx" ON "FaqReport"("createdAt");

-- CreateIndex
CREATE INDEX "FaqReport_status_idx" ON "FaqReport"("status");
