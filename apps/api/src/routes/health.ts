import { Hono } from "hono";
import { db } from "../lib/db";
import { redis } from "../lib/redis";
import { sql } from "@fyrendev/db";

const health = new Hono();

/**
 * GET /health - Basic liveness check
 *
 * Used by load balancers to check if the service is alive.
 * Always returns 200 if the server is running.
 */
health.get("/", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/ready - Readiness check
 *
 * Checks all dependencies (database, Redis) are reachable.
 * Returns 200 if all healthy, 503 if any dependency is unhealthy.
 * Used by Kubernetes readiness probes.
 */
health.get("/ready", async (c) => {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};
  let allHealthy = true;

  // Check PostgreSQL
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: "ok", latency: Date.now() - dbStart };
  } catch (error) {
    allHealthy = false;
    const message = error instanceof Error ? error.message : "Unknown error";
    checks.database = { status: "error", error: message };
  }

  // Check Redis
  const redisStart = Date.now();
  try {
    const pong = await redis.ping();
    if (pong === "PONG") {
      checks.redis = { status: "ok", latency: Date.now() - redisStart };
    } else {
      allHealthy = false;
      checks.redis = { status: "error", error: "Unexpected response" };
    }
  } catch (error) {
    allHealthy = false;
    const message = error instanceof Error ? error.message : "Unknown error";
    checks.redis = { status: "error", error: message };
  }

  return c.json(
    {
      status: allHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    allHealthy ? 200 : 503
  );
});

/**
 * GET /health/startup - Startup probe
 *
 * Used by Kubernetes to check if the application has started.
 * Only checks basic database connectivity.
 */
health.get("/startup", async (c) => {
  try {
    await db.execute(sql`SELECT 1`);
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json(
      {
        status: "error",
        error: message,
        timestamp: new Date().toISOString(),
      },
      503
    );
  }
});

/**
 * GET /health/db - Database health check
 */
health.get("/db", async (c) => {
  try {
    await db.execute(sql`SELECT 1`);
    return c.json({
      status: "ok",
      service: "postgres",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json(
      {
        status: "error",
        service: "postgres",
        error: message,
        timestamp: new Date().toISOString(),
      },
      503
    );
  }
});

/**
 * GET /health/redis - Redis health check
 */
health.get("/redis", async (c) => {
  try {
    const pong = await redis.ping();
    return c.json({
      status: pong === "PONG" ? "ok" : "error",
      service: "redis",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json(
      {
        status: "error",
        service: "redis",
        error: message,
        timestamp: new Date().toISOString(),
      },
      503
    );
  }
});

export { health };
