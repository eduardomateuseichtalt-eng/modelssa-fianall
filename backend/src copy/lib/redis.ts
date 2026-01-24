import { createClient } from "redis";

const redisUrl =
  process.env.REDIS_URL ||
  (process.env.REDIS_HOST
    ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
    : "redis://127.0.0.1:6379");

export const redis = createClient({ url: redisUrl });

redis.on("error", (error) => {
  console.error("Redis error:", error);
});

let hasConnected = false;

export async function initRedis() {
  if (hasConnected) {
    return;
  }
  await redis.connect();
  hasConnected = true;
}
