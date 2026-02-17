import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAdmin, requireAuth } from "../lib/auth";
import { redis } from "../lib/redis";
import { gen6, hashCode, normalizePhone } from "../lib/otp";
import { sendWhatsAppText } from "../lib/whatsapp";
import { asyncHandler } from "../lib/async-handler";

const router = Router();
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "access_secret_dev";
const RESET_CODE_TTL_SECONDS = 10 * 60;
const RESET_SEND_LIMIT_PER_EMAIL = 5;
const RESET_SEND_LIMIT_PER_IP = 10;
const RESET_VERIFY_ATTEMPT_LIMIT = 8;
const RESET_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const DEFAULT_COUNTRY_CODE = process.env.SMS_DEFAULT_COUNTRY_CODE || "55";

function getClientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  return req.ip || "unknown";
}

async function incrementWithExpiry(key: string, ttlSeconds: number) {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }
  return count;
}

function formatWhatsAppDigits(phoneDigits: string) {
  if (phoneDigits.startsWith(DEFAULT_COUNTRY_CODE)) {
    return phoneDigits;
  }
  if (phoneDigits.length <= 11) {
    return `${DEFAULT_COUNTRY_CODE}${phoneDigits}`;
  }
  return phoneDigits;
}

router.post("/register", asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    email,
    password,
    age,
    city,
    bio,
    avatarUrl,
    coverUrl,
    instagram,
    whatsapp,
    height,
    weight,
    bust,
    waist,
    hips,
    priceHour,
  } = req.body;

  const trimToNull = (value?: string | null) => {
    if (typeof value !== "string") {
      return value ?? null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const toNumberOrNull = (value?: number | string | null) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const parsed =
      typeof value === "number" ? value : Number(String(value).trim());
    return Number.isFinite(parsed) ? parsed : null;
  };

  if (!name || !email || !password || age === undefined) {
    return res.status(400).json({ error: "Dados obrigatorios ausentes" });
  }

  const cleanName = String(name).trim();
  const cleanEmail = String(email).trim();

  if (!cleanName || !cleanEmail) {
    return res.status(400).json({ error: "Dados obrigatorios ausentes" });
  }

  const parsedAge = toNumberOrNull(age);

  if (parsedAge === null || parsedAge < 18) {
    return res
      .status(403)
      .json({ error: "Cadastro permitido apenas para maiores de 18 anos" });
  }

  const exists = await prisma.model.findUnique({
    where: { email: cleanEmail },
  });

  if (exists) {
    return res.status(409).json({ error: "Email ja cadastrado" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prisma.model.create({
    data: {
      name: cleanName,
      email: cleanEmail,
      password: passwordHash,
      age: parsedAge,
      city: trimToNull(city),
      bio: trimToNull(bio),
      avatarUrl: trimToNull(avatarUrl),
      coverUrl: trimToNull(coverUrl),
      instagram: trimToNull(instagram),
      whatsapp: trimToNull(whatsapp),
      height: toNumberOrNull(height),
      weight: toNumberOrNull(weight),
      bust: toNumberOrNull(bust),
      waist: toNumberOrNull(waist),
      hips: toNumberOrNull(hips),
      priceHour: toNumberOrNull(priceHour),
    },
  });

  return res.status(201).json({
    message: "Cadastro realizado com sucesso. Aguarde aprovacao.",
    id: created.id,
  });
}));

router.post("/login", asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Dados obrigatorios ausentes" });
  }

  const model = await prisma.model.findUnique({
    where: { email },
  });

  if (!model) {
    return res.status(401).json({ error: "Credenciais invalidas" });
  }

  const valid = await bcrypt.compare(password, model.password);

  if (!valid) {
    return res.status(401).json({ error: "Credenciais invalidas" });
  }

  const accessToken = jwt.sign(
    { id: model.id, email: model.email, role: "MODEL" },
    ACCESS_SECRET,
    { expiresIn: "1d" }
  );

  return res.json({
    accessToken,
    user: {
      id: model.id,
      email: model.email,
      displayName: model.name,
      role: "MODEL",
    },
  });
}));

