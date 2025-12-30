import Redis from "ioredis";
import { env } from "../env";

// Standard Redis client for caching and general use
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

redis.on("connect", () => {
  console.log("Connected to Redis");
});

// BullMQ compatible Redis client (requires maxRetriesPerRequest: null)
export const bullmqRedis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

bullmqRedis.on("error", (err) => {
  console.error("BullMQ Redis connection error:", err);
});

bullmqRedis.on("connect", () => {
  console.log("Connected to Redis (BullMQ)");
});
