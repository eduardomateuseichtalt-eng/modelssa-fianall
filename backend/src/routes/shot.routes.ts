import { Router, Request, Response } from "express";
import multer from "multer";
import { createHash } from "crypto";
import { prisma } from "../lib/prisma";
import { getUserFromRequest, requireAuth, requireModel } from "../lib/auth";
import { deleteFromBunny, deleteThumbnailFromBunny } from "../lib/bunny";
import { asyncHandler } from "../lib/async-handler";
import { redis } from "../lib/redis";
import { buildModelTrialExpiredResponse, modelHasPaidAreaAccess } from "../lib/model-access";
import {
  getProgressiveUploadFiles,
  getProgressiveUploadThumbnails,
  uploadProgressiveFile,
} from "../lib/progressive-upload";
import { createAuthenticatedRateLimiter, createIpRateLimiter } from "../lib/rate-limit";
import {
  createSecureMemoryStorage,
  getUploadedFileError,
  THUMBNAIL_MAX_BYTES,
} from "../lib/secure-upload";

const router = Router();

const shotTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

const shotUpload = multer({
  storage: createSecureMemoryStorage({ maxTotalBytes: 60 * 1024 * 1024 }),
  limits: { files: 4, fields: 20 },
  fileFilter: (_req, file, callback) => {
    const allowed = file.fieldname === "thumbnails"
      ? file.mimetype === "image/webp"
      : shotTypes.has(file.mimetype);
    if (!allowed) {
      callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
      return;
    }
    callback(null, true);
  },
});

const progressiveShotUpload = shotUpload.fields([
  { name: "files", maxCount: 2 },
  { name: "thumbnails", maxCount: 2 },
]);
const shotUploadLimiter = createIpRateLimiter({
  prefix: "shot-upload",
  limit: 30,
  ttlSeconds: 60 * 60,
});
const shotAccountUploadLimiter = createAuthenticatedRateLimiter({
  prefix: "shot-upload",
  limit: 30,
  ttlSeconds: 60 * 60,
});
const guestLikeLimiter = createIpRateLimiter({
  prefix: "shot-guest-like",
  limit: 100,
  ttlSeconds: 60 * 60,
  errorMessage: "Limite de curtidas atingido. Tente novamente mais tarde.",
});

const SHOT_TTL_HOURS = 24;
const NEARBY_CITY_RADIUS_KM_DEFAULT = 50;
const NEARBY_CITY_RADIUS_KM_MAX = 200;
const CITY_COORD_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CityCoord = { lat: number; lon: number; expiresAt: number };
const cityCoordCache = new Map<string, CityCoord>();

const respondModelTrialExpired = (
  res: Response,
  model: {
    id: string;
    planTier?: "BASIC" | "PRO" | null;
    trialEndsAt?: Date | string | null;
    planExpiresAt?: Date | string | null;
  }
) => res.status(402).json(buildModelTrialExpiredResponse(model));

function normalizeCityName(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(
  origin: { lat: number; lon: number },
  target: { lat: number; lon: number }
) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(target.lat - origin.lat);
  const deltaLon = toRadians(target.lon - origin.lon);
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(target.lat);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

async function geocodeCity(city: string) {
  const normalized = normalizeCityName(city);
  if (!normalized) {
    return null;
  }

  const cached = cityCoordCache.get(normalized);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return { lat: cached.lat, lon: cached.lon };
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", `${city}, Brasil`);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "br");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "models-club/1.0 (admin@models-club.com)",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json().catch(() => [])) as Array<{
      lat?: string;
      lon?: string;
    }>;

    const first = data[0];
    const lat = Number(first?.lat);
    const lon = Number(first?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    cityCoordCache.set(normalized, {
      lat,
      lon,
      expiresAt: now + CITY_COORD_CACHE_TTL_MS,
    });

    return { lat, lon };
  } catch {
    return null;
  }
}

