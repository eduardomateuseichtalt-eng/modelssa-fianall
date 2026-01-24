import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth";
import { asyncHandler } from "../lib/async-handler";

const router = Router();
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "access_secret_dev";

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

router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const models = await prisma.model.findMany({
    where: { isVerified: true },
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
