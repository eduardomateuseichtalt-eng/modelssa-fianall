import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHmac, randomUUID } from "crypto";
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
import { buildModelTrialExpiredResponse, modelHasPaidAreaAccess } from "../lib/model-access";

const router = Router();
const isProduction = process.env.NODE_ENV === "production";
const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || (isProduction ? "" : "access_secret_dev");

if (isProduction && !ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET nao configurado em producao.");
}
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
const MODEL_LOGIN_LIMIT_PER_EMAIL = 20;
const MODEL_LOGIN_LIMIT_PER_IP = 60;
const MODEL_LOGIN_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const MODEL_PRESENCE_PULSE_TTL_SECONDS = 120;
const MODEL_MANUAL_ONLINE_MAX_MINUTES = 24 * 60;
const MODEL_REGISTER_EMAIL_OTP_REQUIRED =
  String(process.env.MODEL_REGISTER_EMAIL_OTP_REQUIRED || "true").trim().toLowerCase() !== "false";
const PROFILE_CLICKS_DEFAULT_DAYS = 14;
const PROFILE_CLICKS_MAX_DAYS = 90;
const MODEL_NEARBY_RADIUS_KM_DEFAULT = 50;
const MODEL_NEARBY_RADIUS_KM_MAX = 200;
const MODEL_CITY_COORD_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CityCoord = { lat: number; lon: number; expiresAt: number };
const modelCityCoordCache = new Map<string, CityCoord>();

const sanitizeStringArray = (value: unknown): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return Array.from(new Set(normalized)).slice(0, 60);
};

const PAYMENT_METHOD_OPTIONS = ["DINHEIRO", "PIX", "CREDITO", "DEBITO"] as const;
const PAYMENT_METHOD_SET = new Set<string>(PAYMENT_METHOD_OPTIONS);
const ATTENDANCE_DAY_OPTIONS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;
const ATTENDANCE_DAY_SET = new Set<string>(ATTENDANCE_DAY_OPTIONS);
const ATTENDANCE_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const sanitizePaymentMethods = (value: unknown): string[] | undefined => {
  const normalized = sanitizeStringArray(value);
  if (normalized === undefined) {
    return undefined;
  }
  return normalized
    .map((item) => String(item || "").trim().toUpperCase())
    .filter((item) => PAYMENT_METHOD_SET.has(item))
    .slice(0, PAYMENT_METHOD_OPTIONS.length);
};

const sanitizeAttendanceSchedule = (
  value: unknown
): Prisma.InputJsonValue | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return [];
  }

  const byDay = new Map<
    string,
    { day: string; enabled: boolean; start: string; end: string }
  >();

  value.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const row = item as Record<string, unknown>;
    const day = String(row.day || "").trim().toUpperCase();
    if (!ATTENDANCE_DAY_SET.has(day)) {
      return;
    }

    const enabled = Boolean(row.enabled);
    const startRaw = String(row.start || "").trim();
    const endRaw = String(row.end || "").trim();
    const start = ATTENDANCE_TIME_REGEX.test(startRaw) ? startRaw : "09:00";
    const end = ATTENDANCE_TIME_REGEX.test(endRaw) ? endRaw : "18:00";

    byDay.set(day, { day, enabled, start, end });
  });

  return ATTENDANCE_DAY_OPTIONS.map((day) => {
    const existing = byDay.get(day);
    if (existing) {
      return existing;
    }
    return {
      day,
      enabled: false,
      start: "09:00",
      end: "18:00",
    };
  });
};

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

function getMetricsSecret() {
  const secret = process.env.OTP_HASH_SECRET || "";
  if (!secret && process.env.NODE_ENV === "production") {
    return "";
  }
  return secret || "metrics_hash_dev";
}

function getClientFingerprint(req: Request) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.ip || "";
  const userAgent = String(req.headers["user-agent"] || "");
  return `${ip}|${userAgent}`;
}

