DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlanTier') THEN
    CREATE TYPE "PlanTier" AS ENUM ('BASIC', 'PRO');
  END IF;
END
$$;

ALTER TABLE "Model"
ADD COLUMN IF NOT EXISTS "planTier" "PlanTier" NOT NULL DEFAULT 'BASIC',
ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);

UPDATE "Model"
SET "trialEndsAt" = COALESCE("trialEndsAt", "createdAt" + INTERVAL '30 day');

CREATE INDEX IF NOT EXISTS "Model_planTier_idx" ON "Model" ("planTier");
CREATE INDEX IF NOT EXISTS "Model_trialEndsAt_idx" ON "Model" ("trialEndsAt");
CREATE INDEX IF NOT EXISTS "Model_planExpiresAt_idx" ON "Model" ("planExpiresAt");

