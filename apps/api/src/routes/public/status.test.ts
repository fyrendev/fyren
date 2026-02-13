import { describe, expect, test } from "bun:test";
import {
  createTestApp,
  createTestComponent,
  createTestIncident,
  createTestIncidentComponent,
  createTestIncidentUpdate,
  createTestMaintenance,
  createTestMaintenanceComponent,
  createTestMonitor,
  createTestMonitorResult,
  createTestOrganization,
  setupTestHooks,
} from "../../test";

describe("Public Status API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/status", () => {
    test("returns organization status summary", async () => {
      await createTestOrganization({
        slug: "acme",
        name: "Acme Corp",
      });
      await createTestComponent({ name: "API", status: "operational" });
      await createTestComponent({
        name: "Database",
        status: "operational",
      });

      const res = await app.request("/api/v1/status");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.organization.name).toBe("Acme Corp");
      expect(data.organization.slug).toBe("acme");
      expect(data.components).toHaveLength(2);
    });

    test("returns 404 when no organization configured", async () => {
      const res = await app.request("/api/v1/status");

      expect(res.status).toBe(404);
    });

    test("only returns public components", async () => {
      await createTestOrganization({ slug: "test-org" });
      await createTestComponent({ name: "Public", isPublic: true });
      await createTestComponent({ name: "Private", isPublic: false });

      const res = await app.request("/api/v1/status");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.components).toHaveLength(1);
      expect(data.components[0].name).toBe("Public");
    });
  });

  describe("GET /api/v1/status/components", () => {
    test("returns component list with status", async () => {
      await createTestOrganization({ slug: "test-org" });
      await createTestComponent({
        name: "API",
        status: "operational",
        displayOrder: 1,
      });
      await createTestComponent({
        name: "Database",
        status: "degraded",
        displayOrder: 2,
      });

      const res = await app.request("/api/v1/status/components");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.components).toHaveLength(2);
      expect(data.components[0].status).toBe("operational");
      expect(data.components[1].status).toBe("degraded");
    });

    test("returns components in display order", async () => {
      await createTestOrganization({ slug: "test-org" });
      await createTestComponent({ name: "Third", displayOrder: 3 });
      await createTestComponent({ name: "First", displayOrder: 1 });
      await createTestComponent({ name: "Second", displayOrder: 2 });

      const res = await app.request("/api/v1/status/components");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.components[0].name).toBe("First");
      expect(data.components[1].name).toBe("Second");
      expect(data.components[2].name).toBe("Third");
    });
  });

  describe("GET /api/v1/status/incidents", () => {
    test("returns recent incidents", async () => {
      await createTestOrganization({ slug: "test-org" });
      const component = await createTestComponent();
      const incident = await createTestIncident({
        title: "API Outage",
        status: "investigating",
        severity: "major",
      });
      await createTestIncidentUpdate(incident.id, {
        message: "We are investigating the issue",
        status: "investigating",
      });
      await createTestIncidentComponent(incident.id, component.id);

      const res = await app.request("/api/v1/status/incidents");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.incidents).toHaveLength(1);
      expect(data.incidents[0].title).toBe("API Outage");
      expect(data.incidents[0].status).toBe("investigating");
      expect(data.incidents[0].severity).toBe("major");
    });

    test("returns empty array when no incidents", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request("/api/v1/status/incidents");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.incidents).toHaveLength(0);
    });
  });

  describe("GET /api/v1/status/incidents/:id", () => {
    test("returns incident details with updates", async () => {
      await createTestOrganization({ slug: "test-org" });
      const incident = await createTestIncident({
        title: "Database Issues",
      });
      await createTestIncidentUpdate(incident.id, {
        message: "First update",
        status: "investigating",
      });
      await createTestIncidentUpdate(incident.id, {
        message: "Second update",
        status: "identified",
      });

      const res = await app.request(`/api/v1/status/incidents/${incident.id}`);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.incident.title).toBe("Database Issues");
      expect(data.incident.updates).toHaveLength(2);
    });

    test("returns 404 for non-existent incident", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request(
        "/api/v1/status/incidents/00000000-0000-0000-0000-000000000000"
      );

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/status/maintenance", () => {
    test("returns upcoming maintenance windows", async () => {
      await createTestOrganization({ slug: "test-org" });
      const component = await createTestComponent();
      const maint = await createTestMaintenance({
        title: "Scheduled Upgrade",
        status: "scheduled",
      });
      await createTestMaintenanceComponent(maint.id, component.id);

      const res = await app.request("/api/v1/status/maintenance");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.maintenance).toHaveLength(1);
      expect(data.maintenance[0].title).toBe("Scheduled Upgrade");
    });

    test("returns empty array when no maintenance scheduled", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request("/api/v1/status/maintenance");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.maintenance).toHaveLength(0);
    });
  });

  describe("GET /api/v1/status/uptime", () => {
    test("returns uptime percentages for components", async () => {
      await createTestOrganization({ slug: "test-org" });
      await createTestComponent({ name: "API" });
      await createTestComponent({ name: "Database" });

      const res = await app.request("/api/v1/status/uptime");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.components).toHaveLength(2);
      expect(data.overall).toBeDefined();
      expect(data.overall.day).toBeDefined();
      expect(data.overall.week).toBeDefined();
      expect(data.overall.month).toBeDefined();
      expect(data.overall.quarter).toBeDefined();
    });

    test("returns 100% uptime when no monitor results exist", async () => {
      await createTestOrganization({ slug: "test-org" });
      await createTestComponent({ name: "API" });

      const res = await app.request("/api/v1/status/uptime");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.components[0].uptime.day).toBe(100);
      expect(data.components[0].uptime.week).toBe(100);
    });
  });

  describe("GET /api/v1/status/uptime/:componentId/history", () => {
    test("returns daily uptime history for component", async () => {
      await createTestOrganization({ slug: "test-org" });
      const component = await createTestComponent({ name: "API" });
      const monitor = await createTestMonitor(component.id);

      // Create monitor results for today
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      await createTestMonitorResult(monitor.id, { status: "up", checkedAt: today });
      await createTestMonitorResult(monitor.id, {
        status: "up",
        checkedAt: new Date(today.getTime() - 3600000),
      });

      const res = await app.request(`/api/v1/status/uptime/${component.id}/history?days=7`);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.component.id).toBe(component.id);
      expect(data.component.name).toBe("API");
      expect(data.history).toHaveLength(7);
      expect(data.history[0].date).toBeDefined();
      expect(data.history[0].uptime).toBeDefined();
      expect(data.history[0].status).toBeDefined();
    });

    test("calculates uptime correctly with mixed results", async () => {
      await createTestOrganization({ slug: "test-org" });
      const component = await createTestComponent({ name: "API" });
      const monitor = await createTestMonitor(component.id);

      // Create 4 results: 3 up, 1 down = 75% uptime
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      await createTestMonitorResult(monitor.id, { status: "up", checkedAt: today });
      await createTestMonitorResult(monitor.id, {
        status: "up",
        checkedAt: new Date(today.getTime() - 3600000),
      });
      await createTestMonitorResult(monitor.id, {
        status: "up",
        checkedAt: new Date(today.getTime() - 7200000),
      });
      await createTestMonitorResult(monitor.id, {
        status: "down",
        checkedAt: new Date(today.getTime() - 10800000),
      });

      const res = await app.request(`/api/v1/status/uptime/${component.id}/history?days=1`);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.history[0].uptime).toBe(75);
    });

    test("returns 404 for non-existent component", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request(
        "/api/v1/status/uptime/00000000-0000-0000-0000-000000000000/history"
      );

      expect(res.status).toBe(404);
    });

    test("respects days query parameter", async () => {
      await createTestOrganization({ slug: "test-org" });
      const component = await createTestComponent({ name: "API" });

      const res = await app.request(`/api/v1/status/uptime/${component.id}/history?days=30`);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.history).toHaveLength(30);
    });

    test("caps days at 90", async () => {
      await createTestOrganization({ slug: "test-org" });
      const component = await createTestComponent({ name: "API" });

      const res = await app.request(`/api/v1/status/uptime/${component.id}/history?days=365`);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.history).toHaveLength(90);
    });

    test("returns incident count for each day", async () => {
      await createTestOrganization({ slug: "test-org" });
      const component = await createTestComponent({ name: "API" });

      // Create an incident for today
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const incident = await createTestIncident({
        title: "API Outage",
        startedAt: today,
      });
      await createTestIncidentComponent(incident.id, component.id);

      const res = await app.request(`/api/v1/status/uptime/${component.id}/history?days=1`);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.history[0].incidents).toBe(1);
    });

    test("correctly filters results by day boundaries", async () => {
      // This test verifies that the SQL date comparisons work correctly
      // by creating results across multiple days and checking isolation
      await createTestOrganization({ slug: "test-org" });
      const component = await createTestComponent({ name: "API" });
      const monitor = await createTestMonitor(component.id);

      // Set up dates for today, yesterday, and 2 days ago
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0);
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

      // Today: 2 up, 0 down = 100%
      await createTestMonitorResult(monitor.id, { status: "up", checkedAt: today });
      await createTestMonitorResult(monitor.id, {
        status: "up",
        checkedAt: new Date(today.getTime() + 60000),
      });

      // Yesterday: 1 up, 1 down = 50%
      await createTestMonitorResult(monitor.id, { status: "up", checkedAt: yesterday });
      await createTestMonitorResult(monitor.id, {
        status: "down",
        checkedAt: new Date(yesterday.getTime() + 60000),
      });

      // 2 days ago: 0 up, 2 down = 0%
      await createTestMonitorResult(monitor.id, { status: "down", checkedAt: twoDaysAgo });
      await createTestMonitorResult(monitor.id, {
        status: "down",
        checkedAt: new Date(twoDaysAgo.getTime() + 60000),
      });

      const res = await app.request(`/api/v1/status/uptime/${component.id}/history?days=3`);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.history).toHaveLength(3);

      // History is ordered from most recent (index 0) to oldest
      // Day 0 (today): 100% uptime
      expect(data.history[0].uptime).toBe(100);
      // Day 1 (yesterday): 50% uptime
      expect(data.history[1].uptime).toBe(50);
      // Day 2 (2 days ago): 0% uptime
      expect(data.history[2].uptime).toBe(0);
    });

    test("handles results at day boundaries correctly", async () => {
      // Test edge case: results right at midnight boundaries
      await createTestOrganization({ slug: "test-org" });
      const component = await createTestComponent({ name: "API" });
      const monitor = await createTestMonitor(component.id);

      const now = new Date();
      // Start of today (midnight)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      // End of yesterday (23:59:59.999)
      const yesterdayEnd = new Date(todayStart.getTime() - 1);
      // Start of yesterday
      const yesterdayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        0,
        0,
        0
      );

      // Result at very start of today - should count for today
      await createTestMonitorResult(monitor.id, {
        status: "up",
        checkedAt: new Date(todayStart.getTime() + 1000),
      });

      // Result at very end of yesterday - should count for yesterday
      await createTestMonitorResult(monitor.id, {
        status: "down",
        checkedAt: new Date(yesterdayEnd.getTime() - 1000),
      });

      // Result at start of yesterday - should count for yesterday
      await createTestMonitorResult(monitor.id, {
        status: "down",
        checkedAt: new Date(yesterdayStart.getTime() + 1000),
      });

      const res = await app.request(`/api/v1/status/uptime/${component.id}/history?days=2`);

      expect(res.status).toBe(200);
      const data = await res.json();

      // Today: 1 up = 100%
      expect(data.history[0].uptime).toBe(100);
      // Yesterday: 2 down = 0%
      expect(data.history[1].uptime).toBe(0);
    });
  });
});
