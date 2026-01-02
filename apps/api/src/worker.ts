import { db, eq, monitors } from "@fyrendev/db";
import { initializeMonitorSchedules, monitorQueue } from "./lib/queue";
import { bullmqRedis } from "./lib/redis";
import { closeWorker } from "./workers/monitor.worker";

async function main() {
  console.log("🔧 Starting Fyren workers...");

  // Wait for Redis connection
  await bullmqRedis.ping();
  console.log("✅ Connected to Redis");

  // Fetch all active monitors
  const activeMonitors = await db.select().from(monitors).where(eq(monitors.isActive, true));

  console.log(`📊 Found ${activeMonitors.length} active monitors`);

  // Initialize schedules for existing monitors
  await initializeMonitorSchedules(activeMonitors);
  console.log("📅 Monitor schedules initialized");

  // Worker is already listening (started on import)
  console.log("👷 Monitor worker running");
  console.log("");
  console.log("Press Ctrl+C to stop");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n🛑 Shutting down workers...");

    try {
      // Close the worker
      await closeWorker();
      console.log("✅ Worker closed");

      // Close the queue
      await monitorQueue.close();
      console.log("✅ Queue closed");

      // Close Redis connection
      await bullmqRedis.quit();
      console.log("✅ Redis connection closed");

      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Failed to start workers:", err);
  process.exit(1);
});
