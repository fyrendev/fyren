import { db, eq, and } from "@fyrendev/db";
import { subscribers, webhookEndpoints, organizations } from "@fyrendev/db";
import { Queue } from "bullmq";
import { bullmqRedis } from "../lib/redis";

const QUEUE_NAME = "notifications";

export interface NotificationJobData {
  type: "email" | "webhook";
  // Common fields
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
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
  webhookType?: "slack" | "discord" | "teams" | "generic";
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
  organizationId: string;
  event: NotificationEvent;
  entityType: "incident" | "maintenance" | "component";
  entityId: string;
  data: Record<string, unknown>;
  componentIds?: string[]; // For filtering by component
}

export const NotificationService = {
  async trigger(notification: NotificationData): Promise<void> {
    const { organizationId } = notification;

    // Get organization details
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
      columns: { id: true, name: true, slug: true },
    });

    if (!org) return;

    // Queue email notifications to subscribers
    await this.queueEmailNotifications(notification, org);

    // Queue webhook notifications
    await this.queueWebhookNotifications(notification, org);
  },

  async queueEmailNotifications(
    notification: NotificationData,
    org: { id: string; name: string; slug: string }
  ): Promise<void> {
    const { event, componentIds } = notification;

    // Determine notification type filter
    const isIncidentEvent = event.startsWith("incident.");
    const isMaintenanceEvent = event.startsWith("maintenance.");

    // Build subscriber query - we need to filter manually
    const allSubs = await db.query.subscribers.findMany({
      where: and(
        eq(subscribers.organizationId, org.id),
        eq(subscribers.verified, true)
      ),
    });

    // Filter by notification preferences
    const prefilteredSubs = allSubs.filter((sub) => {
      if (isIncidentEvent && !sub.notifyOnIncident) return false;
      if (isMaintenanceEvent && !sub.notifyOnMaintenance) return false;
      return true;
    });

    // Filter by component subscription (if subscriber has component filter)
    const eligibleSubs = prefilteredSubs.filter((sub) => {
      if (!sub.componentIds || sub.componentIds.length === 0) {
        return true; // Subscribed to all
      }
      if (!componentIds || componentIds.length === 0) {
        return true; // No component filter on event
      }
      // Check if any subscribed component is affected
      return componentIds.some((id) => sub.componentIds!.includes(id));
    });

    // Queue jobs for each subscriber
    for (const sub of eligibleSubs) {
      await notificationQueue.add("email", {
        type: "email",
        subscriberId: sub.id,
        email: sub.email,
        unsubscribeToken: sub.unsubscribeToken,
        organizationId: org.id,
        organizationName: org.name,
        organizationSlug: org.slug,
        event: notification.event,
        entityType: notification.entityType,
        entityId: notification.entityId,
        data: notification.data,
      });
    }
  },

  async queueWebhookNotifications(
    notification: NotificationData,
    org: { id: string; name: string; slug: string }
  ): Promise<void> {
    const { event, componentIds } = notification;

    // Determine notification type filter
    const isIncidentEvent = event.startsWith("incident.");
    const isMaintenanceEvent = event.startsWith("maintenance.");
    const isComponentEvent = event.startsWith("component.");

    // Get all enabled webhooks for this org
    const allWebhooks = await db.query.webhookEndpoints.findMany({
      where: and(
        eq(webhookEndpoints.organizationId, org.id),
        eq(webhookEndpoints.enabled, true)
      ),
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
        organizationId: org.id,
        organizationName: org.name,
        organizationSlug: org.slug,
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
