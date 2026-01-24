-- CreateTable
CREATE TABLE "SiteAccess" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteAccess_createdAt_idx" ON "SiteAccess"("createdAt");
