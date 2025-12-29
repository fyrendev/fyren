import { Hono } from "hono";
import { logger } from "hono/logger";
import { env } from "./env";
import { health } from "./routes/health";
import { redis } from "./lib/redis";

const app = new Hono();

app.use("*", logger());

app.route("/health", health);

app.get("/", (c) => {
  return c.json({
    name: "Fyren API",
    version: "0.0.1",
    docs: "/health",
  });
});

app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
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
