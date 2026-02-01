import { Hono } from "hono";
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
import { initializeLogger, logger } from "./lib/logging";
import { loggingMiddleware } from "./middleware/logging";

// Initialize logger before anything else
initializeLogger({
  provider: env.LOG_PROVIDER,
  level: env.LOG_LEVEL,
  serviceName: env.LOG_SERVICE_NAME,
  lokiUrl: env.LOKI_URL,
  lokiUsername: env.LOKI_USERNAME,
  lokiPassword: env.LOKI_PASSWORD,
  lokiTenantId: env.LOKI_TENANT_ID,
  otlpEndpoint: env.OTLP_ENDPOINT,
  otlpHeaders: env.OTLP_HEADERS ? JSON.parse(env.OTLP_HEADERS) : undefined,
});

const app = new Hono();

// Request logging middleware
app.use("*", loggingMiddleware());

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
  const requestId = c.get("requestId");
  logger.error("Unhandled error", {
    requestId,
    errorName: err.name,
    errorCode: "code" in err ? (err as Error & { code?: string }).code : undefined,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  });
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
      logger.error("Migration error", {
        errorName: err instanceof Error ? err.name : "Unknown",
        stack: err instanceof Error ? err.stack : undefined,
      });
      // Don't exit - migrations might already be applied
    }
  }

  logger.info(`Starting Fyren API on port ${env.PORT}`);

  const server = Bun.serve({
    port: env.PORT,
    fetch: app.fetch,
  });

  logger.info(`Fyren API running at http://localhost:${server.port}`);

  return server;
}

const server = await startServer();

// Start workers
logger.info("Maintenance worker started");
logger.info("Notification worker started");

// Reschedule any pending maintenance jobs on startup
rescheduleMaintenanceJobs().catch((err) => {
  logger.error("Error rescheduling maintenance jobs", {
    errorName: err instanceof Error ? err.name : "Unknown",
    stack: err instanceof Error ? err.stack : undefined,
  });
});

async function shutdown() {
  logger.info("Shutting down gracefully...");

  try {
    await closeMaintenanceWorker();
    logger.info("Maintenance worker closed");
  } catch (err) {
    logger.error("Error closing maintenance worker", {
      errorName: err instanceof Error ? err.name : "Unknown",
      stack: err instanceof Error ? err.stack : undefined,
    });
  }

  try {
    await closeNotificationWorker();
    logger.info("Notification worker closed");
  } catch (err) {
    logger.error("Error closing notification worker", {
      errorName: err instanceof Error ? err.name : "Unknown",
      stack: err instanceof Error ? err.stack : undefined,
    });
  }

  try {
    await redis.quit();
    await bullmqRedis.quit();
    logger.info("Redis connections closed");
  } catch (err) {
    logger.error("Error closing Redis", {
      errorName: err instanceof Error ? err.name : "Unknown",
      stack: err instanceof Error ? err.stack : undefined,
    });
  }

  // Flush logs before exiting
  try {
    await logger.flush();
    await logger.shutdown();
  } catch (err) {
    console.error("Error flushing logs:", err);
  }

  server.stop();
  logger.info("Server stopped");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
