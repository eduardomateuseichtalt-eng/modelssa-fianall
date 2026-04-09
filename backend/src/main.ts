import dotenv from "dotenv";
import path from "path";

if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
}

import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./lib/prisma";
import { initRedis } from "./lib/redis";
import { redis } from "./lib/redis";
import { gen6, normalizePhone, hashCode } from "./lib/otp";
import { sendWhatsAppText } from "./lib/whatsapp";
import modelRoutes from "./routes/model.routes";
import shotRoutes from "./routes/shot.routes";
import metricsRoutes from "./routes/metrics.routes";
import mediaRoutes from "./routes/media.routes";
import phoneRoutes from "./routes/phone.routes";
import cityStatsRoutes from "./routes/city-stats.routes";
import cacheImageRoutes from "./routes/cache-image.routes";
import messagesRoutes from "./routes/messages.routes";
import faqReportsRoutes from "./routes/faq-reports.routes";
import modelReviewsRoutes from "./routes/model-reviews.routes";
import roomRoutes from "./routes/room.routes";

// ========================
// APP
// ========================
const app = express();
const isProduction = process.env.NODE_ENV === "production";
app.set("trust proxy", 1);

const normalizeOrigin = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, "");
  // Remove default ports to avoid mismatches like :443 or :80
  return trimmed
    .replace(/:443$/i, "")
    .replace(/:80$/i, "")
    .toLowerCase();
};

const parseCsv = (value: string) =>
  value
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);

const defaultAllowedOrigins = [
  "https://models-club.com",
  "https://www.models-club.com",
  "https://api.models-club.com",
  "https://modelssa-fianall.vercel.app",
  "https://backend-model-s.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

const envAllowedOrigins = parseCsv(process.env.CORS_ALLOWED_ORIGINS || "");
const allowedOrigins = new Set(
  [
  ...defaultAllowedOrigins,
  ...envAllowedOrigins,
  ].map(normalizeOrigin)
);

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // permite requests sem origin (Postman/healthcheck)
    if (!origin) return cb(null, true);

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.has(normalizedOrigin)) return cb(null, true);

    return cb(new Error(`CORS bloqueado para a origem: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-reset-key"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  if (isProduction) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
  return next();
});

app.use(express.json());

app.get("/api/health/redis", async (_req, res) => {
  try {
    await initRedis();

    await redis.set("health:redis", "ok", { EX: 15 });
    const value = await redis.get("health:redis");
    return res.json({ status: "ok", value });
  } catch (e: any) {
    console.error("Redis health error:", e?.message || e);
    return res
      .status(500)
      .json({ status: "error", message: e?.message || String(e) });
  }
});

const PORT = Number(process.env.PORT) || 4000;

// ========================
// JWT CONFIG
// ========================
const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  (isProduction ? "" : "access_secret_dev");
const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  (isProduction ? "" : "refresh_secret_dev");

const ADMIN_ROUTE_ENABLED_NON_PROD = !isProduction;
const ENABLE_ADMIN_RESET =
  ADMIN_ROUTE_ENABLED_NON_PROD ||
  String(process.env.ENABLE_ADMIN_RESET || "false")
    .trim()
    .toLowerCase() === "true";
const ENABLE_ADMIN_BOOTSTRAP =
  ADMIN_ROUTE_ENABLED_NON_PROD ||
  String(process.env.ENABLE_ADMIN_BOOTSTRAP || "false")
    .trim()
    .toLowerCase() === "true";

const parseAllowedIps = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const allowedAdminIps = new Set(
  parseAllowedIps(process.env.ADMIN_ROUTE_ALLOWED_IPS || "")
);

function normalizeIp(value: string) {
  const trimmed = String(value || "").trim();
  return trimmed.startsWith("::ffff:") ? trimmed.slice(7) : trimmed;
}

function getClientIp(req: Request) {
  const fromReqIp = normalizeIp(req.ip || "");
  if (fromReqIp) {
    return fromReqIp;
  }

  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return normalizeIp(forwarded.split(",")[0].trim());
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return normalizeIp(forwarded[0]);
  }
  return normalizeIp(req.ip || "unknown");
}

function isAllowedAdminIp(req: Request) {
  if (!isProduction || allowedAdminIps.size === 0) {
    return true;
  }
  return allowedAdminIps.has(getClientIp(req));
}

function assertRequiredSecrets() {
  if (!isProduction) {
    return;
  }

  const missing: string[] = [];
  if (!ACCESS_SECRET) missing.push("JWT_ACCESS_SECRET");
  if (!REFRESH_SECRET) missing.push("JWT_REFRESH_SECRET");
  if (!String(process.env.OTP_HASH_SECRET || "").trim()) {
    missing.push("OTP_HASH_SECRET");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required env in production: ${missing.join(", ")}`);
  }
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
    if ((redis as any).isOpen) {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, ttlSeconds);
      }
      return count;
    }
  } catch (error) {
    console.error("Rate-limit Redis fallback:", error);
  }

  return incrementLocalRate(key, ttlSeconds);
}

