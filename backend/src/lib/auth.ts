import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const isProduction = process.env.NODE_ENV === "production";
const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || (isProduction ? "" : "access_secret_dev");

if (isProduction && !ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET nao configurado em producao.");
}

type JwtPayload = {
  id: string;
  email: string;
  role: string;
};

export function getUserFromRequest(req: Request) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getUserFromRequest(req);

  if (!user) {
    return res.status(401).json({ error: "Autenticacao necessaria" });
  }

  res.locals.user = user;
  return next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getUserFromRequest(req);

  if (!user) {
    return res.status(401).json({ error: "Autenticacao necessaria" });
  }

  if (user.role !== "ADMIN") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  // If an admin email is configured, restrict admin routes to it.
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (adminEmail && user.email.toLowerCase() !== adminEmail) {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  res.locals.user = user;
  return next();
}
