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
import modelRoutes from "./routes/model.routes";
import shotRoutes from "./routes/shot.routes";
import metricsRoutes from "./routes/metrics.routes";
import mediaRoutes from "./routes/media.routes";
import phoneRoutes from "./routes/phone.routes";
import cityStatsRoutes from "./routes/city-stats.routes";
import cacheImageRoutes from "./routes/cache-image.routes";

// ========================
// APP
// ========================
const app = express();

const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_PREVIEW,
    "http://localhost:5173",
  ].filter(Boolean) as string[]
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      if (/\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

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

// ========================
// MODELOS
// ========================
app.use("/api/models", modelRoutes);
app.use("/api/shots", shotRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/phone", phoneRoutes);
app.use("/api/city-stats", cityStatsRoutes);
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

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("API error:", err);
  res.status(500).json({ error: "Erro interno do servidor" });
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
