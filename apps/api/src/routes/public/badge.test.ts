import { describe, expect, test } from "bun:test";
import {
  createTestApp,
  createTestComponent,
  createTestOrganization,
  setupTestHooks,
} from "../../test";

describe("Badge API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/status/:slug/badge.svg", () => {
    test("returns SVG badge for operational status", async () => {
      const org = await createTestOrganization({ slug: "test-org" });
      await createTestComponent(org.id, { status: "operational", isPublic: true });

      const res = await app.request("/api/v1/status/test-org/badge.svg");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
      const svg = await res.text();
      expect(svg).toContain("<svg");
      expect(svg).toContain("Operational");
    });

    test("returns SVG badge showing degraded status", async () => {
      const org = await createTestOrganization({ slug: "test-org" });
      await createTestComponent(org.id, { status: "degraded", isPublic: true });

      const res = await app.request("/api/v1/status/test-org/badge.svg");

      expect(res.status).toBe(200);
      const svg = await res.text();
      expect(svg).toContain("Degraded");
    });

    test("returns SVG badge showing major outage status", async () => {
      const org = await createTestOrganization({ slug: "test-org" });
      await createTestComponent(org.id, { status: "operational", isPublic: true });
      await createTestComponent(org.id, { status: "major_outage", isPublic: true });

      const res = await app.request("/api/v1/status/test-org/badge.svg");

      expect(res.status).toBe(200);
      const svg = await res.text();
      expect(svg).toContain("Major Outage");
    });

    test("returns operational badge when no components exist", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request("/api/v1/status/test-org/badge.svg");

      expect(res.status).toBe(200);
      const svg = await res.text();
      expect(svg).toContain("Operational");
    });

    test("returns error badge for non-existent organization", async () => {
      const res = await app.request("/api/v1/status/nonexistent/badge.svg");

      expect(res.status).toBe(404);
      const svg = await res.text();
      expect(svg).toContain("unknown");
    });

    test("supports custom label via query param", async () => {
      const org = await createTestOrganization({ slug: "test-org" });
      await createTestComponent(org.id, { status: "operational", isPublic: true });

      const res = await app.request("/api/v1/status/test-org/badge.svg?label=uptime");

      expect(res.status).toBe(200);
      const svg = await res.text();
      expect(svg).toContain("uptime");
    });

    test("supports flat-square style", async () => {
      const org = await createTestOrganization({ slug: "test-org" });
      await createTestComponent(org.id, { status: "operational", isPublic: true });

      const res = await app.request("/api/v1/status/test-org/badge.svg?style=flat-square");

      expect(res.status).toBe(200);
      const svg = await res.text();
      // flat-square has rx="0" for corners
      expect(svg).toContain('rx="0"');
    });

    test("sets cache headers", async () => {
      const org = await createTestOrganization({ slug: "test-org" });
      await createTestComponent(org.id, { status: "operational", isPublic: true });

      const res = await app.request("/api/v1/status/test-org/badge.svg");

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toContain("max-age=60");
    });

    test("only considers public components", async () => {
      const org = await createTestOrganization({ slug: "test-org" });
      await createTestComponent(org.id, { status: "operational", isPublic: true });
      await createTestComponent(org.id, { status: "major_outage", isPublic: false });

      const res = await app.request("/api/v1/status/test-org/badge.svg");

      expect(res.status).toBe(200);
      const svg = await res.text();
      // Should show operational, not major outage (private component)
      expect(svg).toContain("Operational");
    });
  });

  describe("GET /api/v1/status/:slug/badge.json", () => {
    test("returns JSON badge data", async () => {
      const org = await createTestOrganization({
        slug: "test-org",
        name: "Test Organization",
      });
      await createTestComponent(org.id, { status: "operational", isPublic: true });

      const res = await app.request("/api/v1/status/test-org/badge.json");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.schemaVersion).toBe(1);
      expect(data.label).toBe("status");
      expect(data.message).toBe("Operational");
      expect(data.color).toBe("22c55e"); // Green without #
      expect(data.indicator).toBe("none");
      expect(data.page.name).toBe("Test Organization");
    });

    test("returns degraded indicator for degraded status", async () => {
      const org = await createTestOrganization({ slug: "test-org" });
      await createTestComponent(org.id, { status: "degraded", isPublic: true });

      const res = await app.request("/api/v1/status/test-org/badge.json");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.indicator).toBe("minor");
    });

    test("returns 404 for non-existent organization", async () => {
      const res = await app.request("/api/v1/status/nonexistent/badge.json");

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/status/:slug/badge", () => {
    test("redirects to SVG endpoint", async () => {
      const org = await createTestOrganization({ slug: "test-org" });
      await createTestComponent(org.id, { status: "operational", isPublic: true });

      const res = await app.request("/api/v1/status/test-org/badge", {
        redirect: "manual",
      });

      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toContain("/badge.svg");
    });

    test("preserves query params in redirect", async () => {
      const org = await createTestOrganization({ slug: "test-org" });
      await createTestComponent(org.id, { status: "operational", isPublic: true });

      const res = await app.request(
        "/api/v1/status/test-org/badge?style=flat-square&label=uptime",
        {
          redirect: "manual",
        }
      );

      expect(res.status).toBe(302);
      const location = res.headers.get("Location");
      expect(location).toContain("style=flat-square");
      expect(location).toContain("label=uptime");
    });
  });
});