type RateLimitOptions = {
  prefix: string;
  limit: number;
  ttlSeconds: number;
};

function createIpRateLimiter({ prefix, limit, ttlSeconds }: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const key = `rl:${prefix}:ip:${ip}`;
    const count = await incrementWithExpiry(key, ttlSeconds);

    if (count > limit) {
      return res.status(429).json({ error: "Muitas tentativas. Tente mais tarde." });
    }

    return next();
  };
}

assertRequiredSecrets();

// ========================
// AUTH HELPERS
// ========================
function generateAccessToken(payload: object) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
}

function generateRefreshToken(payload: object) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
}

// ========================
// AUTH ROUTES
// ========================
app.post(
  "/api/auth/register",
  createIpRateLimiter({ prefix: "auth-register", limit: 20, ttlSeconds: 60 * 60 }),
  async (req, res) => {
    try {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: "Dados obrigatorios ausentes" });
    }

    const exists = await prisma.user.findUnique({
      where: { email },
    });

    if (exists) {
      return res.status(409).json({ error: "Email ja cadastrado" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash,
        role: "USER",
      },
    });

      return res.status(201).json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      });
    } catch (error) {
      console.error("Register error:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  }
);

app.post(
  "/api/auth/login",
  createIpRateLimiter({ prefix: "auth-login", limit: 30, ttlSeconds: 60 * 60 }),
  async (req, res) => {
    try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Dados obrigatorios ausentes" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: "Credenciais invalidas" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      return res.status(401).json({ error: "Credenciais invalidas" });
    }

    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({ id: user.id });

      return res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  }
);

app.post("/api/auth/admin-reset", async (req, res) => {
  try {
    if (!ENABLE_ADMIN_RESET) {
      return res.status(403).json({ error: "Rota desabilitada em producao" });
    }

    if (!isAllowedAdminIp(req)) {
      return res.status(403).json({ error: "IP nao autorizado" });
    }

    const resetKey = process.env.ADMIN_RESET_KEY || "";
    const providedKey = String(req.headers["x-admin-reset-key"] || "");

    if (!resetKey || providedKey !== resetKey) {
      return res.status(403).json({ error: "Acesso restrito" });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Dados obrigatorios ausentes" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        role: "ADMIN",
      },
      create: {
        email,
        passwordHash,
        role: "ADMIN",
      },
    });

    return res.json({ status: "ok", id: updated.id, email: updated.email });
  } catch (error) {
    console.error("Admin reset error:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

app.post("/api/admin/bootstrap", async (req, res) => {
  if (!ENABLE_ADMIN_BOOTSTRAP) {
    return res.status(403).json({ error: "Rota desabilitada em producao" });
  }

  if (!isAllowedAdminIp(req)) {
    return res.status(403).json({ error: "IP nao autorizado" });
  }

  const { key, email, password } = req.body;

  if (!process.env.ADMIN_KEY_RESET || key !== process.env.ADMIN_KEY_RESET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role: "ADMIN" },
      create: { email, passwordHash, role: "ADMIN" },
    });

    return res.json({ success: true, adminId: admin.id });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: "bootstrap failed", details: e?.message || String(e) });
  }
});

// ========================
// MODELOS
// ========================
app.use("/api/models", modelRoutes);
app.use("/api/shots", shotRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/phone", phoneRoutes);
app.use("/api/city-stats", cityStatsRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/faq-reports", faqReportsRoutes);
app.use("/api/model-reviews", modelReviewsRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api", cacheImageRoutes);

// ========================
// HEALTH CHECK
// ========================
app.get("/api/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(500).json({ status: "error", database: "offline" });
  }
});

// ========================
// FALLBACK + ERROR HANDLING
// ========================
app.use((_req, res) => {
  res.status(404).json({ error: "Rota nao encontrada" });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const msg = String(err?.message || "");

  // Se for erro de CORS, devolve 403 (nao 500)
  if (msg.startsWith("CORS bloqueado para a origem:")) {
    return res.status(403).json({ error: msg });
  }

  console.error("API error:", err);
  return res.status(500).json({ error: "Erro interno do servidor" });
});

// ========================
// START SERVER
// ========================
async function connectToDatabase(retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await prisma.$connect();
      console.log("✅ Prisma connected");
      return;
    } catch (error) {
      console.error(`❌ Failed to connect to database (attempt ${attempt}):`, error);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  console.error("❌ Could not connect to database after retries. Exiting.");
  process.exit(1);
}

async function startServer() {
  await connectToDatabase();

  await initRedis().catch((error) => {
    console.error("Failed to connect to Redis:", error);
  });

  app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
  });
}

startServer();

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});
