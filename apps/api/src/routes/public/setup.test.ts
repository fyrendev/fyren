import { describe, expect, test } from "bun:test";
import { createTestApp, createTestOrganization, createTestUser, setupTestHooks } from "../../test";

describe("Setup API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/setup/status", () => {
    test("returns needsSetup: true when no organization exists", async () => {
      const res = await app.request("/api/v1/setup/status");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.needsSetup).toBe(true);
      expect(data.hasOrganization).toBe(false);
      expect(data.hasUsers).toBe(false);
    });

    test("returns needsSetup: true when only users exist", async () => {
      await createTestUser();

      const res = await app.request("/api/v1/setup/status");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.needsSetup).toBe(true);
      expect(data.hasOrganization).toBe(false);
      expect(data.hasUsers).toBe(true);
    });

    test("returns needsSetup: false when organization exists", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request("/api/v1/setup/status");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.needsSetup).toBe(false);
      expect(data.hasOrganization).toBe(true);
    });
  });
});
