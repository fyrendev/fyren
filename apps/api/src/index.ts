import { Hono } from "hono";
import { logger } from "hono/logger";
import { env } from "./env";
import { setupRoutes } from "./routes";
import { redis } from "./lib/redis";
import { errorResponse } from "./lib/errors";

const app = new Hono();

app.use("*", logger());

// Root endpoint
app.get("/", (c) => {
  return c.json({
    name: "Fyren API",
    version: "0.0.1",
    docs: "/health",
  });
});

// Setup all routes
setupRoutes(app);

// 404 handler
app.notFound((c) => {
  return c.json({ error: { message: "Not Found", code: "NOT_FOUND" } }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return errorResponse(c, err);
});

console.log(`Starting Fyren API on port ${env.PORT}...`);

const server = Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
});

console.log(`Fyren API running at http://localhost:${server.port}`);

async function shutdown() {
  console.log("\nShutting down gracefully...");

  try {
    await redis.quit();
    console.log("Redis connection closed");
  } catch (err) {
    console.error("Error closing Redis:", err);
  }

  server.stop();
  console.log("Server stopped");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
