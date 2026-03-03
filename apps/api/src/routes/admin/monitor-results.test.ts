import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestApiKey,
  createTestComponent,
  createTestMonitor,
  createTestMonitorResult,
  authHeader,
} from "../../test";

describe("Admin Monitor Results API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/monitors/:id/results", () => {
    test("returns paginated results for a monitor", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent();
      const monitor = await createTestMonitor(component.id);

      // Create multiple results
      for (let i = 0; i < 5; i++) {
        await createTestMonitorResult(monitor.id, {
          status: i % 2 === 0 ? "up" : "down",
          responseTimeMs: 100 + i * 10,
          checkedAt: new Date(Date.now() - i * 60000), // Each 1 minute apart
        });
      }

      const res = await app.request(`/api/v1/admin/monitors/${monitor.id}/results`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.results).toHaveLength(5);
      expect(data.pagination.total).toBe(5);
    });

    test("respects limit parameter", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent();
      const monitor = await createTestMonitor(component.id);

      for (let i = 0; i < 10; i++) {
        await createTestMonitorResult(monitor.id, {
          checkedAt: new Date(Date.now() - i * 60000),
        });
      }

      const res = await app.request(`/api/v1/admin/monitors/${monitor.id}/results?limit=3`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.results).toHaveLength(3);
      expect(data.pagination.total).toBe(10);
      expect(data.pagination.limit).toBe(3);
    });

    test("respects offset parameter", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent();
      const monitor = await createTestMonitor(component.id);

      for (let i = 0; i < 5; i++) {
        await createTestMonitorResult(monitor.id, {
          responseTimeMs: 100 + i,
          checkedAt: new Date(Date.now() - i * 60000),
        });
      }

      const res = await app.request(
        `/api/v1/admin/monitors/${monitor.id}/results?limit=2&offset=2`,
        {
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.results).toHaveLength(2);
      expect(data.pagination.offset).toBe(2);
    });

    test("filters by date range with from parameter", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent();
      const monitor = await createTestMonitor(component.id);

      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);
      const twoDaysAgo = new Date(now.getTime() - 86400000 * 2);

      await createTestMonitorResult(monitor.id, { checkedAt: now });
      await createTestMonitorResult(monitor.id, { checkedAt: yesterday });
      await createTestMonitorResult(monitor.id, { checkedAt: twoDaysAgo });

      const res = await app.request(
        `/api/v1/admin/monitors/${monitor.id}/results?from=${yesterday.toISOString()}`,
        {
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.results).toHaveLength(2);
    });

    test("filters by date range with to parameter", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent();
      const monitor = await createTestMonitor(component.id);

      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);
      const twoDaysAgo = new Date(now.getTime() - 86400000 * 2);

      await createTestMonitorResult(monitor.id, { checkedAt: now });
      await createTestMonitorResult(monitor.id, { checkedAt: yesterday });
      await createTestMonitorResult(monitor.id, { checkedAt: twoDaysAgo });

      const res = await app.request(
        `/api/v1/admin/monitors/${monitor.id}/results?to=${yesterday.toISOString()}`,
        {
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.results).toHaveLength(2);
    });

    test("returns results ordered by checkedAt descending", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent();
      const monitor = await createTestMonitor(component.id);

      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      const twoMinutesAgo = new Date(now.getTime() - 120000);

      await createTestMonitorResult(monitor.id, { checkedAt: twoMinutesAgo });
      await createTestMonitorResult(monitor.id, { checkedAt: now });
      await createTestMonitorResult(monitor.id, { checkedAt: oneMinuteAgo });

      const res = await app.request(`/api/v1/admin/monitors/${monitor.id}/results`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.results).toHaveLength(3);
      // Most recent should be first
      expect(new Date(data.results[0].checkedAt).getTime()).toBeGreaterThan(
        new Date(data.results[1].checkedAt).getTime()
      );
    });

    test("returns 404 for non-existent monitor", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/monitors/00000000-0000-0000-0000-000000000000/results",
        {
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request(
        "/api/v1/admin/monitors/00000000-0000-0000-0000-000000000000/results"
      );
      expect(res.status).toBe(401);
    });

    test("returns empty array when no results exist", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent();
      const monitor = await createTestMonitor(component.id);

      const res = await app.request(`/api/v1/admin/monitors/${monitor.id}/results`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.results).toHaveLength(0);
      expect(data.pagination.total).toBe(0);
    });
  });
});
