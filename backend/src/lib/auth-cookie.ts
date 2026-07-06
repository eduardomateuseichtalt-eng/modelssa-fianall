import type { Request, Response } from "express";

export const AUTH_COOKIE_NAME = "modelsClubSession";

const isProduction = process.env.NODE_ENV === "production";
const cookieDomain = String(process.env.AUTH_COOKIE_DOMAIN || "").trim();

function parseCookies(req: Request) {
  const cookies = new Map<string, string>();
  String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const separator = part.indexOf("=");
      if (separator <= 0) return;
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      try {
        cookies.set(name, decodeURIComponent(value));
      } catch {
        cookies.set(name, value);
      }
    });
  return cookies;
}

export function getAuthCookie(req: Request) {
  return parseCookies(req).get(AUTH_COOKIE_NAME) || "";
}

export function hasAuthCookie(req: Request) {
  return Boolean(getAuthCookie(req));
}

export function setAuthCookie(res: Response, token: string, maxAgeMs: number) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: maxAgeMs,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
}
