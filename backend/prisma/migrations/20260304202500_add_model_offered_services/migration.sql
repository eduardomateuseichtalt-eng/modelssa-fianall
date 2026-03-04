-- Store selected services for model profile and public rendering.
ALTER TABLE "Model"
ADD COLUMN "offeredServices" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