type LocalRateBucket = { count: number; expiresAt: number };
const localRateStore = new Map<string, LocalRateBucket>();

function incrementLocalRate(key: string, ttlSeconds: number) {
  const now = Date.now();
  const current = localRateStore.get(key);

  if (!current || current.expiresAt <= now) {
    localRateStore.set(key, {
      count: 1,
      expiresAt: now + ttlSeconds * 1000,
    });
    return 1;
  }

  current.count += 1;
  return current.count;
}

async function incrementWithExpiry(key: string, ttlSeconds: number) {
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }
    return count;
  } catch (error) {
    console.error("Model rate-limit Redis fallback:", error);
    return incrementLocalRate(key, ttlSeconds);
  }
}

type PublicModelBase = {
  id: string;
  name: string;
  city: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  genderIdentity: string | null;
  priceHour: number | null;
  price30Min: number | null;
  price15Min: number | null;
  planTier: PlanTier;
  offeredServices: string[];
  galleryPreviewPhotos: string[];
};

const PUBLIC_MODEL_SELECT: Prisma.ModelSelect = {
  id: true,
  name: true,
  city: true,
  avatarUrl: true,
  coverUrl: true,
  genderIdentity: true,
  priceHour: true,
  price30Min: true,
  price15Min: true,
  planTier: true,
  offeredServices: true,
  media: {
    where: {
      status: "APPROVED",
      purpose: "GALLERY",
      type: "IMAGE",
    },
    orderBy: { createdAt: "asc" },
    take: 3,
    select: { url: true },
  },
};

async function getPublicModelsBase(): Promise<PublicModelBase[]> {
  const modelsRaw = await prisma.model.findMany({
    where: {
      isVerified: true,
      media: { some: { status: "APPROVED" } },
    },
    select: PUBLIC_MODEL_SELECT,
  });

  return modelsRaw.map(({ media, ...model }) => ({
    ...model,
    offeredServices: Array.isArray(model.offeredServices) ? model.offeredServices : [],
    galleryPreviewPhotos: media.map((item) => item.url).filter(Boolean),
  }));
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

async function geocodeModelCity(city: string) {
  const normalized = normalizeCity(city);
  if (!normalized) {
    return null;
  }

  const cached = modelCityCoordCache.get(normalized);
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
        "User-Agent": "models-club/1.0 (api@models-club.com)",
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

    modelCityCoordCache.set(normalized, {
      lat,
      lon,
      expiresAt: now + MODEL_CITY_COORD_CACHE_TTL_MS,
    });

    return { lat, lon };
  } catch {
    return null;
  }
}

async function reverseGeocodeModelCity(lat: number, lon: number) {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("zoom", "10");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "models-club/1.0 (api@models-club.com)",
      },
    });
    if (!response.ok) {
      return null;
    }

    const data = (await response.json().catch(() => null)) as
      | {
          address?: {
            city?: string;
            town?: string;
            municipality?: string;
            village?: string;
            county?: string;
          };
        }
      | null;

    const address = data?.address;
    const city =
      String(
        address?.city ||
          address?.town ||
          address?.municipality ||
          address?.village ||
          address?.county ||
          ""
      ).trim() || null;
    return city;
  } catch {
    return null;
  }
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

function respondModelTrialExpired(
  res: Response,
  model: {
    id: string;
    planTier?: PlanTier | null;
    trialEndsAt?: Date | string | null;
    planExpiresAt?: Date | string | null;
  }
) {
  return res.status(402).json(buildModelTrialExpiredResponse(model));
}

