import { describe, expect, test } from "bun:test";
import { createTestApp, createTestOrganization, setupTestHooks } from "../../test";

describe("Public Organizations API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/org/default", () => {
    test("returns the first organization when one exists", async () => {
      await createTestOrganization({
        name: "First Organization",
      });
      await createTestOrganization({
        name: "Second Organization",
      });

      const res = await app.request("/api/v1/org/default");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.organization.name).toBe("First Organization");
    });

    test("returns faviconUrl when set", async () => {
      await createTestOrganization({
        name: "Favicon Org",
        faviconUrl: "https://example.com/favicon.png",
      });

      const res = await app.request("/api/v1/org/default");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.organization.faviconUrl).toBe("https://example.com/favicon.png");
    });

    test("returns null faviconUrl when not set", async () => {
      await createTestOrganization({
        name: "No Favicon Org",
      });

      const res = await app.request("/api/v1/org/default");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.organization.faviconUrl).toBeNull();
    });

    test("returns 404 when no organization exists", async () => {
      const res = await app.request("/api/v1/org/default");

      expect(res.status).toBe(404);
    });
  });
});
