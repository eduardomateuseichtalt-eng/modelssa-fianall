import { Router, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth";
import { asyncHandler } from "../lib/async-handler";

const router = Router();

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
  const dayKey = now.toISOString().slice(0, 10);
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
  const dayStart = new Date(now);
  dayStart.setDate(now.getDate() - 1);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now);
  monthStart.setDate(now.getDate() - 30);

  const [day, week, month, total] = await Promise.all([
    prisma.siteAccess.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.siteAccess.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.siteAccess.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.siteAccess.count(),
  ]);

  return res.json({ day, week, month, total });
}));

export default router;