async function ensureModelPaidAreaAccessOrRespond(res: Response, modelId: string) {
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: {
      id: true,
      planTier: true,
      trialEndsAt: true,
      planExpiresAt: true,
    },
  });

  if (!model) {
    res.status(404).json({ error: "Modelo nao encontrada" });
    return null;
  }

  const hasAreaAccess = modelHasPaidAreaAccess({
    trialEndsAt: model.trialEndsAt,
    planExpiresAt: model.planExpiresAt,
  });

  if (!hasAreaAccess) {
    respondModelTrialExpired(res, model);
    return null;
  }

  return model;
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
    genderIdentity,
    genitalia,
    sexualPreference,
    ethnicity,
    eyeColor,
    hairStyle,
    hairLength,
    shoeSize,
    silicone,
    tattoos,
    piercings,
    smoker,
    languages,
    priceHour,
    price30Min,
    price15Min,
    planTier,
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
  const planTierRaw = String(planTier || "").trim().toUpperCase();

  if (planTierRaw && planTierRaw !== "BASIC" && planTierRaw !== "PRO") {
    return res.status(400).json({ error: "Plano invalido. Use BASIC ou PRO." });
  }

  const safePlanTier: PlanTier = planTierRaw === "PRO" ? "PRO" : "BASIC";

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
      genderIdentity: trimToNull(genderIdentity),
      genitalia: trimToNull(genitalia),
      sexualPreference: trimToNull(sexualPreference),
      ethnicity: trimToNull(ethnicity),
      eyeColor: trimToNull(eyeColor),
      hairStyle: trimToNull(hairStyle),
      hairLength: trimToNull(hairLength),
      shoeSize: trimToNull(shoeSize),
      silicone: trimToNull(silicone),
      tattoos: trimToNull(tattoos),
      piercings: trimToNull(piercings),
      smoker: trimToNull(smoker),
      languages: trimToNull(languages),
      priceHour: toNumberOrNull(priceHour),
      price30Min: toNumberOrNull(price30Min),
      price15Min: toNumberOrNull(price15Min),
      planTier: safePlanTier,
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
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "Dados obrigatorios ausentes" });
  }

  const ip = getClientIp(req);
  const emailRateKey = `model:login:email:${email}`;
  const ipRateKey = `model:login:ip:${ip}`;

  const [emailCount, ipCount] = await Promise.all([
    incrementWithExpiry(emailRateKey, MODEL_LOGIN_RATE_LIMIT_WINDOW_SECONDS),
    incrementWithExpiry(ipRateKey, MODEL_LOGIN_RATE_LIMIT_WINDOW_SECONDS),
  ]);

  if (emailCount > MODEL_LOGIN_LIMIT_PER_EMAIL || ipCount > MODEL_LOGIN_LIMIT_PER_IP) {
    return res.status(429).json({ error: "Muitas tentativas. Tente mais tarde." });
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

  let effectiveTrialEndsAt = model.trialEndsAt;
  const effectivePlanExpiresAt = model.planExpiresAt;

  // Compatibilidade com contas antigas: conta aprovada sem datas de acesso.
  if (model.isVerified && !effectiveTrialEndsAt && !effectivePlanExpiresAt) {
    const repairedTrialEndsAt = getModelTrialEndDate(30);
    await prisma.model.update({
      where: { id: model.id },
      data: { trialEndsAt: repairedTrialEndsAt },
    });
    effectiveTrialEndsAt = repairedTrialEndsAt;
  }

  if (model.isVerified) {
    const hasAreaAccess = modelHasPaidAreaAccess({
      trialEndsAt: effectiveTrialEndsAt,
      planExpiresAt: effectivePlanExpiresAt,
    });

    if (!hasAreaAccess) {
      return respondModelTrialExpired(res, {
        id: model.id,
        planTier: model.planTier,
        trialEndsAt: effectiveTrialEndsAt,
        planExpiresAt: effectivePlanExpiresAt,
      });
    }
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

  await Promise.allSettled([
    redis.del(emailRateKey),
    redis.del(ipRateKey),
  ]);

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

  if (!(await ensureModelPaidAreaAccessOrRespond(res, user.id))) {
    return;
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

  if (!(await ensureModelPaidAreaAccessOrRespond(res, user.id))) {
    return;
  }

  const state = await getModelPresenceState(user.id);
  return res.json(state);
}));

