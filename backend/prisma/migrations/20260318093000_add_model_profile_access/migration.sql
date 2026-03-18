CREATE TABLE "ModelProfileAccess" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelProfileAccess_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModelProfileAccess_modelId_idx" ON "ModelProfileAccess"("modelId");
CREATE INDEX "ModelProfileAccess_createdAt_idx" ON "ModelProfileAccess"("createdAt");
CREATE INDEX "ModelProfileAccess_dayKey_idx" ON "ModelProfileAccess"("dayKey");

CREATE UNIQUE INDEX "ModelProfileAccess_dayKey_modelId_fingerprintHash_key"
ON "ModelProfileAccess"("dayKey", "modelId", "fingerprintHash");

ALTER TABLE "ModelProfileAccess"
ADD CONSTRAINT "ModelProfileAccess_modelId_fkey"
FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;
