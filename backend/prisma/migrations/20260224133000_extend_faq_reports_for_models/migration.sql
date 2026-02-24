-- AlterTable
ALTER TABLE "FaqReport"
ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'FAQ_PUBLIC',
ADD COLUMN "category" TEXT,
ADD COLUMN "modelId" TEXT;

-- CreateIndex
CREATE INDEX "FaqReport_modelId_idx" ON "FaqReport"("modelId");

-- CreateIndex
CREATE INDEX "FaqReport_origin_idx" ON "FaqReport"("origin");

-- AddForeignKey
ALTER TABLE "FaqReport"
ADD CONSTRAINT "FaqReport_modelId_fkey"
FOREIGN KEY ("modelId") REFERENCES "Model"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
