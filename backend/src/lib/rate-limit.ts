import type { NextFunction, Request, Response } from "express";
import { redis } from "./redis";

type LocalRateBucket = {
  count: number;
  expiresAt: number;
};

type RateLimitOptions = {
  prefix: string;
  limit: number;
  ttlSeconds: number;
  errorMessage?: string;
};

const localRateStore = new Map<string, LocalRateBucket>();

function normalizeIp(value: string) {
  const trimmed = String(value || "").trim();
  return trimmed.startsWith("::ffff:") ? trimmed.slice(7) : trimmed;
}

function getClientIp(req: Request) {
  const fromReqIp = normalizeIp(req.ip || "");
  if (fromReqIp) {
    return fromReqIp;
  }

  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return normalizeIp(forwarded.split(",")[0].trim());
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return normalizeIp(forwarded[0]);
  }

  return "unknown";
}

function incrementLocalRate(key: string, ttlSeconds: number) {
  const now = Date.now();
  const current = localRateStore.get(key);

  if (!current || current.expiresAt <= now) {
    localRateStore.set(key, {
      count: 1,
      expiresAt: now + ttlSeconds * 1000,
    });
    return 1;
  }

  current.count += 1;
  return current.count;
}

async function incrementWithExpiry(key: string, ttlSeconds: number) {
  try {
    if ((redis as any).isOpen) {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, ttlSeconds);
      }
      return count;
    }
  } catch (error) {
    console.error("Rate-limit Redis fallback:", error);
  }

  return incrementLocalRate(key, ttlSeconds);
}

export function createIpRateLimiter({
  prefix,
  limit,
  ttlSeconds,
  errorMessage = "Muitas tentativas. Tente mais tarde.",
}: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const key = `rl:${prefix}:ip:${ip}`;
    const count = await incrementWithExpiry(key, ttlSeconds);

    if (count > limit) {
      return res.status(429).json({ error: errorMessage });
    }

    return next();
  };
}

