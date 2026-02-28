import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { asyncHandler } from "../lib/async-handler";

const router = Router();
const REVIEW_TEXT_MAX_LENGTH = 280;
const REVIEW_TEXT_MIN_LENGTH = 8;
const REVIEW_POST_LIMIT_PER_IP_PER_MODEL = 5;
const REVIEW_POST_LIMIT_WINDOW_SECONDS = 24 * 60 * 60;

let reviewTableReady = false;

type ReviewRow = {
  id: string;
  modelId: string;
  comment: string;
  ratingLocal: number;
  ratingService: number;
  ratingBody: number;
  createdAt: Date;
};

function getClientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }
  return req.ip || "unknown";
}

function normalizeComment(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRating(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const normalized = Math.trunc(parsed);
  if (normalized < 0 || normalized > 5) {
    return null;
  }
  return normalized;
}

async function incrementWithExpiry(key: string, ttlSeconds: number) {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }
  return count;
}

async function ensureReviewTable() {
  if (reviewTableReady) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ModelReview" (
      "id" TEXT PRIMARY KEY,
      "modelId" TEXT NOT NULL REFERENCES "Model"("id") ON DELETE CASCADE,
      "comment" TEXT NOT NULL,
      "ratingLocal" INTEGER NOT NULL,
      "ratingService" INTEGER NOT NULL,
      "ratingBody" INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ModelReview_ratingLocal_chk" CHECK ("ratingLocal" >= 0 AND "ratingLocal" <= 5),
      CONSTRAINT "ModelReview_ratingService_chk" CHECK ("ratingService" >= 0 AND "ratingService" <= 5),
      CONSTRAINT "ModelReview_ratingBody_chk" CHECK ("ratingBody" >= 0 AND "ratingBody" <= 5)
    );
  `);

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ModelReview_modelId_createdAt_idx" ON "ModelReview" ("modelId", "createdAt" DESC);`
  );

  reviewTableReady = true;
}

router.get("/:modelId", asyncHandler(async (req: Request, res: Response) => {
  const modelId = String(req.params.modelId || "").trim();
  if (!modelId) {
    return res.status(400).json({ error: "ModelId obrigatorio." });
  }

  await ensureReviewTable();

  const rows = await prisma.$queryRawUnsafe<ReviewRow[]>(
    `
      SELECT
        "id",
        "modelId",
        "comment",
        "ratingLocal",
        "ratingService",
        "ratingBody",
        "createdAt"
      FROM "ModelReview"
      WHERE "modelId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 50
    `,
    modelId
  );

  return res.json(rows);
}));

router.post("/:modelId", asyncHandler(async (req: Request, res: Response) => {
  const modelId = String(req.params.modelId || "").trim();
  if (!modelId) {
    return res.status(400).json({ error: "ModelId obrigatorio." });
  }

  const comment = normalizeComment(req.body?.comment);
  const ratingLocal = parseRating(req.body?.ratingLocal);
  const ratingService = parseRating(req.body?.ratingService);
  const ratingBody = parseRating(req.body?.ratingBody);

  if (comment.length < REVIEW_TEXT_MIN_LENGTH) {
    return res.status(400).json({ error: "Relato muito curto." });
  }
  if (comment.length > REVIEW_TEXT_MAX_LENGTH) {
    return res.status(400).json({ error: "Relato muito longo." });
  }
  if (ratingLocal === null || ratingService === null || ratingBody === null) {
    return res.status(400).json({ error: "As notas devem estar entre 0 e 5." });
  }

  const model = await prisma.model.findFirst({
    where: { id: modelId, isVerified: true },
    select: { id: true },
  });
  if (!model) {
    return res.status(404).json({ error: "Modelo nao encontrada." });
  }

  try {
    const ip = getClientIp(req);
    const rateKey = `model-review:post:${modelId}:${ip}`;
    const postCount = await incrementWithExpiry(rateKey, REVIEW_POST_LIMIT_WINDOW_SECONDS);
    if (postCount > REVIEW_POST_LIMIT_PER_IP_PER_MODEL) {
      return res.status(429).json({ error: "Limite de avaliacoes excedido para hoje." });
    }
  } catch (error) {
    console.error("Model review rate-limit error:", error);
  }

  await ensureReviewTable();

  const created = await prisma.$queryRawUnsafe<ReviewRow[]>(
    `
      INSERT INTO "ModelReview" (
        "id",
        "modelId",
        "comment",
        "ratingLocal",
        "ratingService",
        "ratingBody"
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        "id",
        "modelId",
        "comment",
        "ratingLocal",
        "ratingService",
        "ratingBody",
        "createdAt"
    `,
    randomUUID(),
    modelId,
    comment,
    ratingLocal,
    ratingService,
    ratingBody
  );

  return res.status(201).json(created[0]);
}));

export default router;
