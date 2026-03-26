import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestApiKey,
  jsonAuthHeaders,
  authHeader,
} from "../../test";

describe("Admin API Keys API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/api-keys", () => {
    test("lists all API keys for organization", async () => {
      const { rawKey } = await createTestApiKey({ name: "Default Key" });
      await createTestApiKey({ name: "Secondary Key" });

      const res = await app.request("/api/v1/admin/api-keys", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.apiKeys).toHaveLength(2);
      expect(data.apiKeys.map((k: { name: string }) => k.name)).toContain("Default Key");
      expect(data.apiKeys.map((k: { name: string }) => k.name)).toContain("Secondary Key");
    });

    test("returns key prefix and scope but not full key hash", async () => {
      const { rawKey } = await createTestApiKey({ name: "Test Key" });

      const res = await app.request("/api/v1/admin/api-keys", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const key = data.apiKeys[0];
      expect(key.keyPrefix).toBeDefined();
      expect(key.keyPrefix.length).toBeLessThan(20); // Prefix is short
      expect(key.keyHash).toBeUndefined(); // Hash should not be exposed
      expect(key.scope).toBeDefined();
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/api-keys");
      expect(res.status).toBe(401);
    });

    test("includes timestamps in response", async () => {
      const { rawKey } = await createTestApiKey();

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
      const { rawKey } = await createTestApiKey();

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
      expect(data.plainKey).toBeDefined(); // Raw key returned only on creation
      expect(data.plainKey.length).toBeGreaterThan(20); // Full key is long
    });

    test("creates API key with expiration date", async () => {
      const { rawKey } = await createTestApiKey();
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
      const { rawKey } = await createTestApiKey();

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
      const { rawKey } = await createTestApiKey({ name: "Primary Key" });
      const { apiKey: secondaryKey } = await createTestApiKey({ name: "Secondary Key" });

      const res = await app.request(`/api/v1/admin/api-keys/${secondaryKey.id}`, {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("cannot delete the key used for the current request", async () => {
      const { rawKey, apiKey } = await createTestApiKey();

      const res = await app.request(`/api/v1/admin/api-keys/${apiKey.id}`, {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.message).toContain("Cannot delete the API key being used");
    });

    test("returns 404 for non-existent API key", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/api-keys/00000000-0000-0000-0000-000000000000", {
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

  describe("API Key Scopes", () => {
    test("creates API key with default scope (read-write)", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/api-keys", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({ name: "Default Scope Key" }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.apiKey.scope).toBe("read-write");
    });

    test("creates API key with explicit scope", async () => {
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/api-keys", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({ name: "Read Only Key", scope: "read" }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.apiKey.scope).toBe("read");
    });

    test("read scope key can GET admin endpoints", async () => {
      const { rawKey } = await createTestApiKey({ scope: "read" });

      const res = await app.request("/api/v1/admin/components", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
    });

    test("read scope key cannot POST to admin endpoints (enforceApiKeyScope)", async () => {
      const { rawKey } = await createTestApiKey({ scope: "read" });

      const res = await app.request("/api/v1/admin/components", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({ name: "Test Component" }),
      });

      expect(res.status).toBe(403);
    });

    test("read-write scope key can POST to operational endpoints", async () => {
      const { rawKey } = await createTestApiKey({ scope: "read-write" });

      const res = await app.request("/api/v1/admin/components", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({ name: "Test Component" }),
      });

      // Should not be 403 (may be 201 or 400 depending on validation, but not forbidden)
      expect(res.status).not.toBe(403);
    });

    test("read-write scope key cannot access owner-only routes", async () => {
      const { rawKey } = await createTestApiKey({ scope: "read-write" });

      const res = await app.request("/api/v1/admin/system/logging", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(403);
    });

    test("full-access scope key can access owner-only routes", async () => {
      const { rawKey } = await createTestApiKey({ scope: "full-access" });

      const res = await app.request("/api/v1/admin/system/logging", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
    });

    test("only full-access key can create full-access keys", async () => {
      const { rawKey } = await createTestApiKey({ scope: "read-write" });

      const res = await app.request("/api/v1/admin/api-keys", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({ name: "Escalation Attempt", scope: "full-access" }),
      });

      expect(res.status).toBe(403);
    });

    test("full-access key can create full-access keys", async () => {
      const { rawKey } = await createTestApiKey({ scope: "full-access" });

      const res = await app.request("/api/v1/admin/api-keys", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({ name: "Another Full Key", scope: "full-access" }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.apiKey.scope).toBe("full-access");
    });

    test("read scope key cannot access requireRole(owner, admin) routes (requireRole)", async () => {
      const { rawKey } = await createTestApiKey({ scope: "read" });

      const res = await app.request("/api/v1/admin/api-keys", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(403);
    });

    test("read-write key can create read-write keys", async () => {
      const { rawKey } = await createTestApiKey({ scope: "read-write" });

      const res = await app.request("/api/v1/admin/api-keys", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({ name: "Replicated Key", scope: "read-write" }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.apiKey.scope).toBe("read-write");
    });
  });
});
