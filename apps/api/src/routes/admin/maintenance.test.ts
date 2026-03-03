import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestApiKey,
  createTestComponent,
  createTestMaintenance,
  createTestMaintenanceComponent,
  jsonAuthHeaders,
  authHeader,
} from "../../test";

describe("Admin Maintenance API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/maintenance", () => {
    test("lists all maintenance windows for organization", async () => {
      const { rawKey } = await createTestApiKey();
      await createTestMaintenance({ title: "Database Upgrade" });
      await createTestMaintenance({ title: "Network Maintenance" });

      const res = await app.request("/api/v1/admin/maintenance", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.maintenances).toHaveLength(2);
      expect(data.maintenances.map((m: { title: string }) => m.title)).toContain(
        "Database Upgrade"
      );
      expect(data.maintenances.map((m: { title: string }) => m.title)).toContain(
        "Network Maintenance"
      );
    });

    test("filters maintenance by status", async () => {
      const { rawKey } = await createTestApiKey();
      await createTestMaintenance({ title: "Scheduled", status: "scheduled" });
      await createTestMaintenance({ title: "In Progress", status: "in_progress" });

      const res = await app.request("/api/v1/admin/maintenance?status=scheduled", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.maintenances).toHaveLength(1);
      expect(data.maintenances[0].title).toBe("Scheduled");
    });

    test("filters upcoming maintenance", async () => {
      const { rawKey } = await createTestApiKey();
      const futureStart = new Date(Date.now() + 86400000 * 2); // 2 days from now
      const futureEnd = new Date(futureStart.getTime() + 3600000);
      await createTestMaintenance({
        title: "Future",
        status: "scheduled",
        scheduledStartAt: futureStart,
        scheduledEndAt: futureEnd,
      });

      const res = await app.request("/api/v1/admin/maintenance?upcoming=true", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.maintenances.length).toBeGreaterThanOrEqual(1);
    });

    test("paginates results", async () => {
      const { rawKey } = await createTestApiKey();
      for (let i = 0; i < 5; i++) {
        await createTestMaintenance({ title: `Maintenance ${i}` });
      }

      const res = await app.request("/api/v1/admin/maintenance?limit=2&offset=0", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.maintenances).toHaveLength(2);
      expect(data.pagination.total).toBe(5);
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/maintenance");
      expect(res.status).toBe(401);
    });

    test("returns empty array when no maintenance exists", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/maintenance", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.maintenances).toHaveLength(0);
    });
  });

  describe("GET /api/v1/admin/maintenance/:id", () => {
    test("returns maintenance by ID with components", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent({ name: "API Server" });
      const maintenance = await createTestMaintenance({ title: "Server Maintenance" });
      await createTestMaintenanceComponent(maintenance.id, component.id);

      const res = await app.request(`/api/v1/admin/maintenance/${maintenance.id}`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.maintenance.id).toBe(maintenance.id);
      expect(data.maintenance.title).toBe("Server Maintenance");
      expect(data.maintenance.affectedComponents).toHaveLength(1);
    });

    test("returns 404 for non-existent maintenance", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/maintenance/00000000-0000-0000-0000-000000000000",
        {
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/admin/maintenance", () => {
    test("creates a new maintenance window", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent();
      const scheduledStartAt = new Date(Date.now() + 86400000); // Tomorrow
      const scheduledEndAt = new Date(scheduledStartAt.getTime() + 3600000); // 1 hour later

      const res = await app.request("/api/v1/admin/maintenance", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          title: "New Maintenance",
          description: "Scheduled server maintenance",
          scheduledStartAt: scheduledStartAt.toISOString(),
          scheduledEndAt: scheduledEndAt.toISOString(),
          componentIds: [component.id],
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.maintenance.title).toBe("New Maintenance");
      expect(data.maintenance.description).toBe("Scheduled server maintenance");
      expect(data.maintenance.status).toBe("scheduled");
      expect(data.maintenance.id).toBeDefined();
    });

    test("creates maintenance with affected components", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent({ name: "API Server" });
      const scheduledStartAt = new Date(Date.now() + 86400000);
      const scheduledEndAt = new Date(scheduledStartAt.getTime() + 3600000);

      const res = await app.request("/api/v1/admin/maintenance", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          title: "Component Maintenance",
          scheduledStartAt: scheduledStartAt.toISOString(),
          scheduledEndAt: scheduledEndAt.toISOString(),
          componentIds: [component.id],
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.maintenance.title).toBe("Component Maintenance");
    });

    test("creates maintenance with auto-start and auto-complete options", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent();
      const scheduledStartAt = new Date(Date.now() + 86400000);
      const scheduledEndAt = new Date(scheduledStartAt.getTime() + 3600000);

      const res = await app.request("/api/v1/admin/maintenance", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          title: "Auto Maintenance",
          scheduledStartAt: scheduledStartAt.toISOString(),
          scheduledEndAt: scheduledEndAt.toISOString(),
          componentIds: [component.id],
          autoStart: true,
          autoComplete: true,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.maintenance.autoStart).toBe(true);
      expect(data.maintenance.autoComplete).toBe(true);
    });

    test("returns 400 for missing required fields", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/maintenance", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          // Missing title and schedule
          description: "No title",
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test",
          scheduledStartAt: new Date().toISOString(),
          scheduledEndAt: new Date().toISOString(),
        }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/v1/admin/maintenance/:id", () => {
    test("updates maintenance", async () => {
      const { rawKey } = await createTestApiKey();
      const maintenance = await createTestMaintenance({
        title: "Original Title",
        description: "Original description",
      });

      const res = await app.request(`/api/v1/admin/maintenance/${maintenance.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          title: "Updated Title",
          description: "Updated description",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.maintenance.title).toBe("Updated Title");
      expect(data.maintenance.description).toBe("Updated description");
    });

    test("returns 404 for non-existent maintenance", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/maintenance/00000000-0000-0000-0000-000000000000",
        {
          method: "PUT",
          headers: jsonAuthHeaders(rawKey),
          body: JSON.stringify({ title: "Updated" }),
        }
      );

      expect(res.status).toBe(404);
    });

    test("returns 400 when updating non-scheduled maintenance", async () => {
      const { rawKey } = await createTestApiKey();
      const maintenance = await createTestMaintenance({
        title: "In Progress",
        status: "in_progress",
      });

      const res = await app.request(`/api/v1/admin/maintenance/${maintenance.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          title: "Updated Title",
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/v1/admin/maintenance/:id/start", () => {
    test("starts maintenance early", async () => {
      const { rawKey } = await createTestApiKey();
      const maintenance = await createTestMaintenance({ status: "scheduled" });

      const res = await app.request(`/api/v1/admin/maintenance/${maintenance.id}/start`, {
        method: "PATCH",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.maintenance.status).toBe("in_progress");
      expect(data.maintenance.startedAt).toBeDefined();
    });

    test("returns 404 for non-existent maintenance", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/maintenance/00000000-0000-0000-0000-000000000000/start",
        {
          method: "PATCH",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });

    test("returns 400 when starting non-scheduled maintenance", async () => {
      const { rawKey } = await createTestApiKey();
      const maintenance = await createTestMaintenance({ status: "in_progress" });

      const res = await app.request(`/api/v1/admin/maintenance/${maintenance.id}/start`, {
        method: "PATCH",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/v1/admin/maintenance/:id/complete", () => {
    test("completes maintenance", async () => {
      const { rawKey } = await createTestApiKey();
      const maintenance = await createTestMaintenance({ status: "in_progress" });

      const res = await app.request(`/api/v1/admin/maintenance/${maintenance.id}/complete`, {
        method: "PATCH",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.maintenance.status).toBe("completed");
      expect(data.maintenance.completedAt).toBeDefined();
    });

    test("returns 404 for non-existent maintenance", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/maintenance/00000000-0000-0000-0000-000000000000/complete",
        {
          method: "PATCH",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });

    test("returns 400 when completing non-in-progress maintenance", async () => {
      const { rawKey } = await createTestApiKey();
      const maintenance = await createTestMaintenance({ status: "scheduled" });

      const res = await app.request(`/api/v1/admin/maintenance/${maintenance.id}/complete`, {
        method: "PATCH",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/v1/admin/maintenance/:id", () => {
    test("cancels scheduled maintenance", async () => {
      const { rawKey } = await createTestApiKey();
      const maintenance = await createTestMaintenance({ status: "scheduled" });

      const res = await app.request(`/api/v1/admin/maintenance/${maintenance.id}`, {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("returns 404 for non-existent maintenance", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/maintenance/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });

    test("returns 400 when cancelling completed maintenance", async () => {
      const { rawKey } = await createTestApiKey();
      const maintenance = await createTestMaintenance({ status: "completed" });

      const res = await app.request(`/api/v1/admin/maintenance/${maintenance.id}`, {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(400);
    });
  });
});
