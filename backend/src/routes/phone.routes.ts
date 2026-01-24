import { Router, Request, Response } from "express";
import { redis } from "../lib/redis";
import { sendSmsCode } from "../lib/sms";
import { asyncHandler } from "../lib/async-handler";

const router = Router();

const CODE_TTL_SECONDS = 5 * 60;
const SEND_LIMIT_PER_PHONE = 5;
const SEND_LIMIT_PER_IP = 10;
const VERIFY_ATTEMPT_LIMIT = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const DEFAULT_COUNTRY_CODE = process.env.SMS_DEFAULT_COUNTRY_CODE || "55";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function isValidPhone(value: string) {
  return value.length >= 10 && value.length <= 15;
}

function formatE164(phone: string) {
  if (phone.startsWith(DEFAULT_COUNTRY_CODE)) {
    return `+${phone}`;
  }
  if (phone.length <= 11) {
    return `+${DEFAULT_COUNTRY_CODE}${phone}`;
  }
  return `+${phone}`;
}

function getClientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  return req.ip || "unknown";
}

async function incrementWithExpiry(key: string, ttlSeconds: number) {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }
  return count;
}

router.post("/send-code", asyncHandler(async (req: Request, res: Response) => {
  const rawPhone = String(req.body.phone || "");
  const phone = normalizePhone(rawPhone);

  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: "Numero de telefone invalido." });
  }

  const ip = getClientIp(req);
  const phoneKey = `sms:send:phone:${phone}`;
  const ipKey = `sms:send:ip:${ip}`;

  const [phoneCount, ipCount] = await Promise.all([
    incrementWithExpiry(phoneKey, RATE_LIMIT_WINDOW_SECONDS),
    incrementWithExpiry(ipKey, RATE_LIMIT_WINDOW_SECONDS),
  ]);

  if (phoneCount > SEND_LIMIT_PER_PHONE || ipCount > SEND_LIMIT_PER_IP) {
    return res.status(429).json({ error: "Limite de envios excedido." });
  }

  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const codeKey = `sms:code:${phone}`;
  const attemptKey = `sms:verify:attempts:${phone}`;

  await Promise.all([
    redis.set(codeKey, code, { EX: CODE_TTL_SECONDS }),
    redis.del(attemptKey),
  ]);

  try {
    const deliveryPhone = formatE164(phone);
    await sendSmsCode(deliveryPhone, code);
  } catch (error) {
    console.error("SMS send error:", error);
    return res.status(500).json({ error: "Falha ao enviar o codigo." });
  }

  return res.json({ success: true, expiresIn: CODE_TTL_SECONDS });
}));

router.post("/verify-code", asyncHandler(async (req: Request, res: Response) => {
  const rawPhone = String(req.body.phone || "");
  const rawCode = String(req.body.code || "");
  const phone = normalizePhone(rawPhone);
  const code = rawCode.replace(/\D/g, "");

  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: "Numero de telefone invalido." });
  }

  if (code.length !== 4) {
    return res.status(400).json({ error: "Codigo invalido." });
  }

  const attemptKey = `sms:verify:attempts:${phone}`;
  const attempts = await incrementWithExpiry(attemptKey, CODE_TTL_SECONDS);

  if (attempts > VERIFY_ATTEMPT_LIMIT) {
    return res.status(429).json({ error: "Muitas tentativas. Tente depois." });
  }

  const codeKey = `sms:code:${phone}`;
  const storedCode = await redis.get(codeKey);

  if (!storedCode) {
    return res.status(400).json({ error: "Codigo expirado." });
  }

  if (storedCode !== code) {
    return res.status(400).json({ error: "Codigo incorreto." });
  }

  await Promise.all([redis.del(codeKey), redis.del(attemptKey)]);

  return res.json({ verified: true });
}));

export default router;
