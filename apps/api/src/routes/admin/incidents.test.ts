import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestApiKey,
  createTestComponent,
  createTestIncident,
  createTestIncidentUpdate,
  createTestIncidentComponent,
  jsonAuthHeaders,
  authHeader,
} from "../../test";

describe("Admin Incidents API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/incidents", () => {
    test("lists all incidents for organization", async () => {
      const { rawKey } = await createTestApiKey();
      await createTestIncident({ title: "API Outage" });
      await createTestIncident({ title: "Database Issues" });

      const res = await app.request("/api/v1/admin/incidents", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.incidents).toHaveLength(2);
      expect(data.incidents.map((i: { title: string }) => i.title)).toContain("API Outage");
      expect(data.incidents.map((i: { title: string }) => i.title)).toContain("Database Issues");
    });

    test("filters incidents by active status", async () => {
      const { rawKey } = await createTestApiKey();
      await createTestIncident({ title: "Active", status: "investigating" });
      await createTestIncident({
        title: "Resolved",
        status: "resolved",
        resolvedAt: new Date(),
      });

      const res = await app.request("/api/v1/admin/incidents?status=active", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.incidents).toHaveLength(1);
      expect(data.incidents[0].title).toBe("Active");
    });

    test("filters incidents by resolved status", async () => {
      const { rawKey } = await createTestApiKey();
      await createTestIncident({ title: "Active", status: "investigating" });
      await createTestIncident({
        title: "Resolved",
        status: "resolved",
        resolvedAt: new Date(),
      });

      const res = await app.request("/api/v1/admin/incidents?status=resolved", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.incidents).toHaveLength(1);
      expect(data.incidents[0].title).toBe("Resolved");
    });

    test("filters incidents by severity", async () => {
      const { rawKey } = await createTestApiKey();
      await createTestIncident({ title: "Minor Issue", severity: "minor" });
      await createTestIncident({ title: "Critical Issue", severity: "critical" });

      const res = await app.request("/api/v1/admin/incidents?severity=critical", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.incidents).toHaveLength(1);
      expect(data.incidents[0].title).toBe("Critical Issue");
    });

    test("paginates results", async () => {
      const { rawKey } = await createTestApiKey();
      for (let i = 0; i < 5; i++) {
        await createTestIncident({ title: `Incident ${i}` });
      }

      const res = await app.request("/api/v1/admin/incidents?limit=2&offset=0", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.incidents).toHaveLength(2);
      expect(data.pagination.total).toBe(5);
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/incidents");
      expect(res.status).toBe(401);
    });

    test("returns empty array when no incidents exist", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/incidents", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.incidents).toHaveLength(0);
    });
  });

  describe("GET /api/v1/admin/incidents/:id", () => {
    test("returns incident by ID with updates and components", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent({ name: "API Server" });
      const incident = await createTestIncident({ title: "Server Down" });
      await createTestIncidentUpdate(incident.id, { message: "Investigating the issue" });
      await createTestIncidentComponent(incident.id, component.id);

      const res = await app.request(`/api/v1/admin/incidents/${incident.id}`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.incident.id).toBe(incident.id);
      expect(data.incident.title).toBe("Server Down");
      expect(data.incident.updates).toHaveLength(1);
      expect(data.incident.updates[0].message).toBe("Investigating the issue");
      expect(data.incident.affectedComponents).toHaveLength(1);
    });

    test("returns 404 for non-existent incident", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/incidents/00000000-0000-0000-0000-000000000000",
        {
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/admin/incidents", () => {
    test("creates a new incident", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/incidents", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          title: "New Incident",
          severity: "major",
          message: "We are investigating an issue",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.incident.title).toBe("New Incident");
      expect(data.incident.severity).toBe("major");
      expect(data.incident.status).toBe("investigating");
      expect(data.incident.id).toBeDefined();
    });

    test("creates incident with affected components", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent({ name: "API Server" });

      const res = await app.request("/api/v1/admin/incidents", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          title: "Component Incident",
          severity: "minor",
          message: "Investigating component issue",
          componentIds: [component.id],
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.incident.title).toBe("Component Incident");
    });

    test("returns 400 for missing required fields", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/incidents", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          // Missing title
          severity: "major",
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test",
          severity: "minor",
        }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/v1/admin/incidents/:id", () => {
    test("updates incident title and severity", async () => {
      const { rawKey } = await createTestApiKey();
      const incident = await createTestIncident({
        title: "Original Title",
        severity: "minor",
      });

      const res = await app.request(`/api/v1/admin/incidents/${incident.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          title: "Updated Title",
          severity: "major",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.incident.title).toBe("Updated Title");
      expect(data.incident.severity).toBe("major");
    });

    test("returns 404 for non-existent incident", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/incidents/00000000-0000-0000-0000-000000000000",
        {
          method: "PUT",
          headers: jsonAuthHeaders(rawKey),
          body: JSON.stringify({ title: "Updated" }),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/admin/incidents/:id/updates", () => {
    test("adds update to incident", async () => {
      const { rawKey } = await createTestApiKey();
      const incident = await createTestIncident({ status: "investigating" });

      const res = await app.request(`/api/v1/admin/incidents/${incident.id}/updates`, {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          status: "identified",
          message: "We have identified the root cause",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.update.status).toBe("identified");
      expect(data.update.message).toBe("We have identified the root cause");
    });

    test("returns 404 for non-existent incident", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/incidents/00000000-0000-0000-0000-000000000000/updates",
        {
          method: "POST",
          headers: jsonAuthHeaders(rawKey),
          body: JSON.stringify({
            status: "identified",
            message: "Test",
          }),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/admin/incidents/:id/resolve", () => {
    test("resolves incident", async () => {
      const { rawKey } = await createTestApiKey();
      const incident = await createTestIncident({ status: "monitoring" });

      const res = await app.request(`/api/v1/admin/incidents/${incident.id}/resolve`, {
        method: "PATCH",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          message: "Issue has been resolved",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.update.status).toBe("resolved");
      expect(data.update.message).toBe("Issue has been resolved");
    });

    test("resolves incident without message", async () => {
      const { rawKey } = await createTestApiKey();
      const incident = await createTestIncident({ status: "monitoring" });

      const res = await app.request(`/api/v1/admin/incidents/${incident.id}/resolve`, {
        method: "PATCH",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.update.status).toBe("resolved");
    });

    test("returns 404 for non-existent incident", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/incidents/00000000-0000-0000-0000-000000000000/resolve",
        {
          method: "PATCH",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/v1/admin/incidents/:id/components", () => {
    test("updates affected components", async () => {
      const { rawKey } = await createTestApiKey();
      const component1 = await createTestComponent({ name: "API Server" });
      const component2 = await createTestComponent({ name: "Database" });
      const incident = await createTestIncident();

      const res = await app.request(`/api/v1/admin/incidents/${incident.id}/components`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          componentIds: [component1.id, component2.id],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("returns 404 for non-existent incident", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent();

      const res = await app.request(
        "/api/v1/admin/incidents/00000000-0000-0000-0000-000000000000/components",
        {
          method: "PUT",
          headers: jsonAuthHeaders(rawKey),
          body: JSON.stringify({
            componentIds: [component.id],
          }),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/admin/incidents/:id", () => {
    test("deletes incident", async () => {
      const { rawKey } = await createTestApiKey();
      const incident = await createTestIncident();

      const res = await app.request(`/api/v1/admin/incidents/${incident.id}`, {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify incident is deleted
      const getRes = await app.request(`/api/v1/admin/incidents/${incident.id}`, {
        headers: authHeader(rawKey),
      });
      expect(getRes.status).toBe(404);
    });

    test("returns 404 for non-existent incident", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/incidents/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });
  });
});
