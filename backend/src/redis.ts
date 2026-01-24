import path from "path";
import dotenv from "dotenv";
import { createClient } from "redis";

// Carrega variáveis do .env APENAS em ambiente local
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
}

const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,
  },
});

redis.on("error", (err) => {
  console.error("Redis Client Error", err);
});

redis.connect().catch((err) => {
  console.error("Redis connect error:", err);
});

export default redis;
1