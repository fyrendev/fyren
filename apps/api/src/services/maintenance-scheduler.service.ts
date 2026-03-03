import { Queue } from "bullmq";
import { bullmqRedis } from "../lib/redis";

const QUEUE_NAME = "maintenance";

const maintenanceQueue = new Queue(QUEUE_NAME, {
  connection: bullmqRedis,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

export const MaintenanceScheduler = {
  async scheduleStart(maintenanceId: string, startAt: Date) {
    const delay = startAt.getTime() - Date.now();

    if (delay <= 0) {
      // Already past start time, start immediately
      await maintenanceQueue.add("start", { maintenanceId }, { jobId: `start_${maintenanceId}` });
    } else {
      await maintenanceQueue.add(
        "start",
        { maintenanceId },
        {
          jobId: `start_${maintenanceId}`,
          delay,
        }
      );
    }
  },

  async scheduleComplete(maintenanceId: string, endAt: Date) {
    const delay = endAt.getTime() - Date.now();

    if (delay <= 0) {
      // Already past end time, complete immediately
      await maintenanceQueue.add(
        "complete",
        { maintenanceId },
        { jobId: `complete_${maintenanceId}` }
      );
    } else {
      await maintenanceQueue.add(
        "complete",
        { maintenanceId },
        {
          jobId: `complete_${maintenanceId}`,
          delay,
        }
      );
    }
  },

  async cancelStart(maintenanceId: string) {
    const job = await maintenanceQueue.getJob(`start_${maintenanceId}`);
    if (job) {
      await job.remove();
    }
  },

  async cancelComplete(maintenanceId: string) {
    const job = await maintenanceQueue.getJob(`complete_${maintenanceId}`);
    if (job) {
      await job.remove();
    }
  },

  getQueue() {
    return maintenanceQueue;
  },
};
