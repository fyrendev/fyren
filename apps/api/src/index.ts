import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { env } from "./env";
import { setupRoutes } from "./routes";
import { redis, bullmqRedis } from "./lib/redis";
import { errorResponse } from "./lib/errors";
import {
  maintenanceWorker as _maintenanceWorker,
  closeMaintenanceWorker,
} from "./workers/maintenance.worker";
import {
  notificationWorker as _notificationWorker,
  closeNotificationWorker,
} from "./workers/notification.worker";
import { rescheduleMaintenanceJobs } from "./services/maintenance-startup.service";
import { securityHeaders } from "./middleware/security";
import { runMigrations } from "@fyrendev/db";

const app = new Hono();

app.use("*", logger());

// CORS middleware for cross-origin requests
app.use(
  "*",
  cors({
    origin: env.APP_URL || "http://localhost:3000",
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Organization-Id"],
  })
);

// Security headers middleware
app.use("*", securityHeaders());

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

// Run migrations on startup (set RUN_MIGRATIONS=false to skip)
async function startServer() {
  if (process.env.RUN_MIGRATIONS !== "false") {
    try {
      // In Docker, MIGRATIONS_PATH should be set to ./drizzle
      const migrationsPath = process.env.MIGRATIONS_PATH;
      await runMigrations(migrationsPath);
    } catch (err) {
      console.error("Migration error:", err);
      // Don't exit - migrations might already be applied
    }
  }

  console.log(`Starting Fyren API on port ${env.PORT}...`);

  const server = Bun.serve({
    port: env.PORT,
    fetch: app.fetch,
  });

  console.log(`Fyren API running at http://localhost:${server.port}`);

  return server;
}

const server = await startServer();

// Start workers
console.log("Maintenance worker started");
console.log("Notification worker started");

// Reschedule any pending maintenance jobs on startup
rescheduleMaintenanceJobs().catch((err) => {
  console.error("Error rescheduling maintenance jobs:", err);
});

async function shutdown() {
  console.log("\nShutting down gracefully...");

  try {
    await closeMaintenanceWorker();
    console.log("Maintenance worker closed");
  } catch (err) {
    console.error("Error closing maintenance worker:", err);
  }

  try {
    await closeNotificationWorker();
    console.log("Notification worker closed");
  } catch (err) {
    console.error("Error closing notification worker:", err);
  }

  try {
    await redis.quit();
    await bullmqRedis.quit();
    console.log("Redis connections closed");
  } catch (err) {
    console.error("Error closing Redis:", err);
  }

  server.stop();
  console.log("Server stopped");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
