import { describe, test, expect } from "bun:test";
import { createTestApp } from "../test";

describe("Health API", () => {
  const app = createTestApp();

  describe("GET /health", () => {
    test("returns ok status", async () => {
      const res = await app.request("/health");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
      expect(data.timestamp).toBeDefined();
    });
  });

  describe("GET /health/db", () => {
    test("returns ok when database is healthy", async () => {
      const res = await app.request("/health/db");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
      expect(data.service).toBe("postgres");
      expect(data.timestamp).toBeDefined();
    });
  });

  describe("GET /health/redis", () => {
    test("returns ok when redis is healthy", async () => {
      const res = await app.request("/health/redis");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
      expect(data.service).toBe("redis");
      expect(data.timestamp).toBeDefined();
    });
  });

  describe("GET /health/ready", () => {
    test("returns combined readiness check", async () => {
      const res = await app.request("/health/ready");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
      expect(data.timestamp).toBeDefined();
      expect(data.checks).toBeDefined();
      expect(data.checks.database).toBeDefined();
      expect(data.checks.database.status).toBe("ok");
      expect(data.checks.database.latency).toBeDefined();
      expect(data.checks.redis).toBeDefined();
      expect(data.checks.redis.status).toBe("ok");
      expect(data.checks.redis.latency).toBeDefined();
    });
  });

  describe("GET /health/startup", () => {
    test("returns startup probe status", async () => {
      const res = await app.request("/health/startup");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
      expect(data.timestamp).toBeDefined();
    });
  });
});
