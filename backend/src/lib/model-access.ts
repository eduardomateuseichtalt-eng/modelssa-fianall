import { PlanTier } from "@prisma/client";

export type ModelPaidAccessSnapshot = {
  id: string;
  planTier?: PlanTier | null;
  trialEndsAt?: Date | string | null;
  planExpiresAt?: Date | string | null;
};

type PaymentPlanPricing = { label: string; priceCents: number; priceText: string };

const MODEL_PLAN_PRICING: Record<PlanTier, PaymentPlanPricing> = {
  BASIC: {
    label: "BASICO",
    priceCents: 4990,
    priceText: "R$ 49,90/mes",
  },
  PRO: {
    label: "PRO",
    priceCents: 6990,
    priceText: "R$ 69,90/mes",
  },
};

function normalizePixKey(rawValue?: string | null) {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return "";
  }

  const parts = raw
    .split(/[\s,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (parts.length > 0) {
    return parts[0];
  }

  if (raw.length % 2 === 0) {
    const half = raw.length / 2;
    const firstHalf = raw.slice(0, half);
    const secondHalf = raw.slice(half);
    if (firstHalf === secondHalf) {
      return firstHalf;
    }
  }

  return raw;
}

const MODEL_PAYMENT_PIX_KEY = normalizePixKey(
  process.env.MODEL_PAYMENT_PIX_KEY ||
    process.env.MODEL_REGISTER_PIX_KEY ||
    "faa9aca1-3e24-4437-abcb-ae58ae550979"
);

const MODEL_PAYMENT_PIX_KEY_BASIC = normalizePixKey(
  process.env.MODEL_PAYMENT_PIX_KEY_BASIC || MODEL_PAYMENT_PIX_KEY
);

const MODEL_PAYMENT_PIX_KEY_PRO = normalizePixKey(
  process.env.MODEL_PAYMENT_PIX_KEY_PRO || MODEL_PAYMENT_PIX_KEY
);

const toDate = (value?: Date | string | null) => {
  if (!value) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function getNormalizedPlanTier(planTier?: PlanTier | null): PlanTier {
  return planTier === "PRO" ? "PRO" : "BASIC";
}

export function modelHasPaidAreaAccess(snapshot: {
  trialEndsAt?: Date | string | null;
  planExpiresAt?: Date | string | null;
}) {
  const now = Date.now();
  const trialEndsAt = toDate(snapshot.trialEndsAt);
  const planExpiresAt = toDate(snapshot.planExpiresAt);

  if (trialEndsAt && trialEndsAt.getTime() > now) {
    return true;
  }

  if (planExpiresAt && planExpiresAt.getTime() > now) {
    return true;
  }

  return false;
}

export function buildModelTrialExpiredResponse(snapshot: ModelPaidAccessSnapshot) {
  const normalizedTier = getNormalizedPlanTier(snapshot.planTier);
  const pricing = MODEL_PLAN_PRICING[normalizedTier];
  const pixKeyForPlan =
    normalizedTier === "PRO" ? MODEL_PAYMENT_PIX_KEY_PRO : MODEL_PAYMENT_PIX_KEY_BASIC;
  const trialEndsAt = toDate(snapshot.trialEndsAt);
  const planExpiresAt = toDate(snapshot.planExpiresAt);

  return {
    error:
      "Sua gratuidade venceu. Para acessar a area da acompanhante, realize o pagamento do plano escolhido.",
    code: "MODEL_TRIAL_EXPIRED",
    paymentRequired: true,
    payment: {
      modelId: snapshot.id,
      planTier: normalizedTier,
      planLabel: pricing.label,
      priceCents: pricing.priceCents,
      priceText: pricing.priceText,
      pixKey: pixKeyForPlan,
      trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
      planExpiresAt: planExpiresAt ? planExpiresAt.toISOString() : null,
    },
  };
}
