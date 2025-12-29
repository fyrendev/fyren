import { Hono } from "hono";
import { db } from "../lib/db";
import { redis } from "../lib/redis";
import { sql } from "@fyrendev/db";

const health = new Hono();

health.get("/", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

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
