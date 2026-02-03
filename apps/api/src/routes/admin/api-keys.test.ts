import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestApiKey,
  jsonAuthHeaders,
  authHeader,
} from "../../test";

describe("Admin API Keys API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/api-keys", () => {
    test("lists all API keys for organization", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id, { name: "Default Key" });
      await createTestApiKey(org.id, { name: "Secondary Key" });

      const res = await app.request("/api/v1/admin/api-keys", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.apiKeys).toHaveLength(2);
      expect(data.apiKeys.map((k: { name: string }) => k.name)).toContain("Default Key");
      expect(data.apiKeys.map((k: { name: string }) => k.name)).toContain("Secondary Key");
    });

    test("returns key prefix but not full key hash", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id, { name: "Test Key" });

      const res = await app.request("/api/v1/admin/api-keys", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const key = data.apiKeys[0];
      expect(key.keyPrefix).toBeDefined();
      expect(key.keyPrefix.length).toBeLessThan(20); // Prefix is short
      expect(key.keyHash).toBeUndefined(); // Hash should not be exposed
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/api-keys");
      expect(res.status).toBe(401);
    });

    test("includes timestamps in response", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request("/api/v1/admin/api-keys", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.apiKeys[0].createdAt).toBeDefined();
    });
  });

  describe("POST /api/v1/admin/api-keys", () => {
    test("creates a new API key", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request("/api/v1/admin/api-keys", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "New API Key",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.apiKey.name).toBe("New API Key");
      expect(data.apiKey.id).toBeDefined();
      expect(data.key).toBeDefined(); // Raw key returned only on creation
      expect(data.key.length).toBeGreaterThan(20); // Full key is long
    });

    test("creates API key with expiration date", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const expiresAt = new Date(Date.now() + 86400000 * 30); // 30 days

      const res = await app.request("/api/v1/admin/api-keys", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "Expiring Key",
          expiresAt: expiresAt.toISOString(),
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.apiKey.expiresAt).toBeDefined();
    });

    test("returns 400 for missing name", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request("/api/v1/admin/api-keys", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          // Missing name
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Key",
        }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/v1/admin/api-keys/:id", () => {
    test("deletes an API key", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id, { name: "Primary Key" });
      const { apiKey: secondaryKey } = await createTestApiKey(org.id, { name: "Secondary Key" });

      const res = await app.request(`/api/v1/admin/api-keys/${secondaryKey.id}`, {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("cannot delete the key used for the current request", async () => {
      const org = await createTestOrganization();
      const { rawKey, apiKey } = await createTestApiKey(org.id);

      const res = await app.request(`/api/v1/admin/api-keys/${apiKey.id}`, {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.message).toContain("Cannot delete the API key being used");
    });

    test("returns 404 for non-existent API key", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request("/api/v1/admin/api-keys/00000000-0000-0000-0000-000000000000", {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(404);
    });

    test("returns 404 for API key from different organization", async () => {
      const org1 = await createTestOrganization({ slug: "org-1" });
      const org2 = await createTestOrganization({ slug: "org-2" });
      const { rawKey } = await createTestApiKey(org1.id);
      const { apiKey: otherKey } = await createTestApiKey(org2.id);

      const res = await app.request(`/api/v1/admin/api-keys/${otherKey.id}`, {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(404);
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/api-keys/00000000-0000-0000-0000-000000000000", {
        method: "DELETE",
      });

      expect(res.status).toBe(401);
    });
  });
});
