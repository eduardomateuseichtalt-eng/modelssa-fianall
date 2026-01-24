-- CreateTable
CREATE TABLE "CityStat" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "cityKey" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CityStat_modelId_idx" ON "CityStat"("modelId");

-- CreateIndex
CREATE INDEX "CityStat_cityKey_idx" ON "CityStat"("cityKey");

-- AddForeignKey
ALTER TABLE "CityStat" ADD CONSTRAINT "CityStat_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
