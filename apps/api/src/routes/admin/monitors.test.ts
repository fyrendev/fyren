import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestApiKey,
  createTestComponent,
  createTestMonitor,
  jsonAuthHeaders,
  authHeader,
} from "../../test";

describe("Admin Monitors API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/monitors", () => {
    test("lists all monitors for organization", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const component = await createTestComponent(org.id);
      await createTestMonitor(component.id, { url: "https://api.example.com" });
      await createTestMonitor(component.id, { url: "https://web.example.com" });

      const res = await app.request("/api/v1/admin/monitors", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.monitors).toHaveLength(2);
    });

    test("filters monitors by componentId", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const component1 = await createTestComponent(org.id, { name: "API" });
      const component2 = await createTestComponent(org.id, { name: "Web" });
      await createTestMonitor(component1.id);
      await createTestMonitor(component2.id);

      const res = await app.request(
        `/api/v1/admin/monitors?componentId=${component1.id}`,
        {
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.monitors).toHaveLength(1);
      expect(data.monitors[0].componentId).toBe(component1.id);
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/monitors");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/admin/monitors", () => {
    test("creates a new HTTP monitor", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const component = await createTestComponent(org.id);

      const res = await app.request("/api/v1/admin/monitors", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          componentId: component.id,
          type: "http",
          url: "https://api.example.com/health",
          intervalSeconds: 60,
          timeoutMs: 5000,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.monitor.type).toBe("http");
      expect(data.monitor.url).toBe("https://api.example.com/health");
      expect(data.monitor.intervalSeconds).toBe(60);
      expect(data.monitor.isActive).toBe(true);
    });

    test("creates a TCP monitor", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const component = await createTestComponent(org.id);

      const res = await app.request("/api/v1/admin/monitors", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          componentId: component.id,
          type: "tcp",
          url: "db.example.com:5432",
          intervalSeconds: 30,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.monitor.type).toBe("tcp");
    });

    test("returns 400 for invalid URL format", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const component = await createTestComponent(org.id);

      const res = await app.request("/api/v1/admin/monitors", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          componentId: component.id,
          type: "http",
          url: "not-a-valid-url",
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 404 for non-existent component", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request("/api/v1/admin/monitors", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          componentId: "00000000-0000-0000-0000-000000000000",
          type: "http",
          url: "https://example.com",
        }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/admin/monitors/:id", () => {
    test("returns monitor with recent results", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const component = await createTestComponent(org.id);
      const monitor = await createTestMonitor(component.id);

      const res = await app.request(`/api/v1/admin/monitors/${monitor.id}`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.monitor.id).toBe(monitor.id);
      expect(data.monitor.component).toBeDefined();
      expect(data.monitor.recentResults).toBeDefined();
    });

    test("returns 404 for non-existent monitor", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(
        "/api/v1/admin/monitors/00000000-0000-0000-0000-000000000000",
        {
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/v1/admin/monitors/:id", () => {
    test("updates monitor settings", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const component = await createTestComponent(org.id);
      const monitor = await createTestMonitor(component.id, {
        intervalSeconds: 60,
      });

      const res = await app.request(`/api/v1/admin/monitors/${monitor.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          intervalSeconds: 120,
          timeoutMs: 10000,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.monitor.intervalSeconds).toBe(120);
      expect(data.monitor.timeoutMs).toBe(10000);
    });

    test("returns 404 for non-existent monitor", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(
        "/api/v1/admin/monitors/00000000-0000-0000-0000-000000000000",
        {
          method: "PUT",
          headers: jsonAuthHeaders(rawKey),
          body: JSON.stringify({ intervalSeconds: 120 }),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/admin/monitors/:id/toggle", () => {
    test("toggles monitor from active to inactive", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const component = await createTestComponent(org.id);
      const monitor = await createTestMonitor(component.id, { isActive: true });

      const res = await app.request(
        `/api/v1/admin/monitors/${monitor.id}/toggle`,
        {
          method: "PATCH",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.monitor.isActive).toBe(false);
    });

    test("toggles monitor from inactive to active", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const component = await createTestComponent(org.id);
      const monitor = await createTestMonitor(component.id, { isActive: false });

      const res = await app.request(
        `/api/v1/admin/monitors/${monitor.id}/toggle`,
        {
          method: "PATCH",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.monitor.isActive).toBe(true);
    });

    test("returns 404 for non-existent monitor", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(
        "/api/v1/admin/monitors/00000000-0000-0000-0000-000000000000/toggle",
        {
          method: "PATCH",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });

    test("returns 403 for monitor from different organization", async () => {
      const org1 = await createTestOrganization({ slug: "org-1" });
      const org2 = await createTestOrganization({ slug: "org-2" });
      const { rawKey } = await createTestApiKey(org1.id);
      const component = await createTestComponent(org2.id);
      const monitor = await createTestMonitor(component.id);

      const res = await app.request(
        `/api/v1/admin/monitors/${monitor.id}/toggle`,
        {
          method: "PATCH",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(403);
    });

    test("returns 401 without authentication", async () => {
      const org = await createTestOrganization();
      const component = await createTestComponent(org.id);
      const monitor = await createTestMonitor(component.id);

      const res = await app.request(
        `/api/v1/admin/monitors/${monitor.id}/toggle`,
        {
          method: "PATCH",
        }
      );

      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/v1/admin/monitors/:id", () => {
    test("deletes monitor", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const component = await createTestComponent(org.id);
      const monitor = await createTestMonitor(component.id);

      const res = await app.request(`/api/v1/admin/monitors/${monitor.id}`, {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify monitor is deleted
      const getRes = await app.request(
        `/api/v1/admin/monitors/${monitor.id}`,
        {
          headers: authHeader(rawKey),
        }
      );
      expect(getRes.status).toBe(404);
    });

    test("returns 404 for non-existent monitor", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(
        "/api/v1/admin/monitors/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/admin/monitors/:id/check", () => {
    test("triggers immediate check", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const component = await createTestComponent(org.id);
      const monitor = await createTestMonitor(component.id, {
        url: "https://httpstat.us/200",
        type: "http",
      });

      const res = await app.request(
        `/api/v1/admin/monitors/${monitor.id}/check`,
        {
          method: "POST",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result).toBeDefined();
      expect(data.result.status).toBeDefined();
    });

    test("returns 404 for non-existent monitor", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(
        "/api/v1/admin/monitors/00000000-0000-0000-0000-000000000000/check",
        {
          method: "POST",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });
  });
});
