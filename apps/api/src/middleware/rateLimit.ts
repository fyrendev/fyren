import type { Context, Next } from "hono";
import { redis } from "../lib/redis";

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Key prefix for Redis */
  keyPrefix?: string;
  /** Function to generate the rate limit key (defaults to IP-based) */
  keyGenerator?: (c: Context) => string;
  /** Function to skip rate limiting for certain requests */
  skip?: (c: Context) => boolean;
}

/** Rate limit presets for different route types */
export const RATE_LIMITS = {
  /** Public API endpoints: 100 requests per minute */
  public: { limit: 100, windowSeconds: 60 },
  /** Authentication endpoints: 10 requests per minute */
  auth: { limit: 10, windowSeconds: 60 },
  /** Admin API endpoints: 200 requests per minute */
  admin: { limit: 200, windowSeconds: 60 },
  /** Badge/widget endpoints: 1000 requests per minute (CDN-friendly) */
  badge: { limit: 1000, windowSeconds: 60 },
  /** Subscription endpoints: 5 requests per hour */
  subscribe: { limit: 5, windowSeconds: 3600 },
} as const;

/**
 * Get the client IP from the request
 */
function getClientIP(c: Context): string {
  // Check common proxy headers
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    // Take the first IP if there are multiple
    const firstIP = forwarded.split(",")[0];
    if (firstIP) return firstIP.trim();
  }

  const realIP = c.req.header("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback to a default (in production, this should rarely happen)
  return "unknown";
}

/**
 * Create a rate limiting middleware using Redis sliding window algorithm
 *
 * Uses Redis sorted sets (ZADD) to implement a sliding window rate limiter.
 * This approach is more accurate than fixed window and handles edge cases better.
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    limit,
    windowSeconds,
    keyPrefix = "rl",
    keyGenerator = (c) => getClientIP(c),
    skip,
  } = config;

  const windowMs = windowSeconds * 1000;

  return async (c: Context, next: Next) => {
    // Allow skipping rate limiting for certain requests
    if (skip?.(c)) {
      return next();
    }

    const key = `${keyPrefix}:${keyGenerator(c)}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = redis.pipeline();

      // Remove old entries outside the window
      pipeline.zremrangebyscore(key, 0, windowStart);

      // Add current request
      pipeline.zadd(key, now.toString(), `${now}-${Math.random()}`);

      // Count requests in the current window
      pipeline.zcard(key);

      // Set expiry on the key (cleanup)
      pipeline.expire(key, windowSeconds + 1);

      const results = await pipeline.exec();

      if (!results) {
        // Redis error - allow request but log warning
        console.warn("Rate limit Redis pipeline returned null");
        return next();
      }

      // Get the count from the ZCARD result (3rd command, index 2)
      const countResult = results[2];
      const count = countResult && countResult[1] ? (countResult[1] as number) : 0;

      // Calculate remaining requests
      const remaining = Math.max(0, limit - count);
      const resetTime = Math.ceil((now + windowMs) / 1000);

      // Set rate limit headers
      c.header("X-RateLimit-Limit", limit.toString());
      c.header("X-RateLimit-Remaining", remaining.toString());
      c.header("X-RateLimit-Reset", resetTime.toString());

      // Check if rate limit exceeded
      if (count > limit) {
        const retryAfter = Math.ceil(windowMs / 1000);
        c.header("Retry-After", retryAfter.toString());

        return c.json(
          {
            error: {
              message: "Too many requests. Please try again later.",
              code: "RATE_LIMIT_EXCEEDED",
              retryAfter,
            },
          },
          429
        );
      }

      return next();
    } catch (error) {
      // On Redis error, log and allow the request (fail open)
      console.error("Rate limiting error:", error);
      return next();
    }
  };
}

/**
 * Create rate limit middleware with a preset configuration
 */
export function rateLimitPreset(
  preset: keyof typeof RATE_LIMITS,
  options?: Partial<RateLimitConfig>
) {
  const presetConfig = RATE_LIMITS[preset];
  return rateLimit({
    ...presetConfig,
    keyPrefix: `rl:${preset}`,
    ...options,
  });
}

/**
 * Public API rate limiter (100 req/min)
 */
export const publicRateLimit = rateLimitPreset("public");

/**
 * Auth endpoints rate limiter (10 req/min)
 */
export const authRateLimit = rateLimitPreset("auth");

/**
 * Admin API rate limiter (200 req/min)
 */
export const adminRateLimit = rateLimitPreset("admin");

/**
 * Badge/widget endpoints rate limiter (1000 req/min)
 */
export const badgeRateLimit = rateLimitPreset("badge");

/**
 * Subscription rate limiter (5 req/hour)
 */
export const subscribeRateLimit = rateLimitPreset("subscribe");