async function purgeExpiredShots() {
  const cutoff = new Date(Date.now() - SHOT_TTL_HOURS * 60 * 60 * 1000);
  const expired = await prisma.shot.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true, videoUrl: true, imageUrl: true, posterUrl: true },
  });

  if (expired.length === 0) {
    return;
  }

  const ids = expired.map((shot) => shot.id);

  const deleteErrors: string[] = [];
  for (const shot of expired) {
    const targets = [shot.videoUrl, shot.imageUrl, shot.posterUrl].filter(
      (value) => typeof value === "string" && value.length > 0
    ) as string[];

    for (const target of targets) {
      try {
        await deleteFromBunny(target);
      } catch (error) {
        deleteErrors.push(
          error instanceof Error ? error.message : "Falha ao deletar shot"
        );
      }
    }

    if (shot.imageUrl) {
      try {
        await deleteThumbnailFromBunny(shot.imageUrl);
      } catch (error) {
        deleteErrors.push(
          error instanceof Error ? error.message : "Falha ao deletar miniatura do shot"
        );
      }
    }
  }

  await prisma.$transaction([
    prisma.shotLike.deleteMany({ where: { shotId: { in: ids } } }),
    prisma.shot.deleteMany({ where: { id: { in: ids } } }),
  ]);

  if (deleteErrors.length > 0) {
    console.warn("Shot cleanup errors:", deleteErrors[0]);
  }
}

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  await purgeExpiredShots();
  const user = getUserFromRequest(req);
  const modelId =
    typeof req.query.modelId === "string" ? req.query.modelId.trim() : "";

  const shots = await prisma.shot.findMany({
    where: {
      isActive: true,
      ...(modelId ? { modelId } : {}),
      model: {
        isVerified: true,
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      model: {
        select: {
          id: true,
          name: true,
          city: true,
          avatarUrl: true,
        },
      },
      _count: {
        select: { likes: true },
      },
    },
  });

  let likedShotIds = new Set<string>();

  if (user) {
    const likes = await prisma.shotLike.findMany({
      where: {
        userId: user.id,
        shotId: { in: shots.map((shot) => shot.id) },
      },
      select: { shotId: true },
    });

    likedShotIds = new Set(likes.map((like) => like.shotId));
  }

  const response = shots.map((shot) => ({
    id: shot.id,
    videoUrl: shot.videoUrl,
    imageUrl: shot.imageUrl,
    type: shot.type,
    posterUrl: shot.posterUrl,
    createdAt: shot.createdAt,
    model: shot.model,
    likeCount: shot.likeCount,
    likedByUser: likedShotIds.has(shot.id),
  }));

  return res.json(response);
}));

router.get("/nearby", asyncHandler(async (req: Request, res: Response) => {
  await purgeExpiredShots();

  const city = String(req.query.city || "").trim();
  if (!city) {
    return res.status(400).json({ error: "Cidade obrigatoria." });
  }

  const rawRadius = Number(req.query.radiusKm || NEARBY_CITY_RADIUS_KM_DEFAULT);
  const radiusKm = Number.isFinite(rawRadius)
    ? Math.min(Math.max(rawRadius, 5), NEARBY_CITY_RADIUS_KM_MAX)
    : NEARBY_CITY_RADIUS_KM_DEFAULT;

  const queryCoords = await geocodeCity(city);
  if (!queryCoords) {
    return res.json({
      queryCity: city,
      radiusKm,
      nearbyCities: [],
      items: [],
    });
  }

  const user = getUserFromRequest(req);

  const shots = await prisma.shot.findMany({
    where: {
      isActive: true,
      model: {
        isVerified: true,
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      model: {
        select: {
          id: true,
          name: true,
          city: true,
          avatarUrl: true,
        },
      },
    },
  });

  const uniqueCities = Array.from(
    new Set(
      shots
        .map((shot) => String(shot.model?.city || "").trim())
        .filter(Boolean)
    )
  );

  const queryCityKey = normalizeCityName(city);
  const cityDistanceMap = new Map<
    string,
    { city: string; distanceKm: number }
  >();

  for (const candidateCity of uniqueCities) {
    const candidateKey = normalizeCityName(candidateCity);
    if (!candidateKey || candidateKey === queryCityKey) {
      continue;
    }

    const coords = await geocodeCity(candidateCity);
    if (!coords) {
      continue;
    }

    const distanceKm = haversineDistanceKm(queryCoords, coords);
    if (distanceKm <= radiusKm) {
      cityDistanceMap.set(candidateKey, {
        city: candidateCity,
        distanceKm: Number(distanceKm.toFixed(1)),
      });
    }
  }

  if (cityDistanceMap.size === 0) {
    return res.json({
      queryCity: city,
      radiusKm,
      nearbyCities: [],
      items: [],
    });
  }

  let likedShotIds = new Set<string>();

  if (user) {
    const likes = await prisma.shotLike.findMany({
      where: {
        userId: user.id,
        shotId: { in: shots.map((shot) => shot.id) },
      },
      select: { shotId: true },
    });

    likedShotIds = new Set(likes.map((like) => like.shotId));
  }

  const nearbyItems = shots
    .map((shot) => {
      const shotCity = String(shot.model?.city || "").trim();
      const distanceData = cityDistanceMap.get(normalizeCityName(shotCity));
      if (!distanceData) {
        return null;
      }

      return {
        id: shot.id,
        videoUrl: shot.videoUrl,
        imageUrl: shot.imageUrl,
        type: shot.type,
        posterUrl: shot.posterUrl,
        createdAt: shot.createdAt,
        model: shot.model,
        likeCount: shot.likeCount,
        likedByUser: likedShotIds.has(shot.id),
        nearbyDistanceKm: distanceData.distanceKm,
      };
    })
    .filter(Boolean);

  const nearbyCities = Array.from(cityDistanceMap.values()).sort(
    (a, b) => a.distanceKm - b.distanceKm
  );

  return res.json({
    queryCity: city,
    radiusKm,
    nearbyCities,
    items: nearbyItems,
  });
}));

router.post(
  "/upload",
  requireAuth,
  requireModel,
  shotUploadLimiter,
  shotAccountUploadLimiter,
  progressiveShotUpload,
  asyncHandler(async (req: Request, res: Response) => {
    await purgeExpiredShots();
    const user = res.locals.user as { id: string; role: string };
    if (!user || user.role !== "MODEL") {
      return res.status(403).json({ error: "Acesso restrito" });
    }

    const files = getProgressiveUploadFiles(req);
    const receivedThumbnails = getProgressiveUploadFiles(req, "thumbnails");
    const thumbnails = getProgressiveUploadThumbnails(req);
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    for (const file of files) {
      const validationError = getUploadedFileError(file);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }
    }
    for (const thumbnail of receivedThumbnails) {
      if (thumbnail.mimetype !== "image/webp" || thumbnail.size > THUMBNAIL_MAX_BYTES) {
        return res.status(400).json({ error: "Miniatura de imagem invalida." });
      }
      const validationError = getUploadedFileError(thumbnail);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }
    }

    const model = await prisma.model.findUnique({ where: { id: user.id } });
    if (!model) {
      return res.status(404).json({ error: "Modelo nao encontrada" });
    }
    if (!model.isVerified) {
      return res.status(403).json({ error: "Modelo nao aprovada" });
    }

    const hasAreaAccess = modelHasPaidAreaAccess({
      id: model.id,
      name: model.name,
      trialEndsAt: model.trialEndsAt,
      planExpiresAt: model.planExpiresAt,
      });
    if (!hasAreaAccess) {
      return respondModelTrialExpired(res, model);
    }

    let images = 0;
    let videos = 0;
    for (const file of files) {
      if (!shotTypes.has(file.mimetype)) {
        return res.status(400).json({ error: "Formato de arquivo invalido" });
      }
      if (file.mimetype.startsWith("video/")) {
        videos += 1;
      } else {
        images += 1;
      }
    }

    if (videos > 1 || images > 2 || (videos > 0 && images > 0)) {
      return res.status(400).json({
        error: "Envie 1 video ou ate 2 fotos por vez.",
      });
    }

    const uploads = [];
    for (const [fileIndex, file] of files.entries()) {
      const result = await uploadProgressiveFile(file, thumbnails.get(fileIndex));

      const created = await prisma.shot.create({
        data: {
          modelId: user.id,
          type: file.mimetype.startsWith("video/") ? "VIDEO" : "IMAGE",
          videoUrl: file.mimetype.startsWith("video/") ? result.url : "",
          imageUrl: file.mimetype.startsWith("video/") ? null : result.url,
          posterUrl: null,
          isActive: true,
        },
      });

      uploads.push(created);
    }

    return res.status(201).json({ uploads });
  })
);

