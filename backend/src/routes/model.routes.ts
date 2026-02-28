import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { PlanTier, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAdmin, requireAuth } from "../lib/auth";
import { redis } from "../lib/redis";
import { gen6, hashCode, normalizePhone } from "../lib/otp";
import { sendModelRegisterOtpEmail } from "../lib/email";
import { sendWhatsAppText } from "../lib/whatsapp";
import { asyncHandler } from "../lib/async-handler";
import { normalizeCity, rotationSeed, stableHash01 } from "../utils/rotation";
import { getModelMediaLimits, getModelTrialEndDate } from "../lib/model-plan";

const router = Router();
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "access_secret_dev";
const RESET_CODE_TTL_SECONDS = 10 * 60;
const RESET_SEND_LIMIT_PER_EMAIL = 5;
const RESET_SEND_LIMIT_PER_IP = 10;
const RESET_VERIFY_ATTEMPT_LIMIT = 8;
const RESET_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const DEFAULT_COUNTRY_CODE = process.env.SMS_DEFAULT_COUNTRY_CODE || "55";
const REGISTER_EMAIL_OTP_TTL_SECONDS = 10 * 60;
const REGISTER_EMAIL_SEND_LIMIT_PER_EMAIL = 5;
const REGISTER_EMAIL_SEND_LIMIT_PER_IP = 10;
const REGISTER_EMAIL_VERIFY_ATTEMPT_LIMIT = 8;
const REGISTER_EMAIL_VERIFY_TOKEN_TTL_SECONDS = 30 * 60;
const MODEL_PRESENCE_PULSE_TTL_SECONDS = 120;
const MODEL_MANUAL_ONLINE_MAX_MINUTES = 24 * 60;
const MODEL_REGISTER_EMAIL_OTP_REQUIRED =
  String(process.env.MODEL_REGISTER_EMAIL_OTP_REQUIRED || "true").trim().toLowerCase() !== "false";

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

function modelPresenceKey(modelId: string) {
  return `model:presence:pulse:${modelId}`;
}

function modelManualPresenceKey(modelId: string) {
  return `model:presence:manual:${modelId}`;
}

async function markModelOnlinePulse(modelId: string) {
  await redis.set(modelPresenceKey(modelId), "1", { EX: MODEL_PRESENCE_PULSE_TTL_SECONDS });
}

async function setModelManualOnline(modelId: string, durationMinutes: number) {
  const durationSeconds = Math.max(60, Math.floor(durationMinutes * 60));
  const until = new Date(Date.now() + durationSeconds * 1000).toISOString();
  await redis.set(modelManualPresenceKey(modelId), until, { EX: durationSeconds });
  return { until, durationSeconds };
}

async function clearModelPresence(modelId: string) {
  await Promise.all([
    redis.del(modelManualPresenceKey(modelId)),
    redis.del(modelPresenceKey(modelId)),
  ]);
}

async function getModelPresenceState(modelId: string) {
  const manualKey = modelManualPresenceKey(modelId);
  const pulseKey = modelPresenceKey(modelId);

  const [manualUntil, manualTtl, pulseExists] = await Promise.all([
    redis.get(manualKey),
    redis.ttl(manualKey),
    redis.exists(pulseKey),
  ]);

  if (manualTtl > 0) {
    return {
      online: true,
      mode: "manual" as const,
      until: manualUntil || null,
      remainingSeconds: manualTtl,
    };
  }

  if (pulseExists === 1) {
    return {
      online: true,
      mode: "pulse" as const,
      until: null,
      remainingSeconds: MODEL_PRESENCE_PULSE_TTL_SECONDS,
    };
  }

  return {
    online: false,
    mode: "offline" as const,
    until: null,
    remainingSeconds: 0,
  };
}

