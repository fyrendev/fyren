import { describe, test, expect, mock } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestApiKey,
  createTestMembership,
  signUpTestUser,
  jsonAuthHeaders,
  authHeader,
  jsonSessionHeaders,
  sessionCookieHeader,
} from "../../test";

// Mock the email provider to avoid sending real emails
mock.module("../../lib/email", () => ({
  getEmailProviderForOrg: () => ({
    send: async () => ({ success: true }),
  }),
  clearProviderCache: () => {},
}));

describe("Admin Organizations API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("POST /api/v1/admin/organizations", () => {
    test("creates a new organization", async () => {
      const res = await app.request("/api/v1/admin/organizations", {
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
      const res = await app.request("/api/v1/admin/organizations", {
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

      const res = await app.request("/api/v1/admin/organizations", {
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
      const res = await app.request("/api/v1/admin/organizations", {
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
      const res = await app.request("/api/v1/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Missing name and slug
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 400 for slug too short", async () => {
      const res = await app.request("/api/v1/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Short Slug",
          slug: "ab", // Too short (min 3)
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/admin/organizations/:id", () => {
    test("returns organization by ID", async () => {
      const org = await createTestOrganization({
        name: "My Company",
        slug: "my-company",
        brandColor: "#FF5733",
      });
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(`/api/v1/admin/organizations/${org.id}`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.organization.id).toBe(org.id);
      expect(data.organization.name).toBe("My Company");
      expect(data.organization.slug).toBe("my-company");
      expect(data.organization.brandColor).toBe("#FF5733");
    });

    test("returns 403 when accessing different organization", async () => {
      const org1 = await createTestOrganization({ slug: "org-1" });
      const org2 = await createTestOrganization({ slug: "org-2" });
      const { rawKey } = await createTestApiKey(org1.id);

      const res = await app.request(`/api/v1/admin/organizations/${org2.id}`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(403);
    });

    test("returns 403 without authentication", async () => {
      const org = await createTestOrganization();

      const res = await app.request(`/api/v1/admin/organizations/${org.id}`);

      expect(res.status).toBe(403);
    });
  });

  describe("PUT /api/v1/admin/organizations/:id", () => {
    test("updates organization name", async () => {
      const org = await createTestOrganization({ name: "Original Name" });
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(`/api/v1/admin/organizations/${org.id}`, {
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
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(`/api/v1/admin/organizations/${org.id}`, {
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
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(`/api/v1/admin/organizations/${org.id}`, {
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
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(`/api/v1/admin/organizations/${org.id}`, {
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
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(`/api/v1/admin/organizations/${org.id}`, {
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
      const org = await createTestOrganization({
        brandColor: "#FF5733",
        logoUrl: "https://example.com/logo.png",
      });
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(`/api/v1/admin/organizations/${org.id}`, {
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
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(`/api/v1/admin/organizations/${org.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          brandColor: "not-a-color",
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 403 when updating different organization", async () => {
      const org1 = await createTestOrganization({ slug: "org-1" });
      const org2 = await createTestOrganization({ slug: "org-2" });
      const { rawKey } = await createTestApiKey(org1.id);

      const res = await app.request(`/api/v1/admin/organizations/${org2.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({ name: "Hacked" }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/v1/admin/organizations/:id/test-email", () => {
    test("sends test email to current user", async () => {
      const org = await createTestOrganization();
      const { user, token } = await signUpTestUser("test@example.com");
      await createTestMembership(user.id, org.id, "owner");

      const res = await app.request(`/api/v1/admin/organizations/${org.id}/test-email`, {
        method: "POST",
        headers: sessionCookieHeader(token, org.id),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain("test@example.com");
    });

    test("returns 403 when testing email for different organization", async () => {
      const org1 = await createTestOrganization({ slug: "org-1" });
      const org2 = await createTestOrganization({ slug: "org-2" });
      const { user, token } = await signUpTestUser("test@example.com");
      await createTestMembership(user.id, org1.id, "owner");

      // User is member of org1, but trying to access org2
      const res = await app.request(`/api/v1/admin/organizations/${org2.id}/test-email`, {
        method: "POST",
        headers: sessionCookieHeader(token, org2.id),
      });

      expect(res.status).toBe(403);
    });

    test("returns 403 without authentication", async () => {
      const org = await createTestOrganization();

      const res = await app.request(`/api/v1/admin/organizations/${org.id}/test-email`, {
        method: "POST",
      });

      expect(res.status).toBe(403);
    });
  });
});
