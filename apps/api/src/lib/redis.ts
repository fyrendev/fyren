import Redis from "ioredis";
import { env } from "../env/base";
import { logger } from "./logging";

// Standard Redis client for caching and general use
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on("error", (err) => {
  logger.error("Redis connection error", {
    errorName: err.name,
    errorMessage: err.message,
  });
});

redis.on("connect", () => {
  logger.info("Connected to Redis");
});

// BullMQ compatible Redis client (requires maxRetriesPerRequest: null)
export const bullmqRedis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

bullmqRedis.on("error", (err) => {
  logger.error("BullMQ Redis connection error", {
    errorName: err.name,
    errorMessage: err.message,
  });
});

bullmqRedis.on("connect", () => {
  logger.info("Connected to Redis (BullMQ)");
});
