import { Router, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth";
import { asyncHandler } from "../lib/async-handler";

const router = Router();
const METRICS_TIMEZONE = process.env.METRICS_TIMEZONE || "America/Sao_Paulo";

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

router.post("/visit", asyncHandler(async (req: Request, res: Response) => {
  const secret = getMetricsSecret();
  if (!secret) {
    return res.status(500).json({ error: "Metrics indisponivel no momento" });
  }

  const now = new Date();
  const dayKey = getDayKeyInTimeZone(now, METRICS_TIMEZONE);
  const fingerprint = getClientFingerprint(req);
  const fingerprintHash = crypto.createHmac("sha256", secret).update(fingerprint).digest("hex");

  const exists = await prisma.siteAccess.findFirst({
    where: { dayKey, fingerprintHash },
    select: { id: true },
  });

  if (exists) {
    return res.status(200).json({ status: "ok", deduped: true });
  }

  await prisma.siteAccess.create({
    data: { dayKey, fingerprintHash },
  });

  return res.status(201).json({ status: "ok" });
}));

router.get("/summary", requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const todayKey = getDayKeyInTimeZone(now, METRICS_TIMEZONE);

  const weekStartDate = new Date(now);
  weekStartDate.setDate(now.getDate() - 6);
  const weekStartKey = getDayKeyInTimeZone(weekStartDate, METRICS_TIMEZONE);

  const monthStartDate = new Date(now);
  monthStartDate.setDate(now.getDate() - 29);
  const monthStartKey = getDayKeyInTimeZone(monthStartDate, METRICS_TIMEZONE);

  const [day, week, month, total] = await Promise.all([
    prisma.siteAccess.count({ where: { dayKey: todayKey } }),
    prisma.siteAccess.count({
      where: {
        dayKey: {
          gte: weekStartKey,
          lte: todayKey,
        },
      },
    }),
    prisma.siteAccess.count({
      where: {
        dayKey: {
          gte: monthStartKey,
          lte: todayKey,
        },
      },
    }),
    prisma.siteAccess.count(),
  ]);

  return res.json({ day, week, month, total, dayKey: todayKey, timezone: METRICS_TIMEZONE });
}));

export default router;