router.post("/presence/manual", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as { id: string; role: string } | undefined;
  if (!user || user.role !== "MODEL") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  if (!(await ensureModelPaidAreaAccessOrRespond(res, user.id))) {
    return;
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
    select: {
      id: true,
      password: true,
      planTier: true,
      trialEndsAt: true,
      planExpiresAt: true,
    },
  });

  if (!model) {
    return res.status(404).json({ error: "Modelo nao encontrada" });
  }

  const hasAreaAccess = modelHasPaidAreaAccess({
    trialEndsAt: model.trialEndsAt,
    planExpiresAt: model.planExpiresAt,
  });
  if (!hasAreaAccess) {
    return respondModelTrialExpired(res, model);
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
      genderIdentity: true,
      genitalia: true,
      sexualPreference: true,
      ethnicity: true,
      eyeColor: true,
      hairStyle: true,
      hairLength: true,
      shoeSize: true,
      silicone: true,
      tattoos: true,
      piercings: true,
      smoker: true,
      languages: true,
      offeredServices: true,
      priceHour: true,
      price30Min: true,
      price15Min: true,
      price2Hours: true,
      price4Hours: true,
      priceOvernight: true,
      paymentMethods: true,
      attendanceSchedule: true,
      planTier: true,
      planExpiresAt: true,
      trialEndsAt: true,
      avatarUrl: true,
      coverUrl: true,
      createdAt: true,
    },
  });

  if (!model) {
    return res.status(404).json({ error: "Modelo nao encontrada" });
  }

  const hasAreaAccess = modelHasPaidAreaAccess({
    trialEndsAt: model.trialEndsAt,
    planExpiresAt: model.planExpiresAt,
  });
  if (!hasAreaAccess) {
    return respondModelTrialExpired(res, model);
  }

  const mediaLimits = getModelMediaLimits(model);

  return res.json({
    ...model,
    mediaLimits,
  });
}));

router.get("/self/profile-clicks", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as { id: string; role: string } | undefined;
  if (!user || user.role !== "MODEL") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  if (!(await ensureModelPaidAreaAccessOrRespond(res, user.id))) {
    return;
  }

  const rawDays = Number.parseInt(String(req.query.days || PROFILE_CLICKS_DEFAULT_DAYS), 10);
  const days = Number.isFinite(rawDays)
    ? Math.min(Math.max(rawDays, 1), PROFILE_CLICKS_MAX_DAYS)
    : PROFILE_CLICKS_DEFAULT_DAYS;

  const dateKeys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    dateKeys.push(date.toISOString().slice(0, 10));
  }
  const firstDayKey = dateKeys[0];

  const grouped = await prisma.modelProfileAccess.groupBy({
    by: ["dayKey"],
    where: {
      modelId: user.id,
      dayKey: { gte: firstDayKey },
    },
    _count: { _all: true },
    orderBy: { dayKey: "asc" },
  });

  const countByDay = new Map<string, number>();
  grouped.forEach((item) => {
    countByDay.set(item.dayKey, item._count._all);
  });

  const series = dateKeys.map((dayKey) => ({
    dayKey,
    clicks: countByDay.get(dayKey) || 0,
  }));
  const total = series.reduce((sum, item) => sum + item.clicks, 0);

  return res.json({
    days,
    total,
    series,
  });
}));

