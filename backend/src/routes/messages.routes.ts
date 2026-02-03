import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { asyncHandler } from "../lib/async-handler";

type Message = {
  id: string;
  modelId: string;
  text: string;
  fromName: string | null;
  fromPhone: string | null;
  createdAt: number;
};

type MessageStore = {
  messages: Message[];
  lastReadAt: number;
};

const messageStore = new Map<string, MessageStore>();
const MAX_MESSAGES = 50;

const getStore = (modelId: string) => {
  const existing = messageStore.get(modelId);
  if (existing) {
    return existing;
  }
  const created = { messages: [], lastReadAt: 0 };
  messageStore.set(modelId, created);
  return created;
};

const router = Router();

router.post(
  "/:modelId",
  asyncHandler(async (req: Request, res: Response) => {
    const { modelId } = req.params;
    const text = String(req.body?.text || "").trim();
    const fromNameRaw = String(req.body?.fromName || "").trim();
    const fromPhoneRaw = String(req.body?.fromPhone || "").trim();

    if (!modelId || !text) {
      return res.status(400).json({ error: "Mensagem obrigatoria." });
    }

    const model = await prisma.model.findFirst({
      where: { id: modelId, isVerified: true },
      select: { id: true },
    });

    if (!model) {
      return res.status(404).json({ error: "Modelo nao encontrada." });
    }

    const store = getStore(modelId);
    const message: Message = {
      id: randomUUID(),
      modelId,
      text,
      fromName: fromNameRaw ? fromNameRaw : null,
      fromPhone: fromPhoneRaw ? fromPhoneRaw : null,
      createdAt: Date.now(),
    };

    store.messages.unshift(message);
    if (store.messages.length > MAX_MESSAGES) {
      store.messages.length = MAX_MESSAGES;
    }

    return res.json({ status: "ok" });
  })
);

router.get(
  "/self",
  requireAuth,
  asyncHandler(async (_req: Request, res: Response) => {
    const user = res.locals.user;
    if (!user || user.role !== "MODEL") {
      return res.status(403).json({ error: "Acesso restrito" });
    }

    const store = getStore(user.id);
    const unreadCount = store.messages.filter(
      (message) => message.createdAt > store.lastReadAt
    ).length;

    return res.json({
      unreadCount,
      messages: store.messages,
    });
  })
);

router.post(
  "/self/read",
  requireAuth,
  asyncHandler(async (_req: Request, res: Response) => {
    const user = res.locals.user;
    if (!user || user.role !== "MODEL") {
      return res.status(403).json({ error: "Acesso restrito" });
    }

    const store = getStore(user.id);
    store.lastReadAt = Date.now();

    return res.json({ status: "ok" });
  })
);

export default router;
