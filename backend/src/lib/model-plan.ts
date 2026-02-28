import { PlanTier } from "@prisma/client";

export const PLAN_MEDIA_LIMITS: Record<PlanTier, { maxPhotos: number; maxVideos: number }> = {
  BASIC: { maxPhotos: 7, maxVideos: 3 },
  PRO: { maxPhotos: 15, maxVideos: 7 },
};

type ModelPlanSnapshot = {
  planTier?: PlanTier | null;
  planExpiresAt?: Date | string | null;
  trialEndsAt?: Date | string | null;
};

const toDate = (value?: Date | string | null) => {
  if (!value) {
    return null;
  }
  const dateValue = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dateValue.getTime())) {
    return null;
  }
  return dateValue;
};

export function getModelEffectivePlan(
  snapshot: ModelPlanSnapshot,
  now: Date = new Date()
): PlanTier {
  const trialEndsAt = toDate(snapshot.trialEndsAt);
  if (trialEndsAt && trialEndsAt.getTime() > now.getTime()) {
    return "PRO";
  }

  const planTier: PlanTier = snapshot.planTier || "BASIC";
  if (planTier !== "PRO") {
    return "BASIC";
  }

  const planExpiresAt = toDate(snapshot.planExpiresAt);
  if (!planExpiresAt) {
    return "PRO";
  }

  return planExpiresAt.getTime() > now.getTime() ? "PRO" : "BASIC";
}

export function getModelMediaLimits(snapshot: ModelPlanSnapshot, now: Date = new Date()) {
  const effectivePlan = getModelEffectivePlan(snapshot, now);
  const trialEndsAt = toDate(snapshot.trialEndsAt);
  const planExpiresAt = toDate(snapshot.planExpiresAt);
  const isTrialActive = Boolean(trialEndsAt && trialEndsAt.getTime() > now.getTime());

  return {
    planTier: snapshot.planTier || "BASIC",
    effectivePlan,
    trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
    planExpiresAt: planExpiresAt ? planExpiresAt.toISOString() : null,
    isTrialActive,
    maxPhotos: PLAN_MEDIA_LIMITS[effectivePlan].maxPhotos,
    maxVideos: PLAN_MEDIA_LIMITS[effectivePlan].maxVideos,
  };
}

export function getModelTrialEndDate(days = 30) {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 30;
  const now = new Date();
  return new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000);
}

