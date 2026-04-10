import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth";
import { asyncHandler } from "../lib/async-handler";

const router = Router();
const MAX_TITLE_LEN = 120;
const MAX_CITY_LEN = 80;
const MAX_TEXT_LEN = 240;
const MAX_NOTES_LEN = 600;

const sanitizeText = (value: unknown, maxLen: number) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, maxLen);
};

router.get("/", async (req: Request, res: Response) => {
  try {
    const city =
      typeof req.query.city === "string" ? req.query.city.trim() : "";

    const where: Prisma.RoomListingWhereInput = {};
    if (city) {
      where.city = {
        equals: city,
        mode: Prisma.QueryMode.insensitive,
      };
    }
    where.active = true;

    const rooms = await prisma.roomListing.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return res.json(rooms);
  } catch (error) {
    console.error("Erro ao buscar quartos:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

router.get(
  "/admin",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const cityRaw = String(req.query.city || "").trim();
    const city = cityRaw ? cityRaw.trim() : "";
    const where = city
      ? { city: { equals: city, mode: "insensitive" } }
      : undefined;
    const rooms = await prisma.roomListing.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    });
    return res.json(rooms);
  })
);

router.post(
  "/admin",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const cityRaw = String(req.body?.city || "").trim();
    const title = String(req.body?.title || "").trim();

    if (!cityRaw || cityRaw.length < 2 || cityRaw.length > MAX_CITY_LEN) {
      return res.status(400).json({ error: "Informe a cidade do quarto." });
    }
    if (!title || title.length < 2 || title.length > MAX_TITLE_LEN) {
      return res.status(400).json({ error: "Informe o titulo do quarto." });
    }

    const city = cityRaw.trim();
    const created = await prisma.roomListing.create({
      data: {
        id: randomUUID(),
        city,
        title,
        address: sanitizeText(req.body?.address, MAX_TEXT_LEN),
        priceText: sanitizeText(req.body?.priceText, MAX_TEXT_LEN),
        contact: sanitizeText(req.body?.contact, MAX_TEXT_LEN),
        link: sanitizeText(req.body?.link, MAX_TEXT_LEN),
        notes: sanitizeText(req.body?.notes, MAX_NOTES_LEN),
        active: req.body?.active !== false,
      },
    });

    return res.status(201).json(created);
  })
);

router.patch(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params?.id || "").trim();
    if (!id) {
      return res.status(400).json({ error: "Id invalido." });
    }

    const cityRaw = String(req.body?.city || "").trim();
    const title = String(req.body?.title || "").trim();
    const city = cityRaw ? cityRaw.trim() : null;

    const updated = await prisma.roomListing.update({
      where: { id },
      data: {
        city: city ?? undefined,
        title: title ? title.slice(0, MAX_TITLE_LEN) : undefined,
        address: sanitizeText(req.body?.address, MAX_TEXT_LEN) ?? undefined,
        priceText: sanitizeText(req.body?.priceText, MAX_TEXT_LEN) ?? undefined,
        contact: sanitizeText(req.body?.contact, MAX_TEXT_LEN) ?? undefined,
        link: sanitizeText(req.body?.link, MAX_TEXT_LEN) ?? undefined,
        notes: sanitizeText(req.body?.notes, MAX_NOTES_LEN) ?? undefined,
        active:
          typeof req.body?.active === "boolean" ? req.body.active : undefined,
      },
    });

    return res.json(updated);
  })
);

export default router;
