CREATE TABLE "MotelPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "photoUrl" TEXT,
    "mapUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MotelPartner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MotelPartner_active_idx" ON "MotelPartner"("active");
CREATE INDEX "MotelPartner_displayOrder_idx" ON "MotelPartner"("displayOrder");
CREATE INDEX "MotelPartner_createdAt_idx" ON "MotelPartner"("createdAt");
