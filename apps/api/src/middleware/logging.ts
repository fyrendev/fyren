/**
 * HTTP Request Logging Middleware
 *
 * Adds request ID tracking and logs request/response details.
 */

import type { Context, Next } from "hono";
import { logger } from "../lib/logging";

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Logging middleware that tracks requests and responses
 */
export function loggingMiddleware() {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();

    // Generate or use existing request ID
    const requestId = c.req.header("X-Request-ID") ?? generateRequestId();
    c.set("requestId", requestId);
    c.header("X-Request-ID", requestId);

    // Extract request metadata
    const method = c.req.method;
    const path = c.req.path;
    const userAgent = c.req.header("User-Agent");
    const ip = c.req.header("X-Forwarded-For") ?? c.req.header("X-Real-IP") ?? "unknown";

    try {
      await next();
    } finally {
      const duration = Date.now() - startTime;
      const statusCode = c.res.status;

      // Get user context if available
      const userId = c.get("user")?.id;

      logger.http(method, path, statusCode, duration, {
        requestId,
        userAgent: userAgent ?? undefined,
        ip,
        userId,
      });
    }
  };
}