router.post("/email-otp/send", asyncHandler(async (req: Request, res: Response) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "Email obrigatorio." });
  }

  const validEmail = /\S+@\S+\.\S+/.test(email);
  if (!validEmail) {
    return res.status(400).json({ error: "Email invalido." });
  }

  const exists = await prisma.model.findUnique({
    where: { email },
    select: { id: true },
  });

  if (exists) {
    return res.status(409).json({ error: "Email ja cadastrado" });
  }

  const ip = getClientIp(req);
  const emailKey = `model:register:email-otp:send:email:${email}`;
  const ipKey = `model:register:email-otp:send:ip:${ip}`;

  const [emailCount, ipCount] = await Promise.all([
    incrementWithExpiry(emailKey, RESET_RATE_LIMIT_WINDOW_SECONDS),
    incrementWithExpiry(ipKey, RESET_RATE_LIMIT_WINDOW_SECONDS),
  ]);

  if (
    emailCount > REGISTER_EMAIL_SEND_LIMIT_PER_EMAIL ||
    ipCount > REGISTER_EMAIL_SEND_LIMIT_PER_IP
  ) {
    return res.status(429).json({ error: "Limite de tentativas excedido. Tente mais tarde." });
  }

  const code = gen6();
  const codeKey = `model:register:email-otp:code:${email}`;
  const attemptKey = `model:register:email-otp:attempts:${email}`;

  await Promise.all([
    redis.set(codeKey, hashCode(email, code), { EX: REGISTER_EMAIL_OTP_TTL_SECONDS }),
    redis.del(attemptKey),
  ]);

  try {
    await sendModelRegisterOtpEmail({ to: email, code });
  } catch (error) {
    await Promise.all([redis.del(codeKey), redis.del(attemptKey)]);
    throw error;
  }

  return res.json({
    success: true,
    expiresIn: REGISTER_EMAIL_OTP_TTL_SECONDS,
    channel: "email",
  });
}));

router.post("/email-otp/verify", asyncHandler(async (req: Request, res: Response) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const code = String(req.body?.code || "").trim();

  if (!email || !code) {
    return res.status(400).json({ error: "Email e codigo obrigatorios." });
  }

  const attemptKey = `model:register:email-otp:attempts:${email}`;
  const attemptCount = await incrementWithExpiry(
    attemptKey,
    REGISTER_EMAIL_OTP_TTL_SECONDS
  );

  if (attemptCount > REGISTER_EMAIL_VERIFY_ATTEMPT_LIMIT) {
    return res.status(429).json({ error: "Muitas tentativas. Solicite um novo codigo." });
  }

  const codeKey = `model:register:email-otp:code:${email}`;
  const storedHash = await redis.get(codeKey);

  if (!storedHash) {
    return res.status(400).json({ error: "Codigo expirado ou inexistente." });
  }

  if (storedHash !== hashCode(email, code)) {
    return res.status(400).json({ error: "Codigo invalido." });
  }

  const verificationToken = randomUUID();
  const verifiedKey = `model:register:email-otp:verified:${verificationToken}`;

  await Promise.all([
    redis.set(verifiedKey, email, { EX: REGISTER_EMAIL_VERIFY_TOKEN_TTL_SECONDS }),
    redis.del(codeKey),
    redis.del(attemptKey),
  ]);

  return res.json({
    success: true,
    verificationToken,
    email,
    expiresIn: REGISTER_EMAIL_VERIFY_TOKEN_TTL_SECONDS,
  });
}));

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
    price30Min,
    price15Min,
    emailVerificationToken,
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
  const normalizedEmail = cleanEmail.toLowerCase();

  if (!cleanName || !cleanEmail) {
    return res.status(400).json({ error: "Dados obrigatorios ausentes" });
  }

  const parsedAge = toNumberOrNull(age);

  if (parsedAge === null || parsedAge < 18) {
    return res
      .status(403)
      .json({ error: "Cadastro permitido apenas para maiores de 18 anos" });
  }

  let registerEmailVerifiedKey: string | null = null;
  if (MODEL_REGISTER_EMAIL_OTP_REQUIRED) {
    const verificationToken = String(emailVerificationToken || "").trim();
    if (!verificationToken) {
      return res.status(400).json({ error: "Confirme seu e-mail antes de continuar." });
    }

    const verifiedKey = `model:register:email-otp:verified:${verificationToken}`;
    const verifiedEmail = (await redis.get(verifiedKey)) || "";

    if (!verifiedEmail || verifiedEmail.toLowerCase() !== normalizedEmail) {
      return res.status(400).json({ error: "Confirmacao de e-mail invalida ou expirada." });
    }
    registerEmailVerifiedKey = verifiedKey;
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
      price30Min: toNumberOrNull(price30Min),
      price15Min: toNumberOrNull(price15Min),
      planTier: "BASIC",
      trialEndsAt: getModelTrialEndDate(30),
    },
  });

  if (registerEmailVerifiedKey) {
    await redis.del(registerEmailVerifiedKey);
  }

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

  try {
    await markModelOnlinePulse(model.id);
  } catch (error) {
    console.error("Model presence login heartbeat error:", error);
  }

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

