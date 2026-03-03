import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  signUpTestUser,
  jsonSessionHeaders,
  sessionCookieHeader,
} from "../../test";

describe("Admin Users API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/me", () => {
    test("returns current user with organization", async () => {
      await createTestOrganization({ name: "My Org", slug: "my-org" });

      // Sign up creates both the user and a valid session
      const { user, token } = await signUpTestUser(
        "user@example.com",
        undefined,
        "Test User",
        "owner"
      );

      const res = await app.request("/api/v1/admin/me", {
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.id).toBe(user.id);
      expect(data.user.email).toBe("user@example.com");
      expect(data.user.name).toBe("Test User");
      expect(data.organization).toBeDefined();
      expect(data.organization.name).toBe("My Org");
      expect(data.organization.role).toBe("owner");
    });

    test("includes role in organization", async () => {
      await createTestOrganization({ name: "My Org", slug: "my-org" });
      const { token } = await signUpTestUser("owner@example.com", undefined, undefined, "owner");

      const res = await app.request("/api/v1/admin/me", {
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.organization.slug).toBe("my-org");
      expect(data.organization.role).toBe("owner");
    });

    test("returns user with no organization when none exists", async () => {
      const { token } = await signUpTestUser("lonely@example.com");

      const res = await app.request("/api/v1/admin/me", {
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.email).toBe("lonely@example.com");
      expect(data.organization).toBeNull();
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
