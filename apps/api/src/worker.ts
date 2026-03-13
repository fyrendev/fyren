import { db, eq, monitors } from "@fyrendev/db";
import { initializeMonitorSchedules, monitorQueue } from "./lib/queue";
import { bullmqRedis } from "./lib/redis";
import { closeWorker } from "./workers/monitor.worker";
import { initializeLogger, logger, loadConfig, loadConfigFromEnv } from "./lib/logging";

// Initialize logger for the worker process
initializeLogger(loadConfigFromEnv(), "env");

async function main() {
  logger.info("Starting Fyren workers...");

  // Wait for Redis connection
  await bullmqRedis.ping();
  logger.info("Connected to Redis");

  // Re-initialize logger with database config (if available)
  try {
    const { config, source } = await loadConfig();
    initializeLogger(config, source);
    logger.info(`Logger initialized from ${source}`, { provider: config.provider });
  } catch (err) {
    logger.warn("Failed to load logging config from database, using environment config", {
      errorName: err instanceof Error ? err.name : "Unknown",
    });
  }

  // Fetch all active monitors
  const activeMonitors = await db.select().from(monitors).where(eq(monitors.isActive, true));

  logger.info(`Found ${activeMonitors.length} active monitors`);

  // Initialize schedules for existing monitors
  await initializeMonitorSchedules(activeMonitors);
  logger.info("Monitor schedules initialized");

  // Worker is already listening (started on import)
  logger.info("Monitor worker running - Press Ctrl+C to stop");

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down workers...");

    try {
      // Close the worker
      await closeWorker();
      logger.info("Worker closed");

      // Close the queue
      await monitorQueue.close();
      logger.info("Queue closed");

      // Close Redis connection
      await bullmqRedis.quit();
      logger.info("Redis connection closed");

      await logger.flush();
      await logger.shutdown();
      process.exit(0);
    } catch (err) {
      logger.error("Error during shutdown", {
        errorName: err instanceof Error ? err.name : "Unknown",
        stack: err instanceof Error ? err.stack : undefined,
      });
      process.exit(1);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error("Failed to start workers", {
    errorName: err instanceof Error ? err.name : "Unknown",
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
