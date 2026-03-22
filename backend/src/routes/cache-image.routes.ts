import { Router, Request, Response } from "express";
import { redis } from "../lib/redis";
import { asyncHandler } from "../lib/async-handler";
import { createIpRateLimiter } from "../lib/rate-limit";

const router = Router();
const CACHE_IMAGE_TTL_SECONDS = 60 * 60 * 24;

const cacheWriteLimiter = createIpRateLimiter({
  prefix: "cache-image-write",
  limit: 120,
  ttlSeconds: 60 * 60,
  errorMessage: "Limite de cadastro de imagem excedido. Tente mais tarde.",
});

const cacheReadLimiter = createIpRateLimiter({
  prefix: "cache-image-read",
  limit: 1200,
  ttlSeconds: 60 * 60,
  errorMessage: "Limite de consulta de imagem excedido. Tente mais tarde.",
});

const isValidCacheImageId = (value: string) =>
  /^[a-zA-Z0-9:_-]{1,80}$/.test(value);

const isValidHttpUrl = (value: string) => {
  if (!value || value.length > 2048) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

router.post(
  "/cache-image",
  cacheWriteLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.body?.id || "").trim();
    const url = String(req.body?.url || "").trim();

    if (!id || !url) {
      return res.status(400).json({ error: "Id e URL sao obrigatorios" });
    }

    if (!isValidCacheImageId(id)) {
      return res.status(400).json({ error: "Id invalido" });
    }

    if (!isValidHttpUrl(url)) {
      return res.status(400).json({ error: "URL invalida" });
    }

    await redis.set(`image:${id}`, url, { EX: CACHE_IMAGE_TTL_SECONDS });
    return res.json({ status: "ok", id });
  })
);

router.get(
  "/get-image/:id",
  cacheReadLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params?.id || "").trim();
    if (!isValidCacheImageId(id)) {
      return res.status(400).json({ error: "Id invalido" });
    }
    const url = await redis.get(`image:${id}`);

    if (!url) {
      return res.status(404).json({ error: "Imagem nao encontrada" });
    }

    return res.json({ id, url });
  })
);

export default router;