router.patch("/self/profile", requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as { id: string; role: string } | undefined;
  if (!user || user.role !== "MODEL") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  if (!(await ensureModelPaidAreaAccessOrRespond(res, user.id))) {
    return;
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
  const genderIdentityRaw = String(req.body?.genderIdentity || "").trim();
  const genitaliaRaw = String(req.body?.genitalia || "").trim();
  const sexualPreferenceRaw = String(req.body?.sexualPreference || "").trim();
  const ethnicityRaw = String(req.body?.ethnicity || "").trim();
  const eyeColorRaw = String(req.body?.eyeColor || "").trim();
  const hairStyleRaw = String(req.body?.hairStyle || "").trim();
  const hairLengthRaw = String(req.body?.hairLength || "").trim();
  const shoeSizeRaw = String(req.body?.shoeSize || "").trim();
  const siliconeRaw = String(req.body?.silicone || "").trim();
  const tattoosRaw = String(req.body?.tattoos || "").trim();
  const piercingsRaw = String(req.body?.piercings || "").trim();
  const smokerRaw = String(req.body?.smoker || "").trim();
  const languagesRaw = String(req.body?.languages || "").trim();
  const offeredServicesRaw = req.body?.offeredServices;
  const hasAvatarUrl = Object.prototype.hasOwnProperty.call(req.body || {}, "avatarUrl");
  const hasCoverUrl = Object.prototype.hasOwnProperty.call(req.body || {}, "coverUrl");
  const avatarUrlRaw = hasAvatarUrl ? String(req.body?.avatarUrl || "").trim() : "";
  const coverUrlRaw = hasCoverUrl ? String(req.body?.coverUrl || "").trim() : "";
  const priceHourRaw = req.body?.priceHour;
  const price30MinRaw = req.body?.price30Min;
  const price15MinRaw = req.body?.price15Min;
  const price2HoursRaw = req.body?.price2Hours;
  const price4HoursRaw = req.body?.price4Hours;
  const priceOvernightRaw = req.body?.priceOvernight;
  const paymentMethodsRaw = req.body?.paymentMethods;
  const attendanceScheduleRaw = req.body?.attendanceSchedule;

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
      genderIdentity: genderIdentityRaw || null,
      genitalia: genitaliaRaw || null,
      sexualPreference: sexualPreferenceRaw || null,
      ethnicity: ethnicityRaw || null,
      eyeColor: eyeColorRaw || null,
      hairStyle: hairStyleRaw || null,
      hairLength: hairLengthRaw || null,
      shoeSize: shoeSizeRaw || null,
      silicone: siliconeRaw || null,
      tattoos: tattoosRaw || null,
      piercings: piercingsRaw || null,
      smoker: smokerRaw || null,
      languages: languagesRaw || null,
      offeredServices: sanitizeStringArray(offeredServicesRaw),
      priceHour: toNumberOrNull(priceHourRaw),
      price30Min: toNumberOrNull(price30MinRaw),
      price15Min: toNumberOrNull(price15MinRaw),
      price2Hours: toNumberOrNull(price2HoursRaw),
      price4Hours: toNumberOrNull(price4HoursRaw),
      priceOvernight: toNumberOrNull(priceOvernightRaw),
      paymentMethods: sanitizePaymentMethods(paymentMethodsRaw),
      attendanceSchedule: sanitizeAttendanceSchedule(attendanceScheduleRaw),
      ...(hasAvatarUrl ? { avatarUrl: avatarUrlRaw || null } : {}),
      ...(hasCoverUrl ? { coverUrl: coverUrlRaw || null } : {}),
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
      genderIdentity: true,
      genitalia: true,
      sexualPreference: true,
      ethnicity: true,
      eyeColor: true,
      hairStyle: true,
      hairLength: true,
      shoeSize: true,
      silicone: true,
      tattoos: true,
      piercings: true,
      smoker: true,
      languages: true,
      offeredServices: true,
      priceHour: true,
      price30Min: true,
      price15Min: true,
      price2Hours: true,
      price4Hours: true,
      priceOvernight: true,
      paymentMethods: true,
      attendanceSchedule: true,
      planTier: true,
      planExpiresAt: true,
      trialEndsAt: true,
      avatarUrl: true,
      coverUrl: true,
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
  if (Number.isFinite(durationDays) && durationDays > 0) {
    const safeDays = Math.min(Math.floor(durationDays), 365);
    planExpiresAt = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
  } else {
    planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
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
  const rawService = String(req.query.service || req.query.atendimento || "");
  const serviceFilter = rawService.trim().toLowerCase();

  const rawPage = Number.parseInt(String(req.query.page || "1"), 10);
  const rawLimit = Number.parseInt(String(req.query.limit || "24"), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 60)
    : 24;

  const models = await getPublicModelsBase();

  const cityFilteredModels = city
    ? models.filter((model) => normalizeCity(model.city) === city)
    : models;
  const filteredModels = serviceFilter
    ? cityFilteredModels.filter((model) =>
        (Array.isArray(model.offeredServices) ? model.offeredServices : []).some(
          (service) => {
            const normalized = String(service || "").trim().toLowerCase();
            if (!normalized) return false;
            if (serviceFilter === "online") {
              return normalized.includes("webcam");
            }
            if (serviceFilter === "webcam") {
              return normalized.includes("webcam");
            }
            return normalized === serviceFilter;
          }
        )
      )
    : cityFilteredModels;

  const rotationWindowHours = 6;
  const seed = rotationSeed(rotationWindowHours);
  const seedKey = city ? `${seed}|${city}` : seed;

  const ranked = filteredModels
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

router.get("/auto-nearby", asyncHandler(async (req: Request, res: Response) => {
  const rawLat = Number(req.query.lat);
  const rawLon = Number(req.query.lon);

  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLon)) {
    return res.status(400).json({ error: "Latitude/longitude invalidas." });
  }

  const rawRadius = Number(req.query.radiusKm || MODEL_NEARBY_RADIUS_KM_DEFAULT);
  const radiusKm = Number.isFinite(rawRadius)
    ? Math.min(Math.max(rawRadius, 5), MODEL_NEARBY_RADIUS_KM_MAX)
    : MODEL_NEARBY_RADIUS_KM_DEFAULT;

  const rawPage = Number.parseInt(String(req.query.page || "1"), 10);
  const rawLimit = Number.parseInt(String(req.query.limit || "24"), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 60)
    : 24;

  const models = await getPublicModelsBase();
  const rotationWindowHours = 6;
  const seed = rotationSeed(rotationWindowHours);
  const start = (page - 1) * limit;

  const detectedCity = await reverseGeocodeModelCity(rawLat, rawLon);
  const normalizedDetectedCity = normalizeCity(detectedCity);

  if (normalizedDetectedCity) {
    const sameCity = models.filter(
      (model) => normalizeCity(model.city) === normalizedDetectedCity
    );

    if (sameCity.length > 0) {
      const ranked = sameCity
        .map((model) => ({
          ...model,
          _score: stableHash01(`${model.id}|${seed}|${normalizedDetectedCity}`),
        }))
        .sort((a, b) => b._score - a._score);

      const items = ranked.slice(start, start + limit).map(({ _score, ...rest }) => rest);

      return res.json({
        page,
        limit,
        total: ranked.length,
        rotationWindowHours,
        usedDeviceLocation: true,
        detectedCity,
        fallbackUsed: false,
        radiusKm,
        items,
      });
    }
  }

  const uniqueCities = Array.from(
    new Set(
      models
        .map((model) => String(model.city || "").trim())
        .filter(Boolean)
    )
  );

  const cityCoordsList = await Promise.all(
    uniqueCities.map(async (cityName) => [cityName, await geocodeModelCity(cityName)] as const)
  );
  const cityCoordsMap = new Map(
    cityCoordsList
      .filter((entry): entry is readonly [string, { lat: number; lon: number }] => Boolean(entry[1]))
      .map(([cityName, coords]) => [normalizeCity(cityName), coords])
  );

  const cityDistanceMap = new Map<string, { city: string; distanceKm: number }>();
  const nearbyRanked = models
    .map((model) => {
      const cityName = String(model.city || "").trim();
      const cityKey = normalizeCity(cityName);
      if (!cityKey) {
        return null;
      }
      const coords = cityCoordsMap.get(cityKey);
      if (!coords) {
        return null;
      }

      const distanceKm = haversineDistanceKm(
        { lat: rawLat, lon: rawLon },
        coords
      );

      if (distanceKm > radiusKm) {
        return null;
      }

      const existing = cityDistanceMap.get(cityKey);
      if (!existing || distanceKm < existing.distanceKm) {
        cityDistanceMap.set(cityKey, { city: cityName, distanceKm });
      }

      return {
        ...model,
        nearbyDistanceKm: Number(distanceKm.toFixed(1)),
        _score: stableHash01(`${model.id}|${seed}|nearby`),
      };
    })
    .filter((item): item is PublicModelBase & { nearbyDistanceKm: number; _score: number } => Boolean(item))
    .sort((a, b) => {
      if (a.nearbyDistanceKm !== b.nearbyDistanceKm) {
        return a.nearbyDistanceKm - b.nearbyDistanceKm;
      }
      return b._score - a._score;
    });

  const nearbyCities = Array.from(cityDistanceMap.values())
    .map((item) => ({
      city: item.city,
      distanceKm: Number(item.distanceKm.toFixed(1)),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const items = nearbyRanked.slice(start, start + limit).map(({ _score, ...rest }) => rest);

  return res.json({
    page,
    limit,
    total: nearbyRanked.length,
    rotationWindowHours,
    usedDeviceLocation: true,
    detectedCity,
    fallbackUsed: true,
    radiusKm,
    nearbyCities,
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

router.get("/admin/search", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const rawName = String(req.query.name || "").trim();
  const name = rawName.replace(/\s+/g, " ");

  if (!name || name.length < 2) {
    return res.json([]);
  }

  const models = await prisma.model.findMany({
    where: {
      name: {
        contains: name,
        mode: "insensitive",
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      name: true,
      email: true,
      city: true,
      isVerified: true,
      planTier: true,
      trialEndsAt: true,
      planExpiresAt: true,
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
    data: {
      isVerified: true,
      trialEndsAt:
        (!model.isVerified || (!model.trialEndsAt && !model.planExpiresAt))
          ? getModelTrialEndDate(30)
          : model.trialEndsAt,
    },
    select: {
      id: true,
      name: true,
      email: true,
      city: true,
      isVerified: true,
      trialEndsAt: true,
      planTier: true,
      planExpiresAt: true,
    },
  });

  return res.json({
    ...updated,
    mediaLimits: getModelMediaLimits(updated),
  });
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
    prisma.modelProfileAccess.deleteMany({ where: { modelId: model.id } }),
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
    prisma.modelProfileAccess.deleteMany({ where: { modelId: id } }),
    prisma.cityStat.deleteMany({ where: { modelId: id } }),
    prisma.model.delete({ where: { id } })
  );

  await prisma.$transaction(operations);

  return res.json({ status: "deleted" });
}));

router.post("/:id/profile-view", asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const secret = getMetricsSecret();

  const modelExists = await prisma.model.findFirst({
    where: { id, isVerified: true },
    select: { id: true },
  });

  if (!modelExists) {
    return res.status(404).json({ error: "Acompanhante nao encontrada" });
  }

  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const fingerprint = getClientFingerprint(req);
  const fingerprintHash = createHmac("sha256", secret || "metrics_hash_dev").update(fingerprint).digest("hex");

  await prisma.modelProfileAccess.create({
    data: {
      dayKey,
      modelId: id,
      fingerprintHash,
    },
  });

  return res.status(201).json({ status: "ok" });
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
      genderIdentity: true,
      genitalia: true,
      sexualPreference: true,
      ethnicity: true,
      eyeColor: true,
      hairStyle: true,
      hairLength: true,
      shoeSize: true,
      silicone: true,
      tattoos: true,
      piercings: true,
      smoker: true,
      languages: true,
      offeredServices: true,
      priceHour: true,
      price30Min: true,
      price15Min: true,
      price2Hours: true,
      price4Hours: true,
      priceOvernight: true,
      paymentMethods: true,
      attendanceSchedule: true,
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
