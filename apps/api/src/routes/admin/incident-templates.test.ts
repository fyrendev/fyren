import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestApiKey,
  createTestComponent,
  createTestIncidentTemplate,
  jsonAuthHeaders,
  authHeader,
} from "../../test";

describe("Admin Incident Templates API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/incident-templates", () => {
    test("lists all templates for organization", async () => {
      const { rawKey } = await createTestApiKey();
      await createTestIncidentTemplate({ name: "Database Outage" });
      await createTestIncidentTemplate({ name: "API Failure" });

      const res = await app.request("/api/v1/admin/incident-templates", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.templates).toHaveLength(2);
      expect(data.templates.map((t: { name: string }) => t.name)).toContain("Database Outage");
      expect(data.templates.map((t: { name: string }) => t.name)).toContain("API Failure");
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/incident-templates");
      expect(res.status).toBe(401);
    });

    test("returns empty array when no templates exist", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/incident-templates", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.templates).toHaveLength(0);
    });
  });

  describe("GET /api/v1/admin/incident-templates/:id", () => {
    test("returns template by ID", async () => {
      const { rawKey } = await createTestApiKey();
      const template = await createTestIncidentTemplate({
        name: "Server Outage",
        title: "Server connectivity issues",
        severity: "critical",
        initialMessage: "We are investigating server issues",
      });

      const res = await app.request(`/api/v1/admin/incident-templates/${template.id}`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.template.id).toBe(template.id);
      expect(data.template.name).toBe("Server Outage");
      expect(data.template.title).toBe("Server connectivity issues");
      expect(data.template.severity).toBe("critical");
      expect(data.template.initialMessage).toBe("We are investigating server issues");
    });

    test("returns 404 for non-existent template", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/incident-templates/00000000-0000-0000-0000-000000000000",
        {
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/admin/incident-templates", () => {
    test("creates a new template", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/incident-templates", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "Network Issue",
          title: "Network connectivity problems",
          severity: "major",
          initialMessage: "We are investigating network issues",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.template.name).toBe("Network Issue");
      expect(data.template.title).toBe("Network connectivity problems");
      expect(data.template.severity).toBe("major");
      expect(data.template.initialMessage).toBe("We are investigating network issues");
      expect(data.template.id).toBeDefined();
    });

    test("creates template with default component IDs", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent({ name: "API Server" });

      const res = await app.request("/api/v1/admin/incident-templates", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "API Template",
          title: "API Issues",
          severity: "minor",
          defaultComponentIds: [component.id],
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.template.defaultComponentIds).toContain(component.id);
    });

    test("returns 400 for missing required fields", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/incident-templates", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          // Missing name and title
          severity: "major",
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/v1/admin/incident-templates/:id", () => {
    test("updates template fields", async () => {
      const { rawKey } = await createTestApiKey();
      const template = await createTestIncidentTemplate({
        name: "Original Name",
        title: "Original Title",
        severity: "minor",
      });

      const res = await app.request(`/api/v1/admin/incident-templates/${template.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "Updated Name",
          title: "Updated Title",
          severity: "critical",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.template.name).toBe("Updated Name");
      expect(data.template.title).toBe("Updated Title");
      expect(data.template.severity).toBe("critical");
    });

    test("returns 404 for non-existent template", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/incident-templates/00000000-0000-0000-0000-000000000000",
        {
          method: "PUT",
          headers: jsonAuthHeaders(rawKey),
          body: JSON.stringify({ name: "Updated" }),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/admin/incident-templates/:id", () => {
    test("deletes template", async () => {
      const { rawKey } = await createTestApiKey();
      const template = await createTestIncidentTemplate();

      const res = await app.request(`/api/v1/admin/incident-templates/${template.id}`, {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify template is deleted
      const getRes = await app.request(`/api/v1/admin/incident-templates/${template.id}`, {
        headers: authHeader(rawKey),
      });
      expect(getRes.status).toBe(404);
    });

    test("returns 404 for non-existent template", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/incident-templates/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/admin/incident-templates/:id/create-incident", () => {
    test("creates incident from template", async () => {
      const { rawKey } = await createTestApiKey();
      const template = await createTestIncidentTemplate({
        name: "DB Template",
        title: "Database Issues",
        severity: "major",
        initialMessage: "Database connectivity problems detected",
      });

      const res = await app.request(
        `/api/v1/admin/incident-templates/${template.id}/create-incident`,
        {
          method: "POST",
          headers: jsonAuthHeaders(rawKey),
          body: JSON.stringify({}),
        }
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.incident.title).toBe("Database Issues");
      expect(data.incident.severity).toBe("major");
      expect(data.incident.status).toBe("investigating");
    });

    test("creates incident from template with overrides", async () => {
      const { rawKey } = await createTestApiKey();
      const component = await createTestComponent({ name: "API Server" });
      const template = await createTestIncidentTemplate({
        name: "API Template",
        title: "API Issues",
        severity: "minor",
      });

      const res = await app.request(
        `/api/v1/admin/incident-templates/${template.id}/create-incident`,
        {
          method: "POST",
          headers: jsonAuthHeaders(rawKey),
          body: JSON.stringify({
            title: "Custom Title Override",
            message: "Custom initial message",
            componentIds: [component.id],
          }),
        }
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.incident.title).toBe("Custom Title Override");
    });

    test("returns 404 for non-existent template", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request(
        "/api/v1/admin/incident-templates/00000000-0000-0000-0000-000000000000/create-incident",
        {
          method: "POST",
          headers: jsonAuthHeaders(rawKey),
          body: JSON.stringify({}),
        }
      );

      expect(res.status).toBe(404);
    });
  });
});