router.post("/presence/heartbeat", requireAuth, asyncHandler(async (_req: Request, res: Response) => {
  const user = res.locals.user as { id: string; role: string } | undefined;
  if (!user || user.role !== "MODEL") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  await markModelOnlinePulse(user.id);

  return res.json({
    success: true,
    online: true,
    ttl: MODEL_PRESENCE_PULSE_TTL_SECONDS,
  });
}));

router.get("/presence/self", requireAuth, asyncHandler(async (_req: Request, res: Response) => {
  const user = res.locals.user as { id: string; role: string } | undefined;
  if (!user || user.role !== "MODEL") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  const state = await getModelPresenceState(user.id);
  return res.json(state);
}));

router.post("/presence/manual", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as { id: string; role: string } | undefined;
  if (!user || user.role !== "MODEL") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  const rawMinutes = req.body?.durationMinutes;
  const durationMinutes = Number(rawMinutes);

  if (!Number.isFinite(durationMinutes)) {
    return res.status(400).json({ error: "Duracao invalida." });
  }

  if (durationMinutes <= 0) {
    await clearModelPresence(user.id);
    return res.json({
      success: true,
      online: false,
      mode: "offline",
      remainingSeconds: 0,
      until: null,
    });
  }

  if (durationMinutes > MODEL_MANUAL_ONLINE_MAX_MINUTES) {
    return res.status(400).json({ error: "Duracao acima do limite permitido." });
  }

  const result = await setModelManualOnline(user.id, durationMinutes);

  return res.json({
    success: true,
    online: true,
    mode: "manual",
    remainingSeconds: result.durationSeconds,
    until: result.until,
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
      instagram: true,
      whatsapp: true,
      city: true,
      bio: true,
      height: true,
      weight: true,
      bust: true,
      waist: true,
      hips: true,
      priceHour: true,
      price30Min: true,
      price15Min: true,
      planTier: true,
      planExpiresAt: true,
      trialEndsAt: true,
    },
  });

  if (!model) {
    return res.status(404).json({ error: "Modelo nao encontrada" });
  }

  const mediaLimits = getModelMediaLimits(model);

  return res.json({
    ...model,
    mediaLimits,
  });
}));

