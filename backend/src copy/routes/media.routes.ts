import { Router, Request, Response } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { requireAdmin, requireAuth } from "../lib/auth";
import { deleteFromBunny, uploadToBunny, validateBunnyConnection } from "../lib/bunny";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

const allowedTypes = new Set([
  "image/jpeg",
  "image/webp",
  "image/png",
  "video/mp4",
]);

const mapMediaType = (mime: string) =>
  mime.startsWith("video/") ? "VIDEO" : "IMAGE";

router.post(
  "/upload",
  upload.array("files", 15),
  async (req: Request, res: Response) => {
    try {
      const { modelId } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!modelId) {
        return res.status(400).json({ error: "ModelId obrigatorio" });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const model = await prisma.model.findUnique({ where: { id: modelId } });

      if (!model) {
        return res.status(404).json({ error: "Modelo nao encontrada" });
      }

      const uploads = [];

      let needsCover = !model.coverUrl;
      let needsAvatar = !model.avatarUrl;

      let newImages = 0;
      let newVideos = 0;

      for (const file of files) {
        if (!allowedTypes.has(file.mimetype)) {
          return res.status(400).json({ error: "Formato de arquivo invalido" });
        }
        if (file.mimetype.startsWith("video/")) {
          newVideos += 1;
        } else {
          newImages += 1;
        }
      }

      if (newVideos < 1 || newImages < 1) {
        return res.status(400).json({
          error: "Envie pelo menos 1 foto de perfil e 1 video de verificacao.",
        });
      }

      for (const file of files) {
        const result = await uploadToBunny(
          file.buffer,
          file.originalname,
          file.mimetype
        );

        const created = await prisma.media.create({
          data: {
            modelId,
            type: mapMediaType(file.mimetype),
            url: result.url,
          },
        });

        uploads.push(created);

        if (created.type === "IMAGE" && (needsCover || needsAvatar)) {
          const data: { coverUrl?: string; avatarUrl?: string } = {};
          if (needsCover) {
            data.coverUrl = created.url;
            needsCover = false;
          }
          if (needsAvatar) {
            data.avatarUrl = created.url;
            needsAvatar = false;
          }

          await prisma.model.update({
            where: { id: modelId },
            data,
          });
        }
      }

      return res.status(201).json({ uploads });
    } catch (error) {
      console.error("Media upload error:", error);
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : "Erro ao enviar midia",
      });
    }
  }
);

router.post(
  "/upload-self",
  requireAuth,
  upload.array("files", 15),
  async (req: Request, res: Response) => {
    try {
      const user = res.locals.user as { id: string; role: string };
      if (!user || user.role !== "MODEL") {
        return res.status(403).json({ error: "Acesso restrito" });
      }

      const modelId = user.id;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const model = await prisma.model.findUnique({ where: { id: modelId } });

      if (!model) {
        return res.status(404).json({ error: "Modelo nao encontrada" });
      }
      if (!model.isVerified) {
        return res.status(403).json({ error: "Modelo nao aprovada" });
      }

      const [existingImages, existingVideos] = await Promise.all([
        prisma.media.count({ where: { modelId, type: "IMAGE" } }),
        prisma.media.count({ where: { modelId, type: "VIDEO" } }),
      ]);

      let newImages = 0;
      let newVideos = 0;

      for (const file of files) {
        if (!allowedTypes.has(file.mimetype)) {
          return res.status(400).json({ error: "Formato de arquivo invalido" });
        }
        if (file.mimetype.startsWith("video/")) {
          newVideos += 1;
        } else {
          newImages += 1;
        }
      }

      if (existingVideos + newVideos > 3) {
        return res
          .status(400)
          .json({ error: "Limite de 3 videos atingido." });
      }

      if (existingImages + newImages > 12) {
        return res
          .status(400)
          .json({ error: "Limite de 12 fotos atingido." });
      }

      const uploads = [];

      let needsCover = !model.coverUrl;
      let needsAvatar = !model.avatarUrl;

      for (const file of files) {
        const result = await uploadToBunny(
          file.buffer,
          file.originalname,
          file.mimetype
        );

        const created = await prisma.media.create({
          data: {
            modelId,
            type: mapMediaType(file.mimetype),
            url: result.url,
          },
        });

        uploads.push(created);

        if (created.type === "IMAGE" && (needsCover || needsAvatar)) {
          const data: { coverUrl?: string; avatarUrl?: string } = {};
          if (needsCover) {
            data.coverUrl = created.url;
            needsCover = false;
          }
          if (needsAvatar) {
            data.avatarUrl = created.url;
            needsAvatar = false;
          }

          await prisma.model.update({
            where: { id: modelId },
            data,
          });
        }
      }

      return res.status(201).json({ uploads });
    } catch (error) {
      console.error("Media upload error:", error);
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : "Erro ao enviar midia",
      });
    }
  }
);

router.get("/self", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user as { id: string; role: string };
  if (!user || user.role !== "MODEL") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  const media = await prisma.media.findMany({
    where: { modelId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return res.json(media);
});

router.get("/health", requireAdmin, async (_req: Request, res: Response) => {
  try {
    await validateBunnyConnection();
    return res.json({ status: "ok" });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao validar Bunny",
    });
  }
});

router.get(
  "/model/:id",
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const media = await prisma.media.findMany({
      where: { modelId: id, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
    });

    return res.json(media);
  }
);

router.get("/pending", requireAdmin, async (_req: Request, res: Response) => {
  const media = await prisma.media.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: { model: { select: { id: true, name: true } } },
  });

  return res.json(media);
});

router.patch("/:id/approve", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;

  const updated = await prisma.media.update({
    where: { id },
    data: { status: "APPROVED" },
  });

  return res.json(updated);
});

router.patch("/:id/reject", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;

  const media = await prisma.media.findUnique({ where: { id } });

  if (!media) {
    return res.status(404).json({ error: "Midia nao encontrada" });
  }

  await deleteFromBunny(media.url);
  await prisma.media.delete({ where: { id } });

  return res.json({ status: "deleted" });
});

router.delete("/purge-rejected", requireAdmin, async (req: Request, res: Response) => {
  const days = Number(req.query.days) || 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rejected = await prisma.media.findMany({
    where: { status: "REJECTED", createdAt: { lt: cutoff } },
    select: { id: true, url: true },
  });

  const deletedIds: string[] = [];
  const errors: string[] = [];

  for (const item of rejected) {
    try {
      await deleteFromBunny(item.url);
      deletedIds.push(item.id);
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "Falha ao deletar midia"
      );
    }
  }

  if (deletedIds.length > 0) {
    await prisma.media.deleteMany({ where: { id: { in: deletedIds } } });
  }

  return res.json({
    deleted: deletedIds.length,
    errors,
  });
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = res.locals.user as { id: string; role: string };

  if (!user || user.role !== "MODEL") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  const media = await prisma.media.findUnique({ where: { id } });

  if (!media) {
    return res.status(404).json({ error: "Midia nao encontrada" });
  }

  if (media.modelId !== user.id) {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  await prisma.media.delete({ where: { id } });

  return res.json({ status: "deleted" });
});

export default router;
