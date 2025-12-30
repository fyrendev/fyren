import { Queue } from "bullmq";
import { bullmqRedis } from "./redis";
import type { Monitor } from "@fyrendev/db";

export interface MonitorJobData {
  monitorId: string;
}

// Main queue for monitor checks
export const monitorQueue = new Queue<MonitorJobData>("monitor-checks", {
  connection: bullmqRedis,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed
    removeOnFail: 1000, // Keep last 1000 failed
    attempts: 1, // Don't retry failed checks, just record the failure
  },
});

// Schedule a monitor for repeating checks
export async function scheduleMonitor(monitor: Monitor): Promise<void> {
  // Remove any existing job for this monitor
  await unscheduleMonitor(monitor.id);

  // Add repeatable job
  await monitorQueue.add(
    "check",
    { monitorId: monitor.id },
    {
      repeat: {
        every: monitor.intervalSeconds * 1000,
      },
      jobId: monitor.id, // Use monitor ID as job ID for easy management
    }
  );

  console.log(
    `Scheduled monitor ${monitor.id} to run every ${monitor.intervalSeconds}s`
  );
}

// Remove a scheduled monitor
export async function unscheduleMonitor(monitorId: string): Promise<void> {
  // Get all repeatable jobs and remove the one matching our monitor
  const repeatableJobs = await monitorQueue.getRepeatableJobs();

  for (const job of repeatableJobs) {
    if (job.id === monitorId || job.key.includes(monitorId)) {
      await monitorQueue.removeRepeatableByKey(job.key);
      console.log(`Unscheduled monitor ${monitorId}`);
    }
  }
}

// Update schedule (remove + add)
export async function rescheduleMonitor(monitor: Monitor): Promise<void> {
  await unscheduleMonitor(monitor.id);
  if (monitor.isActive) {
    await scheduleMonitor(monitor);
  }
}

// Trigger an immediate check for a monitor
export async function triggerImmediateCheck(
  monitorId: string
): Promise<string> {
  const job = await monitorQueue.add(
    "check",
    { monitorId },
    {
      jobId: `immediate-${monitorId}-${Date.now()}`,
    }
  );

  return job.id!;
}

// Initialize schedules for all active monitors
export async function initializeMonitorSchedules(
  monitors: Monitor[]
): Promise<void> {
  console.log(`Initializing schedules for ${monitors.length} active monitors...`);

  for (const monitor of monitors) {
    await scheduleMonitor(monitor);
  }

  console.log("Monitor schedules initialized");
}

// Clean up all scheduled jobs (for shutdown or reset)
export async function cleanupAllSchedules(): Promise<void> {
  const repeatableJobs = await monitorQueue.getRepeatableJobs();

  for (const job of repeatableJobs) {
    await monitorQueue.removeRepeatableByKey(job.key);
  }

  console.log("All monitor schedules cleaned up");
}
