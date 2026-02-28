import crypto from "crypto";

export function rotationSeed(hoursWindow = 6) {
  const safeWindow = Number.isFinite(hoursWindow) && hoursWindow > 0 ? hoursWindow : 6;
  const windowMs = safeWindow * 60 * 60 * 1000;
  return Math.floor(Date.now() / windowMs).toString();
}

export function stableHash01(input: string) {
  const hex = crypto.createHash("sha256").update(input).digest("hex").slice(0, 8);
  const int = parseInt(hex, 16);
  return int / 0xffffffff;
}

export function normalizeCity(value?: string | null) {
  if (!value) {
    return null;
  }
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
  return normalized || null;
}
