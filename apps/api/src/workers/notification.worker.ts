import { Worker, Job } from "bullmq";
import { bullmqRedis } from "../lib/redis";
import { db, eq, sql } from "@fyrendev/db";
import { notificationLogs, webhookEndpoints } from "@fyrendev/db";
import { getEmailProvider } from "../lib/email";
import { formatWebhook } from "../lib/webhooks";
import {
  incidentCreatedTemplate,
  incidentUpdatedTemplate,
  incidentResolvedTemplate,
} from "../lib/email/templates/incident";
import {
  maintenanceScheduledTemplate,
  maintenanceStartedTemplate,
  maintenanceCompletedTemplate,
} from "../lib/email/templates/maintenance";
import { env } from "../env";
import type { NotificationJobData } from "../services/notification.service";
import { logger } from "../lib/logging";

const QUEUE_NAME = "notifications";

export const notificationWorker = new Worker<NotificationJobData>(
  QUEUE_NAME,
  async (job: Job<NotificationJobData>) => {
    logger.worker("NotificationWorker", `Processing job: ${job.name}`, {
      jobId: job.id,
      jobName: job.name,
      type: job.data.type,
    });

    try {
      if (job.data.type === "email") {
        await processEmailJob(job);
      } else if (job.data.type === "webhook") {
        await processWebhookJob(job);
      }

      return { status: "completed", type: job.data.type };
    } catch (error) {
      logger.workerError("NotificationWorker", `Error processing job ${job.id}`, error as Error, {
        jobId: job.id,
        type: job.data.type,
      });
      throw error;
    }
  },
  {
    connection: bullmqRedis,
    concurrency: 10,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  }
);

async function processEmailJob(job: Job<NotificationJobData>): Promise<void> {
  const {
    email,
    unsubscribeToken,
    organizationName,
    organizationSlug,
    event,
    entityType,
    entityId,
    data,
  } = job.data;

  if (!email || !unsubscribeToken) {
    throw new Error("Missing email or unsubscribe token");
  }

  const statusPageUrl = `${env.APP_URL}/${organizationSlug}`;
  const unsubscribeUrl = `${env.APP_URL}/api/v1/status/unsubscribe/${unsubscribeToken}`;
  const incidentUrl = `${env.APP_URL}/${organizationSlug}/incidents/${entityId}`;

  let emailContent: { subject: string; html: string; text: string };

  // Generate email content based on event type
  switch (event) {
    case "incident.created":
      emailContent = incidentCreatedTemplate({
        organizationName,
        statusPageUrl,
        incidentTitle: data.title as string,
        incidentStatus: data.status as string,
        incidentSeverity: data.severity as string,
        message: data.message as string,
        affectedComponents: (data.affectedComponents as string[]) || [],
        incidentUrl,
        unsubscribeUrl,
      });
      break;
    case "incident.updated":
      emailContent = incidentUpdatedTemplate({
        organizationName,
        statusPageUrl,
        incidentTitle: data.title as string,
        incidentStatus: data.status as string,
        incidentSeverity: data.severity as string,
        message: data.message as string,
        affectedComponents: (data.affectedComponents as string[]) || [],
        incidentUrl,
        unsubscribeUrl,
      });
      break;
    case "incident.resolved":
      emailContent = incidentResolvedTemplate({
        organizationName,
        statusPageUrl,
        incidentTitle: data.title as string,
        incidentStatus: "resolved",
        incidentSeverity: data.severity as string,
        message: data.message as string,
        affectedComponents: (data.affectedComponents as string[]) || [],
        incidentUrl,
        unsubscribeUrl,
      });
      break;
    case "maintenance.scheduled":
      emailContent = maintenanceScheduledTemplate({
        organizationName,
        statusPageUrl,
        maintenanceTitle: data.title as string,
        maintenanceDescription: data.description as string | undefined,
        maintenanceStatus: "scheduled",
        scheduledStartAt: new Date(data.scheduledStartAt as string),
        scheduledEndAt: new Date(data.scheduledEndAt as string),
        affectedComponents: (data.affectedComponents as string[]) || [],
        unsubscribeUrl,
      });
      break;
    case "maintenance.started":
      emailContent = maintenanceStartedTemplate({
        organizationName,
        statusPageUrl,
        maintenanceTitle: data.title as string,
        maintenanceDescription: data.description as string | undefined,
        maintenanceStatus: "in_progress",
        scheduledStartAt: new Date(data.scheduledStartAt as string),
        scheduledEndAt: new Date(data.scheduledEndAt as string),
        affectedComponents: (data.affectedComponents as string[]) || [],
        unsubscribeUrl,
      });
      break;
    case "maintenance.completed":
      emailContent = maintenanceCompletedTemplate({
        organizationName,
        statusPageUrl,
        maintenanceTitle: data.title as string,
        maintenanceDescription: data.description as string | undefined,
        maintenanceStatus: "completed",
        scheduledStartAt: new Date(data.scheduledStartAt as string),
        scheduledEndAt: new Date(data.scheduledEndAt as string),
        affectedComponents: (data.affectedComponents as string[]) || [],
        unsubscribeUrl,
      });
      break;
    default:
      throw new Error(`Unknown event type: ${event}`);
  }

  // Send email using configured provider
  const provider = await getEmailProvider();
  const result = await provider.send({
    to: email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });

  // Log notification
  await db.insert(notificationLogs).values({
    type: "email",
    status: result.success ? "sent" : "failed",
    event,
    entityType,
    entityId,
    recipient: email,
    payload: { subject: emailContent.subject },
    error: result.error || null,
    sentAt: result.success ? new Date() : null,
  });

  if (!result.success) {
    throw new Error(result.error);
  }
}

