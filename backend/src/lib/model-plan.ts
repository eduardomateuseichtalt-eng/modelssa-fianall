import { PlanTier } from "@prisma/client";

export const PLAN_MEDIA_LIMITS: Record<PlanTier, { maxPhotos: number | null; maxVideos: number }> = {
  BASIC: { maxPhotos: 7, maxVideos: 3 },
  PRO: { maxPhotos: null, maxVideos: 12 },
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
  const planTier: PlanTier = snapshot.planTier || "BASIC";
  if (planTier !== "PRO") {
    return "BASIC";
  }

  const trialEndsAt = toDate(snapshot.trialEndsAt);
  if (trialEndsAt && trialEndsAt.getTime() > now.getTime()) {
    return "PRO";
  }

  const planExpiresAt = toDate(snapshot.planExpiresAt);
  if (planExpiresAt) {
    return planExpiresAt.getTime() > now.getTime() ? "PRO" : "BASIC";
  }

  // Se houve periodo de trial e nao existe plano pago vigente, volta para BASIC.
  if (trialEndsAt) {
    return "BASIC";
  }

  // Compatibilidade com registros antigos de PRO sem vencimento.
  return "PRO";
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
