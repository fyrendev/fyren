import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestApiKey,
  createTestSystemSettings,
  jsonAuthHeaders,
  authHeader,
} from "../../test";

describe("Admin System API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/system/logging", () => {
    test("returns default logging config when no settings exist", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/system/logging", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.config).toBeDefined();
      expect(data.config.logProvider).toBe("console");
      expect(data.config.logLevel).toBe("info");
      expect(data.config.logServiceName).toBe("fyren-api");
      expect(data.config.lokiConfigured).toBe(false);
      expect(data.config.otlpConfigured).toBe(false);
      expect(data.currentSource).toBeDefined();
      expect(data.currentProvider).toBeDefined();
    });

    test("returns configured logging settings", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();
      await createTestSystemSettings({
        logProvider: "loki",
        logLevel: "debug",
        logServiceName: "test-service",
        lokiUrl: "https://loki.example.com",
      });

      const res = await app.request("/api/v1/admin/system/logging", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.config.logProvider).toBe("loki");
      expect(data.config.logLevel).toBe("debug");
      expect(data.config.logServiceName).toBe("test-service");
      expect(data.config.lokiUrl).toBe("https://loki.example.com");
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/system/logging");
      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/v1/admin/system/logging", () => {
    test("updates logging configuration", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/system/logging", {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          logProvider: "console",
          logLevel: "debug",
          logServiceName: "updated-service",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.config.logProvider).toBe("console");
      expect(data.config.logLevel).toBe("debug");
      expect(data.config.logServiceName).toBe("updated-service");
      expect(data.message).toContain("updated");
    });

    test("updates to loki provider with URL", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/system/logging", {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          logProvider: "loki",
          logLevel: "info",
          lokiUrl: "https://loki.example.com",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.config.logProvider).toBe("loki");
      expect(data.config.lokiUrl).toBe("https://loki.example.com");
    });

    test("returns 400 when loki provider missing URL", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/system/logging", {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          logProvider: "loki",
          logLevel: "info",
          // Missing lokiUrl
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test("returns 400 when otlp provider missing endpoint", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/system/logging", {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          logProvider: "otlp",
          logLevel: "info",
          // Missing otlpEndpoint
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test("returns 400 for invalid log level", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/system/logging", {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          logProvider: "console",
          logLevel: "invalid",
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/system/logging", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logProvider: "console",
          logLevel: "info",
        }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/admin/system/logging/test", () => {
    test("validates console provider configuration", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();
      await createTestSystemSettings({
        logProvider: "console",
        logLevel: "info",
      });

      const res = await app.request("/api/v1/admin/system/logging/test", {
        method: "POST",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain("Console");
    });

    test("validates loki provider configuration", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();
      await createTestSystemSettings({
        logProvider: "loki",
        logLevel: "info",
        lokiUrl: "https://loki.example.com",
      });

      const res = await app.request("/api/v1/admin/system/logging/test", {
        method: "POST",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain("Loki");
    });

    test("returns 400 when no configuration saved in DB", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();
      // Don't create any system settings - buildLoggerConfig returns null

      const res = await app.request("/api/v1/admin/system/logging/test", {
        method: "POST",
        headers: authHeader(rawKey),
      });

      // Should return 400 because no config was saved yet
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/system/logging/test", {
        method: "POST",
      });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/admin/system/logging/reload", () => {
    test("reloads logger from database configuration", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();
      await createTestSystemSettings({
        logProvider: "console",
        logLevel: "debug",
      });

      const res = await app.request("/api/v1/admin/system/logging/reload", {
        method: "POST",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.provider).toBe("console");
      expect(data.source).toBe("database");
    });

    test("falls back to env config when no db config", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();
      // Don't create system settings

      const res = await app.request("/api/v1/admin/system/logging/reload", {
        method: "POST",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      // With defaults, it should still create settings
      expect(["database", "env"]).toContain(data.source);
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/system/logging/reload", {
        method: "POST",
      });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/admin/system/logging/reset", () => {
    test("resets logger to environment configuration", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/system/logging/reset", {
        method: "POST",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.source).toBe("env");
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/system/logging/reset", {
        method: "POST",
      });

      expect(res.status).toBe(401);
    });
  });
});
