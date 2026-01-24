import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "access_secret_dev";

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

  if (user.email !== "eduardomateuseichtalt@gmail.com") {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  res.locals.user = user;
  return next();
}