async function processWebhookJob(job: Job<NotificationJobData>): Promise<void> {
  const {
    webhookId,
    webhookType,
    webhookUrl,
    webhookSecret,
    organizationName,
    organizationSlug,
    event,
    entityType,
    entityId,
    data,
  } = job.data;

  if (!webhookId || !webhookType || !webhookUrl) {
    throw new Error("Missing webhook details");
  }

  // Format webhook payload
  const formatted = formatWebhook(
    webhookType,
    {
      event,
      timestamp: new Date().toISOString(),
      organization: { name: organizationName, slug: organizationSlug },
      data,
    },
    webhookSecret
  );

  // Send webhook
  let success = false;
  let error: string | undefined;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...formatted.headers,
      },
      body: JSON.stringify(formatted.body),
    });

    if (!response.ok) {
      error = `HTTP ${response.status}: ${await response.text()}`;
    } else {
      success = true;
    }
  } catch (err) {
    error = (err as Error).message;
  }

  // Update webhook endpoint status
  if (success) {
    await db
      .update(webhookEndpoints)
      .set({
        lastTriggeredAt: new Date(),
        lastError: null,
        consecutiveFailures: 0,
        updatedAt: new Date(),
      })
      .where(eq(webhookEndpoints.id, webhookId));
  } else {
    await db
      .update(webhookEndpoints)
      .set({
        lastTriggeredAt: new Date(),
        lastError: error || null,
        consecutiveFailures: sql`${webhookEndpoints.consecutiveFailures} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(webhookEndpoints.id, webhookId));
  }

  // Log notification
  await db.insert(notificationLogs).values({
    type: "webhook",
    status: success ? "sent" : "failed",
    event,
    entityType,
    entityId,
    recipient: webhookUrl,
    payload: formatted.body,
    error: error || null,
    sentAt: success ? new Date() : null,
  });

  if (!success) {
    throw new Error(error);
  }
}

// Event handlers
notificationWorker.on("completed", (job) => {
  logger.worker("NotificationWorker", "Job completed", {
    jobId: job.id,
  });
});

notificationWorker.on("failed", (job, err) => {
  logger.workerError("NotificationWorker", `Job ${job?.id} failed`, err, {
    jobId: job?.id,
  });
});

notificationWorker.on("error", (err) => {
  logger.workerError("NotificationWorker", "Worker error", err);
});

export async function closeNotificationWorker(): Promise<void> {
  await notificationWorker.close();
  logger.worker("NotificationWorker", "Notification worker closed");
}
