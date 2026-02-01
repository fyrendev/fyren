import { Worker, Job } from "bullmq";
import { bullmqRedis } from "../lib/redis";
import { MaintenanceService } from "../services/maintenance.service";
import { logger } from "../lib/logging";

const QUEUE_NAME = "maintenance";

interface MaintenanceJobData {
  maintenanceId: string;
}

export const maintenanceWorker = new Worker<MaintenanceJobData>(
  QUEUE_NAME,
  async (job: Job<MaintenanceJobData>) => {
    logger.worker("MaintenanceWorker", `Processing job: ${job.name}`, {
      jobId: job.id,
      jobName: job.name,
      maintenanceId: job.data.maintenanceId,
    });

    const { maintenanceId } = job.data;

    try {
      switch (job.name) {
        case "start":
          await MaintenanceService.autoStart(maintenanceId);
          logger.worker("MaintenanceWorker", `Auto-started maintenance: ${maintenanceId}`, {
            jobId: job.id,
            maintenanceId,
          });
          break;

        case "complete":
          await MaintenanceService.autoComplete(maintenanceId);
          logger.worker("MaintenanceWorker", `Auto-completed maintenance: ${maintenanceId}`, {
            jobId: job.id,
            maintenanceId,
          });
          break;

        default:
          logger.warn(`Unknown job type: ${job.name}`, {
            workerName: "MaintenanceWorker",
            jobId: job.id,
            jobName: job.name,
          });
      }

      return { status: "completed", maintenanceId, action: job.name };
    } catch (error) {
      logger.workerError("MaintenanceWorker", `Error processing job ${job.id}`, error as Error, {
        jobId: job.id,
        maintenanceId,
      });
      throw error;
    }
  },
  {
    connection: bullmqRedis,
    concurrency: 5,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 1000 },
  }
);

// Event handlers
maintenanceWorker.on("completed", (job, result) => {
  logger.worker("MaintenanceWorker", `Job completed: ${result?.status}`, {
    jobId: job.id,
  });
});

maintenanceWorker.on("failed", (job, err) => {
  logger.workerError("MaintenanceWorker", `Job ${job?.id} failed`, err, {
    jobId: job?.id,
  });
});

maintenanceWorker.on("error", (err) => {
  logger.workerError("MaintenanceWorker", "Worker error", err);
});

export async function closeMaintenanceWorker(): Promise<void> {
  await maintenanceWorker.close();
  logger.worker("MaintenanceWorker", "Maintenance worker closed");
}
