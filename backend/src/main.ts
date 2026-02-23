import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: true });

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

// ========================
// APP
// ========================
const app = express();

const parseCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
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
const allowedOrigins = new Set([
  ...defaultAllowedOrigins,
  ...envAllowedOrigins,
]);

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // permite requests sem origin (Postman/healthcheck)
    if (!origin) return cb(null, true);

    if (allowedOrigins.has(origin)) return cb(null, true);

    return cb(new Error(`CORS bloqueado para a origem: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-reset-key"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
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
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "access_secret_dev";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh_secret_dev";

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
app.post("/api/auth/register", async (req, res) => {
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
});

app.post("/api/auth/login", async (req, res) => {
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
});

app.post("/api/auth/admin-reset", async (req, res) => {
  try {
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

  app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
  });

  initRedis().catch((error) => {
    console.error("Failed to connect to Redis:", error);
  });
}

startServer();

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});
