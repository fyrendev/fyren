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
import { logger } from "../lib/logging";

export const monitorWorker = new Worker<MonitorJobData>(
  "monitor-checks",
  async (job: Job<MonitorJobData>) => {
    const { monitorId } = job.data;

    logger.worker("MonitorWorker", `Processing check for monitor ${monitorId}`, {
      jobId: job.id,
      monitorId,
    });

    try {
      // 1. Fetch monitor from database
      const [monitor] = await db.select().from(monitors).where(eq(monitors.id, monitorId)).limit(1);

      if (!monitor) {
        logger.worker("MonitorWorker", `Monitor ${monitorId} not found, skipping`, {
          jobId: job.id,
          monitorId,
        });
        return { status: "skipped", reason: "monitor_not_found" };
      }

      if (!monitor.isActive) {
        logger.worker("MonitorWorker", `Monitor ${monitorId} is inactive, skipping`, {
          jobId: job.id,
          monitorId,
        });
        return { status: "skipped", reason: "monitor_inactive" };
      }

      // 2. Execute the appropriate check
      const result = await executeCheck(monitor);
      logger.worker(
        "MonitorWorker",
        `Check completed for ${monitorId}: ${result.status} (${result.responseTimeMs}ms)`,
        {
          jobId: job.id,
          monitorId,
          checkStatus: result.status,
          responseTimeMs: result.responseTimeMs,
        }
      );

      // 3. Store result in monitor_results table and update lastCheckedAt
      await storeCheckResult(monitorId, result);

      // 4. Evaluate failure threshold
      const evaluation = await evaluateComponentStatus(monitorId, result);

      // 5. Update component status if needed
      if (evaluation.shouldUpdateComponent) {
        logger.worker(
          "MonitorWorker",
          `Updating component status for monitor ${monitorId} to ${evaluation.newStatus}`,
          {
            jobId: job.id,
            monitorId,
            componentId: monitor.componentId,
            newStatus: evaluation.newStatus,
          }
        );
        await updateComponentStatus(monitor.componentId, evaluation.newStatus);
      }

      return {
        status: "completed",
        checkResult: result,
        evaluation,
      };
    } catch (error) {
      logger.workerError("MonitorWorker", `Error processing monitor ${monitorId}`, error as Error, {
        jobId: job.id,
        monitorId,
      });
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
  logger.worker("MonitorWorker", `Job completed: ${result?.status}`, {
    jobId: job.id,
  });
});

monitorWorker.on("failed", (job, err) => {
  logger.workerError("MonitorWorker", `Job ${job?.id} failed`, err, {
    jobId: job?.id,
  });
});

monitorWorker.on("error", (err) => {
  logger.workerError("MonitorWorker", "Worker error", err);
});

export async function closeWorker(): Promise<void> {
  await monitorWorker.close();
  logger.worker("MonitorWorker", "Monitor worker closed");
}
