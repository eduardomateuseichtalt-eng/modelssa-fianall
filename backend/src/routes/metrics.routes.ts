import { Router, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth";
import { asyncHandler } from "../lib/async-handler";
import { createIpRateLimiter } from "../lib/rate-limit";

const router = Router();
const METRICS_TIMEZONE = process.env.METRICS_TIMEZONE || "America/Sao_Paulo";
const metricsVisitLimiter = createIpRateLimiter({
  prefix: "metrics-visit",
  limit: 120,
  ttlSeconds: 60 * 60,
  errorMessage: "Limite de metricas atingido.",
});

function getDayKeyInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";

  return `${year}-${month}-${day}`;
}

function getTrailingDayKeys(days: number, timeZone: string, fromDate = new Date()) {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 1;
  const keys: string[] = [];

  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(fromDate);
    date.setDate(fromDate.getDate() - offset);
    keys.push(getDayKeyInTimeZone(date, timeZone));
  }

  return keys;
}

const getMetricsSecret = () => {
  const secret = process.env.OTP_HASH_SECRET || "";
  if (!secret && process.env.NODE_ENV === "production") {
    return "";
  }
  return secret || "metrics_hash_dev";
};

const getClientFingerprint = (req: Request) => {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.ip || "";
  const userAgent = String(req.headers["user-agent"] || "");
  return `${ip}|${userAgent}`;
};

const getHeaderValue = (req: Request, headerName: string) => {
  const value = req.headers[headerName];
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return String(value || "");
};

const cleanMetricValue = (value: unknown, maxLength: number) =>
  String(value || "").trim().slice(0, maxLength);

const getFirstHeaderValue = (req: Request, headerNames: string[]) => {
  for (const headerName of headerNames) {
    const value = getHeaderValue(req, headerName);
    if (value) {
      try {
        return decodeURIComponent(value.replace(/\+/g, " "));
      } catch {
        return value;
      }
    }
  }
  return "";
};

const getApproximateLocation = (req: Request, payload: Record<string, unknown>) => {
  const countryCode = cleanMetricValue(
    payload.countryCode ||
      getFirstHeaderValue(req, [
        "x-vercel-ip-country",
        "cf-ipcountry",
        "cloudfront-viewer-country",
        "x-country-code",
      ]),
    2
  ).toUpperCase();
  const region = cleanMetricValue(
    payload.region ||
      getFirstHeaderValue(req, [
        "x-vercel-ip-country-region",
        "cf-region",
        "cloudfront-viewer-country-region-name",
        "x-region",
      ]),
    120
  );
  const city = cleanMetricValue(
    payload.city ||
      getFirstHeaderValue(req, [
        "x-vercel-ip-city",
        "cf-ipcity",
        "cloudfront-viewer-city",
        "x-city",
      ]),
    120
  );

  return {
    countryCode: /^[A-Z]{2}$/.test(countryCode) && countryCode !== "XX" ? countryCode : "",
    region,
    city,
  };
};

