CREATE TABLE "ModelReview" (
  "id" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "comment" TEXT NOT NULL,
  "ratingLocal" INTEGER NOT NULL,
  "ratingService" INTEGER NOT NULL,
  "ratingBody" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelReview_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ModelReview"
ADD CONSTRAINT "ModelReview_modelId_fkey"
FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ModelReview_modelId_createdAt_idx"
ON "ModelReview"("modelId", "createdAt");

