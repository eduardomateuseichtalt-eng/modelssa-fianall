import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { asyncHandler } from "../lib/async-handler";

const router = Router();

const allowedColors = new Set([
  "BLACK",
  "BROWN",
  "WHITE",
  "INDIGENOUS",
  "ASIAN",
  "OTHER",
]);

const toCityKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

router.post("/", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as { id: string; role: string };
  if (!user || user.role !== "MODEL") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  const { city, color, count, days } = req.body;

  if (!city || !color || !count || !days) {
    return res.status(400).json({ error: "Dados obrigatorios ausentes" });
  }

  const parsedCount = Number(count);
  const parsedDays = Number(days);

  if (!Number.isFinite(parsedCount) || parsedCount <= 0) {
    return res.status(400).json({ error: "Quantidade invalida" });
  }

  if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
    return res.status(400).json({ error: "Periodo invalido" });
  }

  const normalizedColor = String(color).toUpperCase();
  if (!allowedColors.has(normalizedColor)) {
    return res.status(400).json({ error: "Cor invalida" });
  }

  const created = await prisma.cityStat.create({
    data: {
      modelId: user.id,
      city: String(city).trim(),
      cityKey: toCityKey(String(city)),
      color: normalizedColor,
      count: parsedCount,
      days: parsedDays,
    },
  });

  return res.status(201).json(created);
}));

router.get("/", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as { id: string; role: string };
  if (!user || user.role !== "MODEL") {
    return res.status(403).json({ error: "Acesso restrito" });
  }
  const { city } = req.query;
  if (!city || typeof city !== "string") {
    return res.status(400).json({ error: "Cidade obrigatoria" });
  }

  const cityKey = toCityKey(city);
  const grouped = await prisma.cityStat.groupBy({
    by: ["color"],
    where: { cityKey },
    _sum: { count: true },
  });

  const total = grouped.reduce(
    (sum, item) => sum + (item._sum.count || 0),
    0
  );

  const breakdown = grouped.map((item) => {
    const count = item._sum.count || 0;
    const percentage = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
    return {
      color: item.color,
      count,
      percentage,
    };
  });

  return res.json({
    city: city.trim(),
    total,
    breakdown,
  });
}));

export default router;
