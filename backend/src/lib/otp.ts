import crypto from "crypto";

export function gen6(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function hashCode(phoneDigits: string, code: string): string {
  const secret = process.env.OTP_HASH_SECRET || "dev_secret_change_me";
  return crypto
    .createHmac("sha256", secret)
    .update(`${phoneDigits}:${code}`)
    .digest("hex");
}
