import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestApiKey,
  createTestSubscriber,
  createTestSubscriberGroup,
  createTestComponent,
  jsonAuthHeaders,
  authHeader,
} from "../../test";

describe("Admin Subscribers API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/subscribers", () => {
    test("lists all subscribers for organization", async () => {
      const { rawKey } = await createTestApiKey();
      await createTestSubscriber({ email: "user1@example.com" });
      await createTestSubscriber({ email: "user2@example.com" });

      const res = await app.request("/api/v1/admin/subscribers", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscribers).toHaveLength(2);
      expect(data.subscribers.map((s: { email: string }) => s.email)).toContain(
        "user1@example.com"
      );
      expect(data.subscribers.map((s: { email: string }) => s.email)).toContain(
        "user2@example.com"
      );
    });

    test("filters subscribers by verified status", async () => {
      const { rawKey } = await createTestApiKey();
      await createTestSubscriber({ email: "verified@example.com", verified: true });
      await createTestSubscriber({ email: "unverified@example.com", verified: false });

      const res = await app.request("/api/v1/admin/subscribers?verified=true", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscribers).toHaveLength(1);
      expect(data.subscribers[0].email).toBe("verified@example.com");
    });

    test("filters subscribers by group", async () => {
      const { rawKey } = await createTestApiKey();
      const group = await createTestSubscriberGroup({ name: "VIP Group" });
      await createTestSubscriber({ email: "grouped@example.com", groupId: group.id });
      await createTestSubscriber({ email: "ungrouped@example.com" });

      const res = await app.request(`/api/v1/admin/subscribers?groupId=${group.id}`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscribers).toHaveLength(1);
      expect(data.subscribers[0].email).toBe("grouped@example.com");
    });

    test("paginates results", async () => {
      const { rawKey } = await createTestApiKey();
      for (let i = 0; i < 5; i++) {
        await createTestSubscriber({ email: `user${i}@example.com` });
      }

      const res = await app.request("/api/v1/admin/subscribers?limit=2&offset=0", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscribers).toHaveLength(2);
      expect(data.pagination.total).toBe(5);
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/subscribers");
      expect(res.status).toBe(401);
    });

    test("returns empty array when no subscribers exist", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/subscribers", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscribers).toHaveLength(0);
    });
  });

  describe("GET /api/v1/admin/subscribers/:id", () => {
    test("returns subscriber by ID", async () => {
      const { rawKey } = await createTestApiKey();
      const subscriber = await createTestSubscriber({
        email: "test@example.com",
        verified: true,
      });

      const res = await app.request(`/api/v1/admin/subscribers/${subscriber.id}`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscriber.id).toBe(subscriber.id);
      expect(data.subscriber.email).toBe("test@example.com");
      expect(data.subscriber.verified).toBe(true);
    });

    test("returns subscriber with group info", async () => {
      const { rawKey } = await createTestApiKey();
      const group = await createTestSubscriberGroup({ name: "VIP Group" });
      const subscriber = await createTestSubscriber({
        email: "vip@example.com",
        groupId: group.id,
      });

      const res = await app.request(`/api/v1/admin/subscribers/${subscriber.id}`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscriber.group.id).toBe(group.id);
      expect(data.subscriber.group.name).toBe("VIP Group");
    });

    test("returns 404 for non-existent subscriber", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/subscribers/00000000-0000-0000-0000-000000000000",
        {
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/admin/subscribers", () => {
    test("creates a new subscriber (auto-verified)", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/subscribers", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          email: "new@example.com",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.subscriber.email).toBe("new@example.com");
      expect(data.subscriber.verified).toBe(true);
      expect(data.subscriber.id).toBeDefined();
    });

    test("creates subscriber with group and component preferences", async () => {
      const { rawKey } = await createTestApiKey();
      const group = await createTestSubscriberGroup({ name: "Enterprise" });
      const component = await createTestComponent({ name: "API Server" });

      const res = await app.request("/api/v1/admin/subscribers", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          email: "enterprise@example.com",
          groupId: group.id,
          componentIds: [component.id],
          notifyOnIncident: true,
          notifyOnMaintenance: false,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.subscriber.groupId).toBe(group.id);
      expect(data.subscriber.componentIds).toContain(component.id);
      expect(data.subscriber.notifyOnIncident).toBe(true);
      expect(data.subscriber.notifyOnMaintenance).toBe(false);
    });

    test("returns 400 for duplicate email", async () => {
      const { rawKey } = await createTestApiKey();
      await createTestSubscriber({ email: "existing@example.com" });

      const res = await app.request("/api/v1/admin/subscribers", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          email: "existing@example.com",
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 400 for invalid email", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/subscribers", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          email: "not-an-email",
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/v1/admin/subscribers/:id", () => {
    test("updates subscriber preferences", async () => {
      const { rawKey } = await createTestApiKey();
      const subscriber = await createTestSubscriber({
        email: "original@example.com",
        notifyOnIncident: true,
        notifyOnMaintenance: true,
      });

      const res = await app.request(`/api/v1/admin/subscribers/${subscriber.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          notifyOnIncident: false,
          notifyOnMaintenance: false,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscriber.notifyOnIncident).toBe(false);
      expect(data.subscriber.notifyOnMaintenance).toBe(false);
    });

    test("updates subscriber email", async () => {
      const { rawKey } = await createTestApiKey();
      const subscriber = await createTestSubscriber({ email: "old@example.com" });

      const res = await app.request(`/api/v1/admin/subscribers/${subscriber.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          email: "new@example.com",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscriber.email).toBe("new@example.com");
    });

    test("returns 400 when changing to existing email", async () => {
      const { rawKey } = await createTestApiKey();
      await createTestSubscriber({ email: "taken@example.com" });
      const subscriber = await createTestSubscriber({ email: "original@example.com" });

      const res = await app.request(`/api/v1/admin/subscribers/${subscriber.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          email: "taken@example.com",
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 404 for non-existent subscriber", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/subscribers/00000000-0000-0000-0000-000000000000",
        {
          method: "PUT",
          headers: jsonAuthHeaders(rawKey),
          body: JSON.stringify({ notifyOnIncident: false }),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/admin/subscribers/:id", () => {
    test("deletes subscriber", async () => {
      const { rawKey } = await createTestApiKey();
      const subscriber = await createTestSubscriber({ email: "delete@example.com" });

      const res = await app.request(`/api/v1/admin/subscribers/${subscriber.id}`, {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify subscriber is deleted
      const getRes = await app.request(`/api/v1/admin/subscribers/${subscriber.id}`, {
        headers: authHeader(rawKey),
      });
      expect(getRes.status).toBe(404);
    });

    test("returns 404 for non-existent subscriber", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/subscribers/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/admin/subscribers/export", () => {
    test("exports verified subscribers as CSV", async () => {
      const { rawKey } = await createTestApiKey();
      await createTestSubscriber({ email: "verified1@example.com", verified: true });
      await createTestSubscriber({ email: "verified2@example.com", verified: true });
      await createTestSubscriber({ email: "unverified@example.com", verified: false });

      const res = await app.request("/api/v1/admin/subscribers/export", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/csv");
      expect(res.headers.get("Content-Disposition")).toContain("subscribers.csv");

      const csv = await res.text();
      expect(csv).toContain("email,verified_at,subscribed_at");
      expect(csv).toContain("verified1@example.com");
      expect(csv).toContain("verified2@example.com");
      expect(csv).not.toContain("unverified@example.com");
    });

    test("exports empty CSV when no verified subscribers", async () => {
      const { rawKey } = await createTestApiKey();
      await createTestSubscriber({ email: "unverified@example.com", verified: false });

      const res = await app.request("/api/v1/admin/subscribers/export", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const csv = await res.text();
      expect(csv).toBe("email,verified_at,subscribed_at");
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/subscribers/export");
      expect(res.status).toBe(401);
    });
  });
});
