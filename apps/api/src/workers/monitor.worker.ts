import { Worker, Job } from "bullmq";
import { bullmqRedis } from "../lib/redis";
import { db, monitors, eq } from "@fyrendev/db";
import { executeCheck } from "../lib/checkers";
import {
  evaluateComponentStatus,
  updateComponentStatus,
  storeCheckResult,
} from "../services/monitor.service";
import type { MonitorJobData } from "../lib/queue";

export const monitorWorker = new Worker<MonitorJobData>(
  "monitor-checks",
  async (job: Job<MonitorJobData>) => {
    const { monitorId } = job.data;

    console.log(`[Worker] Processing check for monitor ${monitorId}`);

    try {
      // 1. Fetch monitor from database
      const [monitor] = await db
        .select()
        .from(monitors)
        .where(eq(monitors.id, monitorId))
        .limit(1);

      if (!monitor) {
        console.log(`[Worker] Monitor ${monitorId} not found, skipping`);
        return { status: "skipped", reason: "monitor_not_found" };
      }

      if (!monitor.isActive) {
        console.log(`[Worker] Monitor ${monitorId} is inactive, skipping`);
        return { status: "skipped", reason: "monitor_inactive" };
      }

      // 2. Execute the appropriate check
      const result = await executeCheck(monitor);
      console.log(
        `[Worker] Check completed for ${monitorId}: ${result.status} (${result.responseTimeMs}ms)`
      );

      // 3. Store result in monitor_results table and update lastCheckedAt
      await storeCheckResult(monitorId, result);

      // 4. Evaluate failure threshold
      const evaluation = await evaluateComponentStatus(monitorId, result);

      // 5. Update component status if needed
      if (evaluation.shouldUpdateComponent) {
        console.log(
          `[Worker] Updating component status for monitor ${monitorId} to ${evaluation.newStatus}`
        );
        await updateComponentStatus(monitor.componentId, evaluation.newStatus);
      }

      return {
        status: "completed",
        checkResult: result,
        evaluation,
      };
    } catch (error) {
      console.error(`[Worker] Error processing monitor ${monitorId}:`, error);
      throw error;
    }
  },
  {
    connection: bullmqRedis,
    concurrency: 10, // Run up to 10 checks in parallel
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 1000 },
  }
);

// Event handlers
monitorWorker.on("completed", (job, result) => {
  console.log(`[Worker] Job ${job.id} completed:`, result?.status);
});

monitorWorker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

monitorWorker.on("error", (err) => {
  console.error("[Worker] Worker error:", err);
});

export async function closeWorker(): Promise<void> {
  await monitorWorker.close();
  console.log("[Worker] Monitor worker closed");
}
