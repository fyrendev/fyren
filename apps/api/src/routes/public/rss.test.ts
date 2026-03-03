import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestIncident,
  createTestIncidentUpdate,
} from "../../test";

describe("Public RSS API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/status/rss", () => {
    test("returns valid RSS XML", async () => {
      await createTestOrganization({ name: "Test Company" });
      await createTestIncident({ title: "Server Outage" });

      const res = await app.request("/api/v1/status/rss");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/rss+xml");

      const xml = await res.text();
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<rss version="2.0"');
      expect(xml).toContain("<channel>");
      expect(xml).toContain("Test Company Status");
    });

    test("includes organization name in feed title", async () => {
      await createTestOrganization({ name: "Acme Corp" });

      const res = await app.request("/api/v1/status/rss");

      expect(res.status).toBe(200);
      const xml = await res.text();
      expect(xml).toContain("<title>Acme Corp Status</title>");
    });

    test("includes recent incidents as items", async () => {
      await createTestOrganization({ name: "Test Company" });
      await createTestIncident({ title: "Database Issues" });
      await createTestIncident({ title: "API Slowdown" });

      const res = await app.request("/api/v1/status/rss");

      expect(res.status).toBe(200);
      const xml = await res.text();
      expect(xml).toContain("<item>");
      expect(xml).toContain("Database Issues");
      expect(xml).toContain("API Slowdown");
    });

    test("includes incident status in item title", async () => {
      await createTestOrganization({ name: "Test Company" });
      await createTestIncident({
        title: "Network Outage",
        status: "investigating",
      });

      const res = await app.request("/api/v1/status/rss");

      expect(res.status).toBe(200);
      const xml = await res.text();
      expect(xml).toContain("Network Outage - investigating");
    });

    test("shows resolved status for resolved incidents", async () => {
      await createTestOrganization({ name: "Test Company" });
      await createTestIncident({
        title: "Resolved Issue",
        status: "resolved",
        resolvedAt: new Date(),
      });

      const res = await app.request("/api/v1/status/rss");

      expect(res.status).toBe(200);
      const xml = await res.text();
      expect(xml).toContain("Resolved Issue - Resolved");
    });

    test("includes latest update message in description", async () => {
      await createTestOrganization({ name: "Test Company" });
      const incident = await createTestIncident({ title: "Server Down" });
      await createTestIncidentUpdate(incident.id, { message: "We have identified the root cause" });

      const res = await app.request("/api/v1/status/rss");

      expect(res.status).toBe(200);
      const xml = await res.text();
      expect(xml).toContain("<description>");
      expect(xml).toContain("We have identified the root cause");
    });

    test("includes incident links", async () => {
      await createTestOrganization({ name: "Test Company" });
      const incident = await createTestIncident({ title: "Test Incident" });

      const res = await app.request("/api/v1/status/rss");

      expect(res.status).toBe(200);
      const xml = await res.text();
      expect(xml).toContain("<link>");
      expect(xml).toContain(`/incidents/${incident.id}`);
      expect(xml).toContain("<guid");
    });

    test("includes proper date formatting", async () => {
      await createTestOrganization({ name: "Test Company" });
      await createTestIncident({ title: "Test Incident" });

      const res = await app.request("/api/v1/status/rss");

      expect(res.status).toBe(200);
      const xml = await res.text();
      expect(xml).toContain("<pubDate>");
      expect(xml).toContain("<lastBuildDate>");
    });

    test("includes atom self link", async () => {
      await createTestOrganization({ name: "Test Company" });

      const res = await app.request("/api/v1/status/rss");

      expect(res.status).toBe(200);
      const xml = await res.text();
      expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
      expect(xml).toContain("<atom:link");
      expect(xml).toContain('type="application/rss+xml"');
    });

    test("sets proper cache headers", async () => {
      await createTestOrganization({ name: "Test Company" });

      const res = await app.request("/api/v1/status/rss");

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toContain("public");
      expect(res.headers.get("Cache-Control")).toContain("max-age=300");
    });

    test("escapes XML special characters", async () => {
      await createTestOrganization({ name: "Test & Company <Inc>" });
      await createTestIncident({ title: 'Issue with <script> & "quotes"' });

      const res = await app.request("/api/v1/status/rss");

      expect(res.status).toBe(200);
      const xml = await res.text();
      // Check that special characters are escaped
      expect(xml).toContain("&amp;");
      expect(xml).toContain("&lt;");
      expect(xml).toContain("&gt;");
    });

    test("returns 404 when no organization exists", async () => {
      // Don't create an organization

      const res = await app.request("/api/v1/status/rss");

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error.message).toBe("No organization configured");
    });

    test("returns empty feed when no incidents exist", async () => {
      await createTestOrganization({ name: "Test Company" });

      const res = await app.request("/api/v1/status/rss");

      expect(res.status).toBe(200);
      const xml = await res.text();
      expect(xml).toContain("<channel>");
      expect(xml).toContain("Test Company Status");
      // Should have channel but no items
      expect(xml).not.toContain("<item>");
    });
  });
});