const parseDeviceInfo = (userAgent: string) => {
  const normalized = userAgent.toLowerCase();
  let deviceType = "desktop";
  if (/ipad|tablet|playbook/.test(normalized)) {
    deviceType = "tablet";
  } else if (/iphone|ipod|android.*mobile|mobile|iphone/.test(normalized)) {
    deviceType = "mobile";
  }

  let browser = "unknown";
  if (/edg\//.test(normalized)) browser = "Edge";
  else if (/chrome\//.test(normalized)) browser = "Chrome";
  else if (/firefox\//.test(normalized)) browser = "Firefox";
  else if (/safari\//.test(normalized) && !/chrome\//.test(normalized)) browser = "Safari";
  else if (/opr\//.test(normalized)) browser = "Opera";

  let os = "unknown";
  if (/windows/.test(normalized)) os = "Windows";
  else if (/mac os x/.test(normalized)) os = "macOS";
  else if (/android/.test(normalized)) os = "Android";
  else if (/iphone|ipad|ipod/.test(normalized)) os = "iOS";
  else if (/linux/.test(normalized)) os = "Linux";

  return { browser, os, deviceType };
};

const getTrafficSource = (referrer: string) => {
  const value = String(referrer || "").trim().toLowerCase();
  if (!value) {
    return "direct";
  }
  if (value.includes("google") || value.includes("bing") || value.includes("yahoo")) {
    return "search";
  }
  if (value.includes("instagram") || value.includes("facebook") || value.includes("tiktok") || value.includes("whatsapp") || value.includes("telegram")) {
    return "social";
  }
  if (value.includes("localhost") || value.includes("127.0.0.1") || value.includes("models")) {
    return "internal";
  }
  return "referral";
};

router.post("/visit", metricsVisitLimiter, asyncHandler(async (req: Request, res: Response) => {
  const secret = getMetricsSecret();
  if (!secret) {
    return res.status(500).json({ error: "Metrics indisponivel no momento" });
  }

  const now = new Date();
  const dayKey = getDayKeyInTimeZone(now, METRICS_TIMEZONE);
  const fingerprint = getClientFingerprint(req);
  const fingerprintHash = crypto.createHmac("sha256", secret).update(fingerprint).digest("hex");
  const userAgent = String(req.headers["user-agent"] || "");
  const payload =
    req.body && typeof req.body === "object"
      ? (req.body as Record<string, unknown>)
      : {};
  const referrer = cleanMetricValue(
    payload.referrer || getHeaderValue(req, "referer"),
    500
  );
  const path = cleanMetricValue(payload.path, 300);
  const { countryCode, region, city } = getApproximateLocation(req, payload);
  const language = cleanMetricValue(payload.language, 40);
  const screenResolution = cleanMetricValue(payload.screenResolution, 40);
  const { browser, os, deviceType } = parseDeviceInfo(userAgent);
  const source = getTrafficSource(referrer);

  const exists = await prisma.siteAccess.findFirst({
    where: { dayKey, fingerprintHash },
    select: { id: true },
  });

  if (exists) {
    if (countryCode || region || city) {
      await prisma.siteAccess.update({
        where: { id: exists.id },
        data: {
          ...(countryCode ? { countryCode } : {}),
          ...(region ? { region } : {}),
          ...(city ? { city } : {}),
        },
      });
    }
    return res.status(200).json({ status: "ok", deduped: true });
  }

  await prisma.siteAccess.create({
    data: {
      dayKey,
      fingerprintHash,
      countryCode: countryCode || null,
      region: region || null,
      city: city || null,
      userAgent: userAgent || null,
      browser,
      os,
      deviceType,
      language: language || null,
      referrer: referrer || null,
      path: path || null,
      source,
      screenResolution: screenResolution || null,
    },
  });

  return res.status(201).json({ status: "ok" });
}));

router.get("/accesses", requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const rows = await prisma.siteAccess.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      countryCode: true,
      region: true,
      city: true,
      userAgent: true,
      browser: true,
      os: true,
      deviceType: true,
      language: true,
      referrer: true,
      path: true,
      source: true,
      screenResolution: true,
      dayKey: true,
    },
  });

  return res.json(rows);
}));

router.get("/summary", requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const monthKeys = getTrailingDayKeys(30, METRICS_TIMEZONE, now);
  const weekKeys = monthKeys.slice(-7);
  const todayKey = monthKeys[monthKeys.length - 1];

  const [rows, total] = await Promise.all([
    prisma.siteAccess.groupBy({
      by: ["dayKey"],
      where: { dayKey: { in: monthKeys } },
      _count: { _all: true },
    }),
    prisma.siteAccess.count(),
  ]);

  const countByDayKey = new Map<string, number>();
  rows.forEach((row) => {
    countByDayKey.set(row.dayKey, row._count._all || 0);
  });

  const day = countByDayKey.get(todayKey) || 0;
  const week = weekKeys.reduce((sum, key) => sum + (countByDayKey.get(key) || 0), 0);
  const month = monthKeys.reduce((sum, key) => sum + (countByDayKey.get(key) || 0), 0);

  return res.json({ day, week, month, total, dayKey: todayKey, timezone: METRICS_TIMEZONE });
}));

export default router;
