import crypto from "crypto";

const isProduction = process.env.NODE_ENV === "production";
const OTP_HASH_SECRET =
  process.env.OTP_HASH_SECRET || (isProduction ? "" : "dev_secret_change_me");

if (isProduction && !OTP_HASH_SECRET) {
  throw new Error("OTP_HASH_SECRET nao configurado em producao.");
}

export function gen6(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function hashCode(phoneDigits: string, code: string): string {
  return crypto
    .createHmac("sha256", OTP_HASH_SECRET)
    .update(`${phoneDigits}:${code}`)
    .digest("hex");
}
