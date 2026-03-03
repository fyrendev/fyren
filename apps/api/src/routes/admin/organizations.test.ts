import { describe, test, expect, mock } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestApiKey,
  signUpTestUser,
  jsonAuthHeaders,
  authHeader,
  jsonSessionHeaders,
  sessionCookieHeader,
} from "../../test";

// Mock the email provider to avoid sending real emails
mock.module("../../lib/email", () => ({
  getEmailProvider: () => ({
    send: async () => ({ success: true }),
  }),
  clearProviderCache: () => {},
}));

describe("Admin Organizations API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("POST /api/v1/admin/organization", () => {
    test("creates a new organization", async () => {
      const res = await app.request("/api/v1/admin/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Company",
          slug: "new-company",
          timezone: "America/New_York",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.organization.name).toBe("New Company");
      expect(data.organization.slug).toBe("new-company");
      expect(data.organization.timezone).toBe("America/New_York");
      expect(data.organization.id).toBeDefined();
      expect(data.apiKey).toBeDefined(); // API key returned on creation
    });

    test("creates organization with default timezone", async () => {
      const res = await app.request("/api/v1/admin/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Default TZ Company",
          slug: "default-tz-company",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.organization.timezone).toBe("UTC");
    });

    test("creates organization with logged-in user as owner", async () => {
      const { token } = await signUpTestUser("owner@example.com");

      const res = await app.request("/api/v1/admin/organization", {
        method: "POST",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({
          name: "User's Company",
          slug: "users-company",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.organization.name).toBe("User's Company");
    });

    test("returns 400 for invalid slug format", async () => {
      const res = await app.request("/api/v1/admin/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Bad Slug Company",
          slug: "Bad Slug!", // Invalid characters
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 400 for missing required fields", async () => {
      const res = await app.request("/api/v1/admin/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Missing name and slug
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 400 for slug too short", async () => {
      const res = await app.request("/api/v1/admin/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Short Slug",
          slug: "ab", // Too short (min 3)
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 409 when organization already exists (single-tenant)", async () => {
      // Create first organization
      const res1 = await app.request("/api/v1/admin/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "First Org",
          slug: "first-org",
        }),
      });
      expect(res1.status).toBe(201);

      // Try to create a second organization
      const res2 = await app.request("/api/v1/admin/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Second Org",
          slug: "second-org",
        }),
      });
      expect(res2.status).toBe(409);
      const data = await res2.json();
      expect(data.error.message).toContain("already exists");
    });
  });

  describe("GET /api/v1/admin/organization", () => {
    test("returns current organization", async () => {
      const org = await createTestOrganization({
        name: "My Company",
        slug: "my-company",
        brandColor: "#FF5733",
      });
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/organization", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.organization.id).toBe(org.id);
      expect(data.organization.name).toBe("My Company");
      expect(data.organization.slug).toBe("my-company");
      expect(data.organization.brandColor).toBe("#FF5733");
    });

    test("returns 403 without authentication", async () => {
      const res = await app.request("/api/v1/admin/organization");

      expect(res.status).toBe(403);
    });
  });

  describe("PUT /api/v1/admin/organization", () => {
    test("updates organization name", async () => {
      await createTestOrganization({ name: "Original Name" });
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/organization", {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "Updated Name",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.organization.name).toBe("Updated Name");
    });

    test("updates branding settings", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/organization", {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          brandColor: "#FF5733",
          accentColor: "#3498DB",
          logoUrl: "https://example.com/logo.png",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.organization.brandColor).toBe("#FF5733");
      expect(data.organization.accentColor).toBe("#3498DB");
      expect(data.organization.logoUrl).toBe("https://example.com/logo.png");
    });

    test("updates SEO metadata", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/organization", {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          metaTitle: "Custom Status Page Title",
          metaDescription: "Monitor our service status in real-time",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.organization.metaTitle).toBe("Custom Status Page Title");
      expect(data.organization.metaDescription).toBe("Monitor our service status in real-time");
    });

    test("updates social and support settings", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/organization", {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          twitterHandle: "mycompany",
          supportUrl: "https://support.example.com",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.organization.supportUrl).toBe("https://support.example.com");
    });

    test("updates email provider settings", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/organization", {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          emailProvider: "console",
          emailFromAddress: "noreply@example.com",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.organization.emailProvider).toBe("console");
      expect(data.organization.emailFromAddress).toBe("noreply@example.com");
    });

    test("clears nullable fields with null", async () => {
      await createTestOrganization({
        brandColor: "#FF5733",
        logoUrl: "https://example.com/logo.png",
      });
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/organization", {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          brandColor: null,
          logoUrl: null,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.organization.brandColor).toBeNull();
      expect(data.organization.logoUrl).toBeNull();
    });

    test("returns 400 for invalid hex color", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/organization", {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          brandColor: "not-a-color",
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/admin/organization/test-email", () => {
    test("sends test email to current user", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser("test@example.com", undefined, undefined, "owner");

      const res = await app.request("/api/v1/admin/organization/test-email", {
        method: "POST",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain("test@example.com");
    });

    test("returns 403 without authentication", async () => {
      const res = await app.request("/api/v1/admin/organization/test-email", {
        method: "POST",
      });

      expect(res.status).toBe(403);
    });
  });
});