router.post("/:id/like", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = res.locals.user;

  if (user.role !== "USER") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  const shot = await prisma.shot.findFirst({
    where: { id, isActive: true },
  });

  if (!shot) {
    return res.status(404).json({ error: "Shot nao encontrado" });
  }

  await prisma.shotLike.upsert({
    where: {
      shotId_userId: {
        shotId: id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      shotId: id,
      userId: user.id,
    },
  });

  const likeCount = await prisma.shotLike.count({ where: { shotId: id } });

  return res.json({ liked: true, likeCount });
}));

router.delete("/:id/like", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = res.locals.user;

  if (user.role !== "USER") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  await prisma.shotLike.deleteMany({
    where: {
      shotId: id,
      userId: user.id,
    },
  });

  const likeCount = await prisma.shotLike.count({ where: { shotId: id } });

  return res.json({ liked: false, likeCount });
}));

router.post("/:id/like-guest", guestLikeLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const shot = await prisma.shot.findFirst({
    where: { id, isActive: true },
  });

  if (!shot) {
    return res.status(404).json({ error: "Shot nao encontrado" });
  }

  const guestFingerprint = createHash("sha256")
    .update(`${req.ip || "unknown"}|${String(req.headers["user-agent"] || "")}`)
    .digest("hex");
  try {
    const claimed = await redis.set(
      `shot:guest-like:${id}:${guestFingerprint}`,
      "1",
      { EX: 24 * 60 * 60, NX: true }
    );
    if (!claimed) {
      return res.json({ liked: true, likeCount: shot.likeCount, deduped: true });
    }
  } catch (error) {
    console.error("Guest like deduplication error:", error);
  }

  const updated = await prisma.shot.update({
    where: { id },
    data: { likeCount: { increment: 1 } },
    select: { likeCount: true },
  });

  return res.json({ liked: true, likeCount: updated.likeCount });
}));

export default router;


