import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth";
import { asyncHandler } from "../lib/async-handler";

const router = Router();

router.post("/visit", asyncHandler(async (_req: Request, res: Response) => {
  await prisma.siteAccess.create({ data: {} });
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
