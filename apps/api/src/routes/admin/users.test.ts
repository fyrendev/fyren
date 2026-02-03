import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestMembership,
  signUpTestUser,
  jsonSessionHeaders,
  sessionCookieHeader,
} from "../../test";

describe("Admin Users API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/me", () => {
    test("returns current user with organizations", async () => {
      const org1 = await createTestOrganization({ name: "Org 1", slug: "org-1" });
      const org2 = await createTestOrganization({ name: "Org 2", slug: "org-2" });

      // Sign up creates both the user and a valid session
      const { user, token } = await signUpTestUser("user@example.com", undefined, "Test User");
      await createTestMembership(user.id, org1.id, "owner");
      await createTestMembership(user.id, org2.id, "member");

      const res = await app.request("/api/v1/admin/me", {
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.id).toBe(user.id);
      expect(data.user.email).toBe("user@example.com");
      expect(data.user.name).toBe("Test User");
      expect(data.organizations).toHaveLength(2);
      expect(data.organizations.map((o: { name: string }) => o.name)).toContain("Org 1");
      expect(data.organizations.map((o: { name: string }) => o.name)).toContain("Org 2");
    });

    test("includes role in organization list", async () => {
      const org = await createTestOrganization({ name: "My Org", slug: "my-org" });
      const { user, token } = await signUpTestUser("owner@example.com");
      await createTestMembership(user.id, org.id, "owner");

      const res = await app.request("/api/v1/admin/me", {
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const myOrg = data.organizations.find((o: { slug: string }) => o.slug === "my-org");
      expect(myOrg.role).toBe("owner");
    });

    test("returns user with no organizations", async () => {
      const { token } = await signUpTestUser("lonely@example.com");

      const res = await app.request("/api/v1/admin/me", {
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.email).toBe("lonely@example.com");
      expect(data.organizations).toHaveLength(0);
    });

    test("returns 401 without session", async () => {
      const res = await app.request("/api/v1/admin/me");

      expect(res.status).toBe(401);
    });

    test("returns 401 with invalid session token", async () => {
      const res = await app.request("/api/v1/admin/me", {
        headers: sessionCookieHeader("invalid-token"),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/v1/admin/me", () => {
    test("updates user name", async () => {
      const { token } = await signUpTestUser("update@example.com", undefined, "Original Name");

      const res = await app.request("/api/v1/admin/me", {
        method: "PUT",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({
          name: "Updated Name",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.name).toBe("Updated Name");
      expect(data.user.email).toBe("update@example.com"); // Email unchanged
    });

    test("returns updated timestamps", async () => {
      const { token } = await signUpTestUser(undefined, undefined, "Original");

      const res = await app.request("/api/v1/admin/me", {
        method: "PUT",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({
          name: "New Name",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.updatedAt).toBeDefined();
      expect(data.user.createdAt).toBeDefined();
    });

    test("returns 400 for empty name", async () => {
      const { token } = await signUpTestUser();

      const res = await app.request("/api/v1/admin/me", {
        method: "PUT",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({
          name: "", // Empty name
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 401 without session", async () => {
      const res = await app.request("/api/v1/admin/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Hacked",
        }),
      });

      expect(res.status).toBe(401);
    });

    test("ignores extra fields", async () => {
      const { token } = await signUpTestUser("original@example.com", undefined, "Original");

      const res = await app.request("/api/v1/admin/me", {
        method: "PUT",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({
          name: "New Name",
          email: "hacked@example.com", // Should be ignored
          id: "fake-id", // Should be ignored
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.name).toBe("New Name");
      expect(data.user.email).toBe("original@example.com"); // Email unchanged
    });
  });
});
