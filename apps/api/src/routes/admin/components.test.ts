import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestApiKey,
  createTestComponent,
  jsonAuthHeaders,
  authHeader,
} from "../../test";

describe("Admin Components API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/components", () => {
    test("lists all components for organization", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      await createTestComponent(org.id, { name: "API Server" });
      await createTestComponent(org.id, { name: "Database" });

      const res = await app.request("/api/v1/admin/components", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.components).toHaveLength(2);
      expect(data.components.map((c: { name: string }) => c.name)).toContain("API Server");
      expect(data.components.map((c: { name: string }) => c.name)).toContain("Database");
    });

    test("filters components by status", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      await createTestComponent(org.id, { name: "Healthy", status: "operational" });
      await createTestComponent(org.id, { name: "Degraded", status: "degraded" });

      const res = await app.request("/api/v1/admin/components?status=degraded", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.components).toHaveLength(1);
      expect(data.components[0].name).toBe("Degraded");
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/components");

      expect(res.status).toBe(401);
    });

    test("returns empty array when no components exist", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request("/api/v1/admin/components", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.components).toHaveLength(0);
    });
  });

  describe("POST /api/v1/admin/components", () => {
    test("creates a new component", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request("/api/v1/admin/components", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "New Component",
          description: "A new test component",
          status: "operational",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.component.name).toBe("New Component");
      expect(data.component.description).toBe("A new test component");
      expect(data.component.status).toBe("operational");
      expect(data.component.id).toBeDefined();
    });

    test("creates component with default status", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request("/api/v1/admin/components", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "Default Status Component",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.component.status).toBe("operational");
    });

    test("returns 400 for invalid data", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request("/api/v1/admin/components", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          // Missing required 'name' field
          description: "No name provided",
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });
  });

  describe("GET /api/v1/admin/components/:id", () => {
    test("returns component by ID", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const component = await createTestComponent(org.id, { name: "My Component" });

      const res = await app.request(`/api/v1/admin/components/${component.id}`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.component.id).toBe(component.id);
      expect(data.component.name).toBe("My Component");
    });

    test("returns 404 for non-existent component", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(
        "/api/v1/admin/components/00000000-0000-0000-0000-000000000000",
        {
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });

    test("returns 404 for component from different organization", async () => {
      const org1 = await createTestOrganization({ slug: "org-1" });
      const org2 = await createTestOrganization({ slug: "org-2" });
      const { rawKey } = await createTestApiKey(org1.id);
      const component = await createTestComponent(org2.id);

      const res = await app.request(`/api/v1/admin/components/${component.id}`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/v1/admin/components/:id", () => {
    test("updates component", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const component = await createTestComponent(org.id, { name: "Original" });

      const res = await app.request(`/api/v1/admin/components/${component.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "Updated Name",
          description: "Updated description",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.component.name).toBe("Updated Name");
      expect(data.component.description).toBe("Updated description");
    });

    test("returns 404 for non-existent component", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(
        "/api/v1/admin/components/00000000-0000-0000-0000-000000000000",
        {
          method: "PUT",
          headers: jsonAuthHeaders(rawKey),
          body: JSON.stringify({ name: "Updated" }),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/admin/components/:id/status", () => {
    test("updates component status", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const component = await createTestComponent(org.id, { status: "operational" });

      const res = await app.request(`/api/v1/admin/components/${component.id}/status`, {
        method: "PATCH",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({ status: "degraded" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.component.status).toBe("degraded");
    });

    test("returns 400 for invalid status", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const component = await createTestComponent(org.id);

      const res = await app.request(`/api/v1/admin/components/${component.id}/status`, {
        method: "PATCH",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({ status: "invalid_status" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/v1/admin/components/:id", () => {
    test("deletes component", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const component = await createTestComponent(org.id);

      const res = await app.request(`/api/v1/admin/components/${component.id}`, {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify component is deleted
      const getRes = await app.request(`/api/v1/admin/components/${component.id}`, {
        headers: authHeader(rawKey),
      });
      expect(getRes.status).toBe(404);
    });

    test("returns 404 for non-existent component", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(
        "/api/v1/admin/components/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });
  });
});
