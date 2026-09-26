-- Add indexes used by public media and shot listings.
CREATE INDEX "Shot_isActive_createdAt_idx"
ON "Shot"("isActive", "createdAt");

CREATE INDEX "Shot_modelId_isActive_createdAt_idx"
ON "Shot"("modelId", "isActive", "createdAt");

CREATE INDEX "Media_modelId_status_purpose_createdAt_idx"
ON "Media"("modelId", "status", "purpose", "createdAt");
