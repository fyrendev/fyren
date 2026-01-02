import { describe, expect, test } from "bun:test";
import { createTestApp, createTestOrganization, setupTestHooks } from "../../test";

describe("Widget API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/status/:slug/widget.js", () => {
    test("returns JavaScript widget loader", async () => {
      await createTestOrganization({
        slug: "test-org",
        name: "Test Organization",
      });

      const res = await app.request("/api/v1/status/test-org/widget.js");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/javascript");
      const js = await res.text();
      expect(js).toContain("Fyren Status Widget Loader");
      expect(js).toContain("Test Organization");
      expect(js).toContain("test-org");
      expect(js).toContain("FyrenWidget");
    });

    test("includes widget container selector", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request("/api/v1/status/test-org/widget.js");

      expect(res.status).toBe(200);
      const js = await res.text();
      expect(js).toContain("data-fyren-widget");
    });

    test("includes iframe creation code", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request("/api/v1/status/test-org/widget.js");

      expect(res.status).toBe(200);
      const js = await res.text();
      expect(js).toContain("createElement('iframe')");
    });

    test("includes resize message handler", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request("/api/v1/status/test-org/widget.js");

      expect(res.status).toBe(200);
      const js = await res.text();
      expect(js).toContain("fyren-resize");
      expect(js).toContain("addEventListener('message'");
    });

    test("returns 404 for non-existent organization", async () => {
      const res = await app.request("/api/v1/status/nonexistent/widget.js");

      expect(res.status).toBe(404);
      expect(res.headers.get("Content-Type")).toContain("application/javascript");
      const js = await res.text();
      expect(js).toContain("Organization not found");
    });

    test("sets cache headers", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request("/api/v1/status/test-org/widget.js");

      expect(res.status).toBe(200);
      // Cache headers are set - exact value may vary based on middleware
      expect(res.headers.get("Cache-Control")).toContain("max-age=");
    });

    test("includes MutationObserver for dynamic elements", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request("/api/v1/status/test-org/widget.js");

      expect(res.status).toBe(200);
      const js = await res.text();
      expect(js).toContain("MutationObserver");
    });
  });

  describe("GET /api/v1/status/:slug/embed.html", () => {
    test("returns embed code snippet page", async () => {
      await createTestOrganization({
        slug: "test-org",
        name: "Test Organization",
      });

      const res = await app.request("/api/v1/status/test-org/embed.html");

      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Embed Test Organization Status Widget");
    });

    test("includes widget script tag", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request("/api/v1/status/test-org/embed.html");

      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("/api/v1/status/test-org/widget.js");
    });

    test("includes badge markdown example", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request("/api/v1/status/test-org/embed.html");

      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("badge.svg");
      expect(html).toContain("Markdown");
    });

    test("includes badge HTML example", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request("/api/v1/status/test-org/embed.html");

      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("&lt;img src=");
      expect(html).toContain("&lt;a href=");
    });

    test("returns 404 for non-existent organization", async () => {
      const res = await app.request("/api/v1/status/nonexistent/embed.html");

      expect(res.status).toBe(404);
      const text = await res.text();
      expect(text).toContain("Organization not found");
    });
  });
});
