import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { requireAdmin, requireAuth } from "../lib/auth";
import { asyncHandler } from "../lib/async-handler";

type FaqReportRow = {
  id: string;
  message: string;
  contact: string | null;
  origin: string;
  category: string | null;
  modelId: string | null;
  modelName?: string | null;
  modelEmail?: string | null;
  adminResponse: string | null;
  status: string;
  respondedAt: Date | null;
  respondedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const router = Router();
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONTACT_LENGTH = 255;
const MAX_RESPONSE_LENGTH = 2000;
const ALLOWED_CATEGORIES = new Set(["DENUNCIA", "SUGESTAO", "RECLAMACAO"]);

const trimToNull = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
};

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const message = String(req.body?.message || "").trim();
    const contact = trimToNull(req.body?.contact);

    if (!message) {
      return res.status(400).json({ error: "Descreva o problema." });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: "Mensagem muito longa." });
    }

    if (contact && contact.length > MAX_CONTACT_LENGTH) {
      return res.status(400).json({ error: "Contato muito longo." });
    }

    const reportId = randomUUID();

    const rows = await prisma.$queryRaw<FaqReportRow[]>`
      INSERT INTO "FaqReport" ("id", "message", "contact", "origin", "status", "createdAt", "updatedAt")
      VALUES (${reportId}, ${message}, ${contact}, 'FAQ_PUBLIC', 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING "id", "message", "contact", "origin", "category", "modelId", "adminResponse", "status", "respondedAt", "respondedBy", "createdAt", "updatedAt"
    `;

    return res.status(201).json({
      status: "ok",
      report: rows[0],
    });
  })
);

router.post(
  "/self",
  requireAuth,
  asyncHandler(async (_req: Request, res: Response) => {
    const user = res.locals.user as { id: string; role: string } | undefined;
    if (!user || user.role !== "MODEL") {
      return res.status(403).json({ error: "Acesso restrito" });
    }

    const message = String(_req.body?.message || "").trim();
    const categoryRaw = String(_req.body?.category || "")
      .trim()
      .toUpperCase();
    const contact = trimToNull(_req.body?.contact);

    if (!message) {
      return res.status(400).json({ error: "Descreva o problema." });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: "Mensagem muito longa." });
    }
    if (contact && contact.length > MAX_CONTACT_LENGTH) {
      return res.status(400).json({ error: "Contato muito longo." });
    }
    if (!ALLOWED_CATEGORIES.has(categoryRaw)) {
      return res.status(400).json({ error: "Categoria invalida." });
    }

    const model = await prisma.model.findUnique({
      where: { id: user.id },
      select: { id: true },
    });
    if (!model) {
      return res.status(404).json({ error: "Modelo nao encontrada." });
    }

    const reportId = randomUUID();
    const rows = await prisma.$queryRaw<FaqReportRow[]>`
      INSERT INTO "FaqReport" ("id", "message", "contact", "origin", "category", "modelId", "status", "createdAt", "updatedAt")
      VALUES (${reportId}, ${message}, ${contact}, 'MODEL', ${categoryRaw}, ${user.id}, 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING "id", "message", "contact", "origin", "category", "modelId", "adminResponse", "status", "respondedAt", "respondedBy", "createdAt", "updatedAt"
    `;

    return res.status(201).json({
      status: "ok",
      report: rows[0],
    });
  })
);

router.get(
  "/self",
  requireAuth,
  asyncHandler(async (_req: Request, res: Response) => {
    const user = res.locals.user as { id: string; role: string } | undefined;
    if (!user || user.role !== "MODEL") {
      return res.status(403).json({ error: "Acesso restrito" });
    }

    const rows = await prisma.$queryRaw<FaqReportRow[]>`
      SELECT "id", "message", "contact", "origin", "category", "modelId", "adminResponse", "status", "respondedAt", "respondedBy", "createdAt", "updatedAt"
      FROM "FaqReport"
      WHERE "modelId" = ${user.id}
      ORDER BY "createdAt" DESC
      LIMIT 100
    `;

    return res.json(rows);
  })
);

router.get(
  "/admin",
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const rows = await prisma.$queryRaw<FaqReportRow[]>`
      SELECT
        fr."id",
        fr."message",
        fr."contact",
        fr."origin",
        fr."category",
        fr."modelId",
        fr."adminResponse",
        fr."status",
        fr."respondedAt",
        fr."respondedBy",
        fr."createdAt",
        fr."updatedAt",
        m."name" AS "modelName",
        m."email" AS "modelEmail"
      FROM "FaqReport" fr
      LEFT JOIN "Model" m ON m."id" = fr."modelId"
      ORDER BY fr."createdAt" DESC
      LIMIT 100
    `;

    return res.json(rows);
  })
);

router.patch(
  "/admin/:id/respond",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const user = res.locals.user as { email?: string } | undefined;
    const id = String(req.params?.id || "").trim();
    const adminResponse = String(req.body?.adminResponse || "").trim();

    if (!id) {
      return res.status(400).json({ error: "Id obrigatorio." });
    }

    if (!adminResponse) {
      return res.status(400).json({ error: "Resposta obrigatoria." });
    }

    if (adminResponse.length > MAX_RESPONSE_LENGTH) {
      return res.status(400).json({ error: "Resposta muito longa." });
    }

    const rows = await prisma.$queryRaw<FaqReportRow[]>`
      UPDATE "FaqReport"
      SET
        "adminResponse" = ${adminResponse},
        "status" = 'ANSWERED',
        "respondedAt" = CURRENT_TIMESTAMP,
        "respondedBy" = ${String(user?.email || "").trim() || null},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
      RETURNING "id", "message", "contact", "origin", "category", "modelId", "adminResponse", "status", "respondedAt", "respondedBy", "createdAt", "updatedAt"
    `;

    if (!rows[0]) {
      return res.status(404).json({ error: "Relato nao encontrado." });
    }

    return res.json(rows[0]);
  })
);

export default router;