router.post("/forgot-password", asyncHandler(async (req: Request, res: Response) => {
  const email = String(req.body?.email || "").trim().toLowerCase();

  if (!email) {
    return res.status(400).json({ error: "Email obrigatorio." });
  }

  const ip = getClientIp(req);
  const emailKey = `model:reset:send:email:${email}`;
  const ipKey = `model:reset:send:ip:${ip}`;

  const [emailCount, ipCount] = await Promise.all([
    incrementWithExpiry(emailKey, RESET_RATE_LIMIT_WINDOW_SECONDS),
    incrementWithExpiry(ipKey, RESET_RATE_LIMIT_WINDOW_SECONDS),
  ]);

  if (emailCount > RESET_SEND_LIMIT_PER_EMAIL || ipCount > RESET_SEND_LIMIT_PER_IP) {
    return res.status(429).json({ error: "Limite de tentativas excedido. Tente mais tarde." });
  }

  const model = await prisma.model.findUnique({
    where: { email },
    select: {
      whatsapp: true,
    },
  });

  // Resposta neutra para nao expor se o email existe.
  if (!model) {
    return res.json({ success: true, expiresIn: RESET_CODE_TTL_SECONDS });
  }

  const rawWhatsappDigits = normalizePhone(String(model.whatsapp || ""));
  if (rawWhatsappDigits.length < 10) {
    return res.status(400).json({
      error: "Nao foi possivel recuperar a senha. Atualize seu WhatsApp no cadastro.",
    });
  }
  const whatsappDigits = formatWhatsAppDigits(rawWhatsappDigits);

  const code = gen6();
  const codeKey = `model:reset:code:${email}`;
  const attemptKey = `model:reset:attempts:${email}`;

  await Promise.all([
    redis.set(codeKey, hashCode(email, code), { EX: RESET_CODE_TTL_SECONDS }),
    redis.del(attemptKey),
  ]);

  try {
    await sendWhatsAppText(
      whatsappDigits,
      `Codigo de recuperacao de senha: ${code}. Valido por 10 minutos.`
    );
  } catch (error) {
    console.error("Model forgot password send error:", error);
    return res.status(500).json({ error: "Falha ao enviar o codigo." });
  }

  return res.json({ success: true, expiresIn: RESET_CODE_TTL_SECONDS });
}));

router.post("/reset-password", asyncHandler(async (req: Request, res: Response) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const code = String(req.body?.code || "").replace(/\D/g, "");
  const newPassword = String(req.body?.newPassword || "");

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: "Dados obrigatorios ausentes." });
  }

  if (code.length !== 6) {
    return res.status(400).json({ error: "Codigo invalido." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres." });
  }

  const attemptKey = `model:reset:attempts:${email}`;
  const attempts = await incrementWithExpiry(attemptKey, RESET_CODE_TTL_SECONDS);

  if (attempts > RESET_VERIFY_ATTEMPT_LIMIT) {
    return res.status(429).json({ error: "Muitas tentativas. Tente mais tarde." });
  }

  const codeKey = `model:reset:code:${email}`;
  const storedHash = await redis.get(codeKey);

  if (!storedHash) {
    return res.status(400).json({ error: "Codigo expirado." });
  }

  if (storedHash !== hashCode(email, code)) {
    return res.status(400).json({ error: "Codigo incorreto." });
  }

  const model = await prisma.model.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!model) {
    return res.status(400).json({ error: "Conta nao encontrada." });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await Promise.all([
    prisma.model.update({
      where: { email },
      data: { password: passwordHash },
    }),
    redis.del(codeKey),
    redis.del(attemptKey),
  ]);

  return res.json({ success: true, message: "Senha redefinida com sucesso." });
}));

router.post("/change-password", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as { id: string; role: string } | undefined;
  if (!user || user.role !== "MODEL") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Dados obrigatorios ausentes." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres." });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ error: "A nova senha deve ser diferente da atual." });
  }

  const model = await prisma.model.findUnique({
    where: { id: user.id },
    select: { id: true, password: true },
  });

  if (!model) {
    return res.status(404).json({ error: "Modelo nao encontrada" });
  }

  const valid = await bcrypt.compare(currentPassword, model.password);
  if (!valid) {
    return res.status(401).json({ error: "Senha atual incorreta." });
  }

  const nextHash = await bcrypt.hash(newPassword, 10);
  await prisma.model.update({
    where: { id: user.id },
    data: { password: nextHash },
  });

  return res.json({ success: true, message: "Senha atualizada com sucesso." });
}));

router.get("/self/profile", requireAuth, asyncHandler(async (_req: Request, res: Response) => {
  const user = res.locals.user as { id: string; role: string } | undefined;
  if (!user || user.role !== "MODEL") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  const model = await prisma.model.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      whatsapp: true,
      city: true,
      bio: true,
    },
  });

  if (!model) {
    return res.status(404).json({ error: "Modelo nao encontrada" });
  }

  return res.json(model);
}));

