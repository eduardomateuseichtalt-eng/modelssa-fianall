-- Add purpose classification to media so comparison videos can be exposed separately.
CREATE TYPE "MediaPurpose" AS ENUM ('GALLERY', 'COMPARISON');

ALTER TABLE "Media"
ADD COLUMN "purpose" "MediaPurpose" NOT NULL DEFAULT 'GALLERY';

CREATE INDEX "Media_purpose_idx" ON "Media"("purpose");
