import { Router, Request, Response } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { getUserFromRequest, requireAuth } from "../lib/auth";
import { deleteFromBunny, uploadToBunny } from "../lib/bunny";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

const shotTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

const SHOT_TTL_HOURS = 24;

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
  }

  await prisma.$transaction([
    prisma.shotLike.deleteMany({ where: { shotId: { in: ids } } }),
    prisma.shot.deleteMany({ where: { id: { in: ids } } }),
  ]);

  if (deleteErrors.length > 0) {
    console.warn("Shot cleanup errors:", deleteErrors[0]);
  }
}

router.get("/", async (req: Request, res: Response) => {
  await purgeExpiredShots();
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
});

router.post(
  "/upload",
  requireAuth,
  upload.array("files", 2),
  async (req: Request, res: Response) => {
    try {
      await purgeExpiredShots();
      const user = res.locals.user as { id: string; role: string };
      if (!user || user.role !== "MODEL") {
        return res.status(403).json({ error: "Acesso restrito" });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const model = await prisma.model.findUnique({ where: { id: user.id } });
      if (!model) {
        return res.status(404).json({ error: "Modelo nao encontrada" });
      }
      if (!model.isVerified) {
        return res.status(403).json({ error: "Modelo nao aprovada" });
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
      for (const file of files) {
        const result = await uploadToBunny(
          file.buffer,
          file.originalname,
          file.mimetype
        );

        const created = await prisma.shot.create({
          data: {
            modelId: user.id,
            type: file.mimetype.startsWith("video/") ? "VIDEO" : "IMAGE",
            videoUrl: file.mimetype.startsWith("video/") ? result.url : null,
            imageUrl: file.mimetype.startsWith("video/") ? null : result.url,
            posterUrl: null,
            isActive: true,
          },
        });

        uploads.push(created);
      }

      return res.status(201).json({ uploads });
    } catch (error) {
      console.error("Shot upload error:", error);
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : "Erro ao enviar shot",
      });
    }
  }
);

router.post("/:id/like", requireAuth, async (req: Request, res: Response) => {
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
});

router.delete("/:id/like", requireAuth, async (req: Request, res: Response) => {
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
});

router.post("/:id/like-guest", async (req: Request, res: Response) => {
  const { id } = req.params;

  const shot = await prisma.shot.findFirst({
    where: { id, isActive: true },
  });

  if (!shot) {
    return res.status(404).json({ error: "Shot nao encontrado" });
  }

  const updated = await prisma.shot.update({
    where: { id },
    data: { likeCount: { increment: 1 } },
    select: { likeCount: true },
  });

  return res.json({ liked: true, likeCount: updated.likeCount });
});

export default router;
