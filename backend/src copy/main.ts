import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: true });

import express from "express";
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

// ========================
// APP
// ========================
const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const PORT = 4000;

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

  res.status(201).json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

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

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
  });
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
// START SERVER
// ========================
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

initRedis().catch((error) => {
  console.error("Failed to connect to Redis:", error);
});
