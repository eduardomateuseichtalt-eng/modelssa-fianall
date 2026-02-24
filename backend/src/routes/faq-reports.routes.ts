import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth";
import { asyncHandler } from "../lib/async-handler";

type FaqReportRow = {
  id: string;
  message: string;
  contact: string | null;
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
      INSERT INTO "FaqReport" ("id", "message", "contact", "status", "createdAt", "updatedAt")
      VALUES (${reportId}, ${message}, ${contact}, 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING "id", "message", "contact", "adminResponse", "status", "respondedAt", "respondedBy", "createdAt", "updatedAt"
    `;

    return res.status(201).json({
      status: "ok",
      report: rows[0],
    });
  })
);

router.get(
  "/admin",
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const rows = await prisma.$queryRaw<FaqReportRow[]>`
      SELECT "id", "message", "contact", "adminResponse", "status", "respondedAt", "respondedBy", "createdAt", "updatedAt"
      FROM "FaqReport"
      ORDER BY "createdAt" DESC
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
      RETURNING "id", "message", "contact", "adminResponse", "status", "respondedAt", "respondedBy", "createdAt", "updatedAt"
    `;

    if (!rows[0]) {
      return res.status(404).json({ error: "Relato nao encontrado." });
    }

    return res.json(rows[0]);
  })
);

export default router;