router.patch("/self/profile", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as { id: string; role: string } | undefined;
  if (!user || user.role !== "MODEL") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  const name = String(req.body?.name || "").trim();
  const whatsappRaw = String(req.body?.whatsapp || "").trim();
  const cityRaw = String(req.body?.city || "").trim();
  const bioRaw = String(req.body?.bio || "").trim();

  if (!name) {
    return res.status(400).json({ error: "Nome artistico obrigatorio." });
  }

  const whatsappDigits = normalizePhone(whatsappRaw);
  if (whatsappRaw && (whatsappDigits.length < 10 || whatsappDigits.length > 15)) {
    return res.status(400).json({ error: "Telefone invalido." });
  }

  const updated = await prisma.model.update({
    where: { id: user.id },
    data: {
      name,
      whatsapp: whatsappRaw || null,
      city: cityRaw || null,
      bio: bioRaw || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      whatsapp: true,
      city: true,
      bio: true,
    },
  });

  return res.json(updated);
}));

router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const models = await prisma.model.findMany({
    where: {
      isVerified: true,
      media: { some: { status: "APPROVED" } },
    },
    select: {
      id: true,
      name: true,
      city: true,
      avatarUrl: true,
      coverUrl: true,
      priceHour: true,
    },
  });

  return res.json(models);
}));

router.get("/pending", requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const models = await prisma.model.findMany({
    where: { isVerified: false },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      city: true,
      createdAt: true,
    },
  });

  return res.json(models);
}));

router.patch("/:id/approve", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const model = await prisma.model.findUnique({ where: { id } });

  if (!model) {
    return res.status(404).json({ error: "Modelo nao encontrada" });
  }

  const updated = await prisma.model.update({
    where: { id },
    data: { isVerified: true },
    select: {
      id: true,
      name: true,
      email: true,
      city: true,
      isVerified: true,
    },
  });

  return res.json(updated);
}));

router.delete("/by-email", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const email = String(req.query.email || "").trim();

  if (!email) {
    return res.status(400).json({ error: "Email obrigatorio" });
  }

  const model = await prisma.model.findUnique({ where: { email } });

  if (!model) {
    return res.status(404).json({ error: "Modelo nao encontrada" });
  }

  const shots = await prisma.shot.findMany({
    where: { modelId: model.id },
    select: { id: true },
  });
  const shotIds = shots.map((shot) => shot.id);

  const operations: Prisma.PrismaPromise<unknown>[] = [];
  if (shotIds.length > 0) {
    operations.push(
      prisma.shotLike.deleteMany({ where: { shotId: { in: shotIds } } })
    );
  }
  operations.push(
    prisma.shot.deleteMany({ where: { modelId: model.id } }),
    prisma.media.deleteMany({ where: { modelId: model.id } }),
    prisma.cityStat.deleteMany({ where: { modelId: model.id } }),
    prisma.model.delete({ where: { id: model.id } })
  );

  await prisma.$transaction(operations);

  return res.json({ status: "deleted", email });
}));

router.delete("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const model = await prisma.model.findUnique({ where: { id } });

  if (!model) {
    return res.status(404).json({ error: "Modelo nao encontrada" });
  }

  const shots = await prisma.shot.findMany({
    where: { modelId: id },
    select: { id: true },
  });
  const shotIds = shots.map((shot) => shot.id);

  const operations: Prisma.PrismaPromise<unknown>[] = [];
  if (shotIds.length > 0) {
    operations.push(
      prisma.shotLike.deleteMany({ where: { shotId: { in: shotIds } } })
    );
  }
  operations.push(
    prisma.shot.deleteMany({ where: { modelId: id } }),
    prisma.media.deleteMany({ where: { modelId: id } }),
    prisma.model.delete({ where: { id } })
  );

  await prisma.$transaction(operations);

  return res.json({ status: "deleted" });
}));

router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const model = await prisma.model.findFirst({
    where: { id, isVerified: true },
    select: {
      id: true,
      name: true,
      city: true,
      bio: true,
      avatarUrl: true,
      coverUrl: true,
      instagram: true,
      whatsapp: true,
      height: true,
      weight: true,
      bust: true,
      waist: true,
      hips: true,
      priceHour: true,
    },
  });

  if (!model) {
    return res.status(404).json({ error: "Modelo nao encontrada" });
  }

  return res.json(model);
}));

export default router;
