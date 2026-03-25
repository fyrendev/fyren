import { db, eq } from "@fyrendev/db";
import { webhookEndpoints } from "@fyrendev/db";
import type { WebhookType } from "@fyrendev/shared";
import { Queue } from "bullmq";
import { bullmqRedis } from "../lib/redis";
import { SubscriberService } from "./subscriber.service";
import { getOrganization } from "../lib/organization";

const QUEUE_NAME = "notifications";

export interface NotificationJobData {
  type: "email" | "webhook";
  // Common fields
  organizationName: string;
  event: NotificationEvent;
  entityType: "incident" | "maintenance" | "component";
  entityId: string;
  data: Record<string, unknown>;
  // Email specific
  subscriberId?: string;
  email?: string;
  unsubscribeToken?: string;
  // Webhook specific
  webhookId?: string;
  webhookType?: WebhookType;
  webhookUrl?: string;
  webhookSecret?: string;
}

const notificationQueue = new Queue<NotificationJobData>(QUEUE_NAME, {
  connection: bullmqRedis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  },
});

export type NotificationEvent =
  | "incident.created"
  | "incident.updated"
  | "incident.resolved"
  | "maintenance.scheduled"
  | "maintenance.started"
  | "maintenance.completed"
  | "component.status_changed";

interface NotificationData {
  event: NotificationEvent;
  entityType: "incident" | "maintenance" | "component";
  entityId: string;
  data: Record<string, unknown>;
  componentIds?: string[]; // For filtering by component
}

export const NotificationService = {
  async trigger(notification: NotificationData): Promise<void> {
    // Get organization details
    let org;
    try {
      org = await getOrganization();
    } catch {
      return; // No org configured
    }

    // Queue email notifications to subscribers (skip for component status changes — webhooks only)
    if (!notification.event.startsWith("component.")) {
      await this.queueEmailNotifications(notification, org);
    }

    // Queue webhook notifications
    await this.queueWebhookNotifications(notification, org);
  },

  async queueEmailNotifications(
    notification: NotificationData,
    org: { id: string; name: string }
  ): Promise<void> {
    const { event, componentIds } = notification;

    // Determine notification type
    const isIncidentEvent = event.startsWith("incident.");
    const isMaintenanceEvent = event.startsWith("maintenance.");
    const eventType = isIncidentEvent
      ? "incident"
      : isMaintenanceEvent
        ? "maintenance"
        : "component";

    // Global events have no component filter - they should always notify
    const isGlobalEvent = !componentIds || componentIds.length === 0;

    // Use SubscriberService to get eligible subscribers
    const eligibleSubs = await SubscriberService.getEligibleSubscribers({
      eventType,
      componentIds,
      isGlobalEvent,
    });

    // Queue jobs for each subscriber
    for (const sub of eligibleSubs) {
      await notificationQueue.add("email", {
        type: "email",
        subscriberId: sub.id,
        email: sub.email,
        unsubscribeToken: sub.unsubscribeToken,
        organizationName: org.name,
        event: notification.event,
        entityType: notification.entityType,
        entityId: notification.entityId,
        data: notification.data,
      });
    }
  },

  async queueWebhookNotifications(
    notification: NotificationData,
    org: { id: string; name: string }
  ): Promise<void> {
    const { event, componentIds } = notification;

    // Determine notification type filter
    const isIncidentEvent = event.startsWith("incident.");
    const isMaintenanceEvent = event.startsWith("maintenance.");
    const isComponentEvent = event.startsWith("component.");

    // Get all enabled webhooks
    const allWebhooks = await db.query.webhookEndpoints.findMany({
      where: eq(webhookEndpoints.enabled, true),
    });

    // Filter by notification preferences
    const prefilteredWebhooks = allWebhooks.filter((wh) => {
      if (isIncidentEvent && !wh.notifyOnIncident) return false;
      if (isMaintenanceEvent && !wh.notifyOnMaintenance) return false;
      if (isComponentEvent && !wh.notifyOnComponentChange) return false;
      return true;
    });

    // Filter by component subscription
    const eligibleWebhooks = prefilteredWebhooks.filter((wh) => {
      if (!wh.componentIds || wh.componentIds.length === 0) {
        return true;
      }
      if (!componentIds || componentIds.length === 0) {
        return true;
      }
      return componentIds.some((id) => wh.componentIds!.includes(id));
    });

    // Queue jobs for each webhook
    for (const webhook of eligibleWebhooks) {
      await notificationQueue.add("webhook", {
        type: "webhook",
        webhookId: webhook.id,
        webhookType: webhook.type,
        webhookUrl: webhook.url,
        webhookSecret: webhook.secret || undefined,
        organizationName: org.name,
        event: notification.event,
        entityType: notification.entityType,
        entityId: notification.entityId,
        data: notification.data,
      });
    }
  },

  getQueue() {
    return notificationQueue;
  },
};
