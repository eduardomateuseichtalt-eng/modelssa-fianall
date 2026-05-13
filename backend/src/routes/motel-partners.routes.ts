import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth";
import { asyncHandler } from "../lib/async-handler";
import { uploadToBunny } from "../lib/bunny";

const router = Router();

const MAX_NAME_LEN = 120;
const MAX_TEXT_LEN = 240;
const MAX_URL_LEN = 500;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/webp", "image/png"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

const sanitizeText = (value: unknown, maxLen: number) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, maxLen);
};

const sanitizeUrl = (value: unknown) => {
  const text = sanitizeText(value, MAX_URL_LEN);
  if (!text) return null;

  const normalized = /^https?:\/\//i.test(text) ? text : `https://${text}`;

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

router.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    const partners = await prisma.motelPartner.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      take: 30,
    });
    return res.json(partners);
  })
);

router.get(
  "/admin",
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const partners = await prisma.motelPartner.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      take: 300,
    });
    return res.json(partners);
  })
);

router.post(
  "/admin",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const name = String(req.body?.name || "").trim();
    if (!name || name.length < 2 || name.length > MAX_NAME_LEN) {
      return res.status(400).json({ error: "Informe o nome do motel parceiro." });
    }

    const displayOrderRaw = Number(req.body?.displayOrder);
    const displayOrder = Number.isFinite(displayOrderRaw)
      ? Math.max(0, Math.min(9999, Math.trunc(displayOrderRaw)))
      : 0;

    const created = await prisma.motelPartner.create({
      data: {
        id: randomUUID(),
        name: name.slice(0, MAX_NAME_LEN),
        address: sanitizeText(req.body?.address, MAX_TEXT_LEN),
        city: sanitizeText(req.body?.city, MAX_TEXT_LEN),
        photoUrl: sanitizeUrl(req.body?.photoUrl),
        mapUrl: sanitizeUrl(req.body?.mapUrl),
        displayOrder,
        active: req.body?.active !== false,
      },
    });

    return res.status(201).json(created);
  })
);

router.post(
  "/admin/upload-photo",
  requireAdmin,
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    if (!allowedImageTypes.has(file.mimetype)) {
      return res.status(400).json({ error: "Formato de imagem invalido." });
    }

    const uploaded = await uploadToBunny(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    return res.json({ url: uploaded.url });
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

    const nameRaw = String(req.body?.name || "").trim();
    let displayOrder: number | undefined = undefined;
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "displayOrder")) {
      const displayOrderRaw = Number(req.body?.displayOrder);
      if (!Number.isFinite(displayOrderRaw)) {
        return res.status(400).json({ error: "Ordem de exibicao invalida." });
      }
      displayOrder = Math.max(0, Math.min(9999, Math.trunc(displayOrderRaw)));
    }

    const updated = await prisma.motelPartner.update({
      where: { id },
      data: {
        name: nameRaw ? nameRaw.slice(0, MAX_NAME_LEN) : undefined,
        address:
          req.body && Object.prototype.hasOwnProperty.call(req.body, "address")
            ? sanitizeText(req.body?.address, MAX_TEXT_LEN)
            : undefined,
        city:
          req.body && Object.prototype.hasOwnProperty.call(req.body, "city")
            ? sanitizeText(req.body?.city, MAX_TEXT_LEN)
            : undefined,
        photoUrl:
          req.body && Object.prototype.hasOwnProperty.call(req.body, "photoUrl")
            ? sanitizeUrl(req.body?.photoUrl)
            : undefined,
        mapUrl:
          req.body && Object.prototype.hasOwnProperty.call(req.body, "mapUrl")
            ? sanitizeUrl(req.body?.mapUrl)
            : undefined,
        displayOrder,
        active:
          typeof req.body?.active === "boolean" ? req.body.active : undefined,
      },
    });

    return res.json(updated);
  })
);

export default router;
