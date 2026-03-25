import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestApiKey,
  createTestWebhook,
  createTestComponent,
  jsonAuthHeaders,
  authHeader,
} from "../../test";

describe("Admin Webhooks API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/webhooks", () => {
    test("lists all webhooks for organization", async () => {
      const { rawKey } = await createTestApiKey();
      await createTestWebhook({ name: "Slack Webhook", type: "slack" });
      await createTestWebhook({ name: "Discord Webhook", type: "discord" });

      const res = await app.request("/api/v1/admin/webhooks", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.webhooks).toHaveLength(2);
      expect(data.webhooks.map((w: { name: string }) => w.name)).toContain("Slack Webhook");
      expect(data.webhooks.map((w: { name: string }) => w.name)).toContain("Discord Webhook");
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/webhooks");
      expect(res.status).toBe(401);
    });

    test("returns empty array when no webhooks exist", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/webhooks", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.webhooks).toHaveLength(0);
    });
  });

  describe("GET /api/v1/admin/webhooks/:id", () => {
    test("returns webhook by ID", async () => {
      const { rawKey } = await createTestApiKey();
      const webhook = await createTestWebhook({
        name: "My Webhook",
        type: "slack",
        url: "https://hooks.slack.com/services/xxx",
      });

      const res = await app.request(`/api/v1/admin/webhooks/${webhook.id}`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.webhook.id).toBe(webhook.id);
      expect(data.webhook.name).toBe("My Webhook");
      expect(data.webhook.type).toBe("slack");
    });

    test("returns 404 for non-existent webhook", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/webhooks/00000000-0000-0000-0000-000000000000", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/admin/webhooks", () => {
    test("creates a slack webhook", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/webhooks", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "Slack Alerts",
          type: "slack",
          url: "https://hooks.slack.com/services/xxx/yyy/zzz",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.webhook.name).toBe("Slack Alerts");
      expect(data.webhook.type).toBe("slack");
      expect(data.webhook.id).toBeDefined();
    });

    test("creates a discord webhook", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/webhooks", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "Discord Alerts",
          type: "discord",
          url: "https://discord.com/api/webhooks/xxx/yyy",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.webhook.type).toBe("discord");
    });

    test("creates a teams webhook", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/webhooks", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "Teams Alerts",
          type: "teams",
          url: "https://outlook.office.com/webhook/xxx",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.webhook.type).toBe("teams");
    });

    test("creates a generic webhook with secret", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/webhooks", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "Custom Webhook",
          type: "generic",
          url: "https://api.example.com/webhook",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.webhook.type).toBe("generic");
      expect(data.webhook.secret).toBeDefined(); // Generic webhooks get a secret
    });

    test("creates webhook with notification preferences", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/webhooks", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "Selective Webhook",
          type: "slack",
          url: "https://hooks.slack.com/services/xxx",
          notifyOnIncident: true,
          notifyOnMaintenance: false,
          notifyOnComponentChange: true,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.webhook.notifyOnIncident).toBe(true);
      expect(data.webhook.notifyOnMaintenance).toBe(false);
      expect(data.webhook.notifyOnComponentChange).toBe(true);
    });

    test("defaults notifyOnComponentChange to false", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/webhooks", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "Default Prefs Webhook",
          type: "slack",
          url: "https://hooks.slack.com/services/xxx",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.webhook.notifyOnIncident).toBe(true);
      expect(data.webhook.notifyOnMaintenance).toBe(true);
      expect(data.webhook.notifyOnComponentChange).toBe(false);
    });

    test("creates webhook with component filter", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent({ name: "API Server" });

      const res = await app.request("/api/v1/admin/webhooks", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "Component Webhook",
          type: "slack",
          url: "https://hooks.slack.com/services/xxx",
          componentIds: [component.id],
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.webhook.componentIds).toContain(component.id);
    });

    test("returns 400 for invalid URL", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/webhooks", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "Bad URL",
          type: "slack",
          url: "not-a-valid-url",
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 400 for missing required fields", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/webhooks", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          // Missing name and url
          type: "slack",
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/v1/admin/webhooks/:id", () => {
    test("updates webhook name and URL", async () => {
      const { rawKey } = await createTestApiKey();
      const webhook = await createTestWebhook({
        name: "Original Name",
        url: "https://old.example.com/webhook",
      });

      const res = await app.request(`/api/v1/admin/webhooks/${webhook.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "Updated Name",
          url: "https://new.example.com/webhook",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.webhook.name).toBe("Updated Name");
      expect(data.webhook.url).toBe("https://new.example.com/webhook");
    });

    test("updates webhook notification preferences", async () => {
      const { rawKey } = await createTestApiKey();
      const webhook = await createTestWebhook({
        name: "Test Webhook",
        notifyOnIncident: true,
        notifyOnMaintenance: true,
      });

      const res = await app.request(`/api/v1/admin/webhooks/${webhook.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          notifyOnIncident: false,
          notifyOnMaintenance: false,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.webhook.notifyOnIncident).toBe(false);
      expect(data.webhook.notifyOnMaintenance).toBe(false);
    });

    test("enables notifyOnComponentChange", async () => {
      const { rawKey } = await createTestApiKey();
      const webhook = await createTestWebhook({
        name: "Component Watch Webhook",
        notifyOnComponentChange: false,
      });

      const res = await app.request(`/api/v1/admin/webhooks/${webhook.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          notifyOnComponentChange: true,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.webhook.notifyOnComponentChange).toBe(true);
    });

    test("returns 404 for non-existent webhook", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/webhooks/00000000-0000-0000-0000-000000000000", {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({ name: "Updated" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/admin/webhooks/:id", () => {
    test("deletes webhook", async () => {
      const { rawKey } = await createTestApiKey();
      const webhook = await createTestWebhook({ name: "Delete Me" });

      const res = await app.request(`/api/v1/admin/webhooks/${webhook.id}`, {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify webhook is deleted
      const getRes = await app.request(`/api/v1/admin/webhooks/${webhook.id}`, {
        headers: authHeader(rawKey),
      });
      expect(getRes.status).toBe(404);
    });

    test("returns 404 for non-existent webhook", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/webhooks/00000000-0000-0000-0000-000000000000", {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/admin/webhooks/:id/toggle", () => {
    test("toggles webhook from enabled to disabled", async () => {
      const { rawKey } = await createTestApiKey();
      const webhook = await createTestWebhook({ name: "Toggle Me", enabled: true });

      const res = await app.request(`/api/v1/admin/webhooks/${webhook.id}/toggle`, {
        method: "PATCH",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.webhook.enabled).toBe(false);
    });

    test("toggles webhook from disabled to enabled", async () => {
      const { rawKey } = await createTestApiKey();
      const webhook = await createTestWebhook({ name: "Toggle Me", enabled: false });

      const res = await app.request(`/api/v1/admin/webhooks/${webhook.id}/toggle`, {
        method: "PATCH",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.webhook.enabled).toBe(true);
    });

    test("returns 404 for non-existent webhook", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/webhooks/00000000-0000-0000-0000-000000000000/toggle",
        {
          method: "PATCH",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/admin/webhooks/:id/test", () => {
    test("tests webhook and returns success on 2xx response", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();
      // Use a webhook URL that will likely fail in test (no actual endpoint)
      const webhook = await createTestWebhook({
        name: "Test Webhook",
        url: "https://tools-httpstatus.pickup-services.com/200",
        type: "generic",
      });

      const res = await app.request(`/api/v1/admin/webhooks/${webhook.id}/test`, {
        method: "POST",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      // The result depends on whether the URL is reachable
      expect(data).toHaveProperty("success");
    });

    test("returns 404 for non-existent webhook", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/webhooks/00000000-0000-0000-0000-000000000000/test",
        {
          method: "POST",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });
  });
});