router.patch("/self/profile", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as { id: string; role: string } | undefined;
  if (!user || user.role !== "MODEL") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  const name = String(req.body?.name || "").trim();
  const instagramRaw = String(req.body?.instagram || "").trim();
  const whatsappRaw = String(req.body?.whatsapp || "").trim();
  const cityRaw = String(req.body?.city || "").trim();
  const bioRaw = String(req.body?.bio || "").trim();
  const heightRaw = req.body?.height;
  const weightRaw = req.body?.weight;
  const bustRaw = req.body?.bust;
  const waistRaw = req.body?.waist;
  const hipsRaw = req.body?.hips;
  const priceHourRaw = req.body?.priceHour;
  const price30MinRaw = req.body?.price30Min;
  const price15MinRaw = req.body?.price15Min;

  const toNumberOrNull = (value?: number | string | null) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const parsed =
      typeof value === "number" ? value : Number(String(value).trim());
    return Number.isFinite(parsed) ? parsed : null;
  };

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
      instagram: instagramRaw || null,
      whatsapp: whatsappRaw || null,
      city: cityRaw || null,
      bio: bioRaw || null,
      height: toNumberOrNull(heightRaw),
      weight: toNumberOrNull(weightRaw),
      bust: toNumberOrNull(bustRaw),
      waist: toNumberOrNull(waistRaw),
      hips: toNumberOrNull(hipsRaw),
      priceHour: toNumberOrNull(priceHourRaw),
      price30Min: toNumberOrNull(price30MinRaw),
      price15Min: toNumberOrNull(price15MinRaw),
    },
    select: {
      id: true,
      name: true,
      email: true,
      instagram: true,
      whatsapp: true,
      city: true,
      bio: true,
      height: true,
      weight: true,
      bust: true,
      waist: true,
      hips: true,
      priceHour: true,
      price30Min: true,
      price15Min: true,
      planTier: true,
      planExpiresAt: true,
      trialEndsAt: true,
    },
  });

  const mediaLimits = getModelMediaLimits(updated);

  return res.json({
    ...updated,
    mediaLimits,
  });
}));

router.patch("/:id/plan", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const rawPlanTier = String(req.body?.planTier || "").trim().toUpperCase();
  if (rawPlanTier !== "BASIC" && rawPlanTier !== "PRO") {
    return res.status(400).json({ error: "Plano invalido. Use BASIC ou PRO." });
  }

  const planTier = rawPlanTier as PlanTier;
  const rawDurationDays = req.body?.durationDays;
  const durationDays = Number(rawDurationDays);

  let planExpiresAt: Date | null = null;
  if (planTier === "PRO") {
    if (Number.isFinite(durationDays) && durationDays > 0) {
      const safeDays = Math.min(Math.floor(durationDays), 365);
      planExpiresAt = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
    } else {
      planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  const updated = await prisma.model.update({
    where: { id },
    data: {
      planTier,
      planExpiresAt,
    },
    select: {
      id: true,
      name: true,
      email: true,
      planTier: true,
      planExpiresAt: true,
      trialEndsAt: true,
    },
  });

  return res.json({
    ...updated,
    mediaLimits: getModelMediaLimits(updated),
  });
}));

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const rawCity = String(req.query.city || req.query.cidade || "");
  const city = normalizeCity(rawCity);

  const rawPage = Number.parseInt(String(req.query.page || "1"), 10);
  const rawLimit = Number.parseInt(String(req.query.limit || "24"), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 60)
    : 24;

  const where: Prisma.ModelWhereInput = {
    isVerified: true,
    media: { some: { status: "APPROVED" } },
  };

  const models = await prisma.model.findMany({
    where,
    select: {
      id: true,
      name: true,
      city: true,
      avatarUrl: true,
      coverUrl: true,
      priceHour: true,
      price30Min: true,
      price15Min: true,
    },
  });

  const cityFilteredModels = city
    ? models.filter((model) => normalizeCity(model.city) === city)
    : models;

  const rotationWindowHours = 6;
  const seed = rotationSeed(rotationWindowHours);
  const seedKey = city ? `${seed}|${city}` : seed;

  const ranked = cityFilteredModels
    .map((model) => ({
      ...model,
      _score: stableHash01(`${model.id}|${seedKey}`),
    }))
    .sort((a, b) => b._score - a._score);

  const start = (page - 1) * limit;
  const items = ranked.slice(start, start + limit).map(({ _score, ...rest }) => rest);

  return res.json({
    page,
    limit,
    total: ranked.length,
    rotationWindowHours,
    items,
  });
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
      price30Min: true,
      price15Min: true,
    },
  });

  if (!model) {
    return res.status(404).json({ error: "Modelo nao encontrada" });
  }

  let isOnline = false;
  try {
    const state = await getModelPresenceState(model.id);
    isOnline = state.online;
  } catch (error) {
    console.error("Model presence read error:", error);
  }

  return res.json({
    ...model,
    isOnline,
  });
}));

export default router;
