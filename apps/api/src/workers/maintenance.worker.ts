import { Worker, Job } from "bullmq";
import { bullmqRedis } from "../lib/redis";
import { MaintenanceService } from "../services/maintenance.service";

const QUEUE_NAME = "maintenance";

interface MaintenanceJobData {
  maintenanceId: string;
}

export const maintenanceWorker = new Worker<MaintenanceJobData>(
  QUEUE_NAME,
  async (job: Job<MaintenanceJobData>) => {
    console.log(`[MaintenanceWorker] Processing job: ${job.name} - ${job.id}`);

    const { maintenanceId } = job.data;

    try {
      switch (job.name) {
        case "start":
          await MaintenanceService.autoStart(maintenanceId);
          console.log(`[MaintenanceWorker] Auto-started maintenance: ${maintenanceId}`);
          break;

        case "complete":
          await MaintenanceService.autoComplete(maintenanceId);
          console.log(`[MaintenanceWorker] Auto-completed maintenance: ${maintenanceId}`);
          break;

        default:
          console.warn(`[MaintenanceWorker] Unknown job type: ${job.name}`);
      }

      return { status: "completed", maintenanceId, action: job.name };
    } catch (error) {
      console.error(`[MaintenanceWorker] Error processing job ${job.id}:`, error);
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
  console.log(`[MaintenanceWorker] Job ${job.id} completed:`, result?.status);
});

maintenanceWorker.on("failed", (job, err) => {
  console.error(`[MaintenanceWorker] Job ${job?.id} failed:`, err.message);
});

maintenanceWorker.on("error", (err) => {
  console.error("[MaintenanceWorker] Worker error:", err);
});

export async function closeMaintenanceWorker(): Promise<void> {
  await maintenanceWorker.close();
  console.log("[MaintenanceWorker] Maintenance worker closed");
}
