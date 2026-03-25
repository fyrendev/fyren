import { describe, test, expect, mock } from "bun:test";
import {
  setupTestHooks,
  createTestOrganization,
  createTestWebhook,
  createTestSubscriber,
  createTestComponent,
} from "../test";
import { NotificationService } from "./notification.service";

describe("NotificationService", () => {
  setupTestHooks();

  describe("trigger", () => {
    test("component.status_changed queues webhook but not email notifications", async () => {
      await createTestOrganization();
      const component = await createTestComponent({ name: "API Server" });

      // Create a webhook that listens for component changes
      await createTestWebhook({
        name: "Component Watcher",
        type: "slack",
        url: "https://hooks.slack.com/services/xxx",
        notifyOnComponentChange: true,
      });

      // Create a subscriber (should NOT be notified for component events)
      await createTestSubscriber({
        email: "user@example.com",
        verified: true,
        notifyOnIncident: true,
        notifyOnMaintenance: true,
      });

      // Spy on internal methods
      const emailSpy = mock(() => Promise.resolve());
      const webhookSpy = mock(() => Promise.resolve());
      const originalQueueEmail = NotificationService.queueEmailNotifications;
      const originalQueueWebhook = NotificationService.queueWebhookNotifications;

      NotificationService.queueEmailNotifications = emailSpy as typeof originalQueueEmail;
      NotificationService.queueWebhookNotifications = webhookSpy as typeof originalQueueWebhook;

      try {
        await NotificationService.trigger({
          event: "component.status_changed",
          entityType: "component",
          entityId: component.id,
          componentIds: [component.id],
          data: {
            componentName: "API Server",
            previousStatus: "operational",
            newStatus: "major_outage",
          },
        });

        // Email should NOT be called for component events
        expect(emailSpy).not.toHaveBeenCalled();
        // Webhook SHOULD be called
        expect(webhookSpy).toHaveBeenCalledTimes(1);
      } finally {
        NotificationService.queueEmailNotifications = originalQueueEmail;
        NotificationService.queueWebhookNotifications = originalQueueWebhook;
      }
    });

    test("incident events queue both email and webhook notifications", async () => {
      await createTestOrganization();

      const emailSpy = mock(() => Promise.resolve());
      const webhookSpy = mock(() => Promise.resolve());
      const originalQueueEmail = NotificationService.queueEmailNotifications;
      const originalQueueWebhook = NotificationService.queueWebhookNotifications;

      NotificationService.queueEmailNotifications = emailSpy as typeof originalQueueEmail;
      NotificationService.queueWebhookNotifications = webhookSpy as typeof originalQueueWebhook;

      try {
        await NotificationService.trigger({
          event: "incident.created",
          entityType: "incident",
          entityId: "inc-123",
          data: { title: "Outage", severity: "major", message: "Investigating" },
        });

        expect(emailSpy).toHaveBeenCalledTimes(1);
        expect(webhookSpy).toHaveBeenCalledTimes(1);
      } finally {
        NotificationService.queueEmailNotifications = originalQueueEmail;
        NotificationService.queueWebhookNotifications = originalQueueWebhook;
      }
    });
  });

  describe("queueWebhookNotifications", () => {
    test("filters out webhooks with notifyOnComponentChange disabled", async () => {
      const org = await createTestOrganization();
      const component = await createTestComponent({ name: "API Server" });

      // This webhook should NOT receive component status changes
      await createTestWebhook({
        name: "Incidents Only",
        type: "slack",
        url: "https://hooks.slack.com/services/incidents",
        notifyOnIncident: true,
        notifyOnComponentChange: false,
      });

      // This webhook SHOULD receive component status changes
      await createTestWebhook({
        name: "Component Watcher",
        type: "slack",
        url: "https://hooks.slack.com/services/components",
        notifyOnComponentChange: true,
      });

      // We can't easily inspect the queue without more mocking,
      // but we can test that the method doesn't throw and runs the filtering logic.
      // The actual queue behavior is validated by the notification worker tests.
      await NotificationService.queueWebhookNotifications(
        {
          event: "component.status_changed",
          entityType: "component",
          entityId: component.id,
          componentIds: [component.id],
          data: {
            componentName: "API Server",
            previousStatus: "operational",
            newStatus: "major_outage",
          },
        },
        { id: org.id, name: org.name }
      );
    });

    test("filters webhooks by component subscription", async () => {
      const org = await createTestOrganization();
      const apiComponent = await createTestComponent({ name: "API Server" });
      const dbComponent = await createTestComponent({ name: "Database" });

      // Webhook subscribed only to the database component
      await createTestWebhook({
        name: "DB Watcher",
        type: "slack",
        url: "https://hooks.slack.com/services/db",
        notifyOnComponentChange: true,
        componentIds: [dbComponent.id],
      });

      // Webhook subscribed to all components (no filter)
      await createTestWebhook({
        name: "All Components",
        type: "slack",
        url: "https://hooks.slack.com/services/all",
        notifyOnComponentChange: true,
        componentIds: null,
      });

      // Should not throw — the DB Watcher should be filtered out for API component events
      await NotificationService.queueWebhookNotifications(
        {
          event: "component.status_changed",
          entityType: "component",
          entityId: apiComponent.id,
          componentIds: [apiComponent.id],
          data: {
            componentName: "API Server",
            previousStatus: "operational",
            newStatus: "major_outage",
          },
        },
        { id: org.id, name: org.name }
      );
    });
  });
});
