import { describe, test, expect } from "bun:test";
import { db, users, eq } from "@fyrendev/db";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestUser,
  signUpTestUser,
  createTestApiKey,
  jsonSessionHeaders,
  sessionCookieHeader,
  authHeader,
} from "../../test";

describe("Admin Members API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/members", () => {
    test("lists all members for organization", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser("owner@example.com", undefined, "Owner", "owner");
      await createTestUser({ email: "member@example.com", name: "Member" }, "member");

      const res = await app.request("/api/v1/admin/members", {
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.members).toHaveLength(2);
      expect(data.members.map((m: { email: string }) => m.email)).toContain("owner@example.com");
      expect(data.members.map((m: { email: string }) => m.email)).toContain("member@example.com");
    });

    test("includes user info and role", async () => {
      await createTestOrganization();
      const { user, token } = await signUpTestUser(
        "test@example.com",
        undefined,
        "Test User",
        "admin"
      );

      const res = await app.request("/api/v1/admin/members", {
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const member = data.members.find((m: { id: string }) => m.id === user.id);
      expect(member.id).toBe(user.id);
      expect(member.email).toBe("test@example.com");
      expect(member.name).toBe("Test User");
      expect(member.role).toBe("admin");
      expect(member.createdAt).toBeDefined();
    });

    test("works with API key auth", async () => {
      await createTestOrganization();
      await createTestUser({}, "owner");
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/members", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.members.length).toBeGreaterThanOrEqual(1);
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/members");

      expect(res.status).toBe(401);
    });

    test("returns 403 for non-member", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser(); // No role set

      const res = await app.request("/api/v1/admin/members", {
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("PUT /api/v1/admin/members/:id", () => {
    test("owner can update member role to admin", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser("owner@example.com", undefined, undefined, "owner");
      const member = await createTestUser({ email: "member@example.com" }, "member");

      const res = await app.request(`/api/v1/admin/members/${member.id}`, {
        method: "PUT",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({ role: "admin" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.member.role).toBe("admin");
    });

    test("owner can demote admin to member", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser("owner@example.com", undefined, undefined, "owner");
      const admin = await createTestUser({ email: "admin@example.com" }, "admin");

      const res = await app.request(`/api/v1/admin/members/${admin.id}`, {
        method: "PUT",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({ role: "member" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.member.role).toBe("member");
    });

    test("admin can promote member to admin", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser("admin@example.com", undefined, undefined, "admin");
      const member = await createTestUser({ email: "member@example.com" }, "member");

      const res = await app.request(`/api/v1/admin/members/${member.id}`, {
        method: "PUT",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({ role: "admin" }),
      });

      expect(res.status).toBe(200);
    });

    test("admin cannot modify other admins", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser("admin1@example.com", undefined, undefined, "admin");
      const admin2 = await createTestUser({ email: "admin2@example.com" }, "admin");

      const res = await app.request(`/api/v1/admin/members/${admin2.id}`, {
        method: "PUT",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({ role: "member" }),
      });

      expect(res.status).toBe(403);
    });

    test("cannot change owner role", async () => {
      await createTestOrganization();
      const owner = await createTestUser({ email: "owner@example.com" }, "owner");
      const { token } = await signUpTestUser("admin@example.com", undefined, undefined, "admin");

      const res = await app.request(`/api/v1/admin/members/${owner.id}`, {
        method: "PUT",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({ role: "member" }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.message).toContain("Cannot change owner");
    });

    test("member cannot change roles", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser("member1@example.com", undefined, undefined, "member");
      const member2 = await createTestUser({ email: "member2@example.com" }, "member");

      const res = await app.request(`/api/v1/admin/members/${member2.id}`, {
        method: "PUT",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({ role: "admin" }),
      });

      expect(res.status).toBe(403);
    });

    test("returns 404 for non-existent membership", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser(undefined, undefined, undefined, "owner");

      const res = await app.request("/api/v1/admin/members/00000000-0000-0000-0000-000000000000", {
        method: "PUT",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({ role: "admin" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/admin/members/:id", () => {
    test("owner can remove member and user still exists with null role", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser("owner@example.com", undefined, undefined, "owner");
      const member = await createTestUser({ email: "member@example.com" }, "member");

      const res = await app.request(`/api/v1/admin/members/${member.id}`, {
        method: "DELETE",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify user still exists but with null role
      const [removedUser] = await db.select().from(users).where(eq(users.id, member.id)).limit(1);
      expect(removedUser).toBeDefined();
      expect(removedUser!.role).toBeNull();
      expect(removedUser!.email).toBe("member@example.com");
    });

    test("owner can remove admin", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser("owner@example.com", undefined, undefined, "owner");
      const admin = await createTestUser({ email: "admin@example.com" }, "admin");

      const res = await app.request(`/api/v1/admin/members/${admin.id}`, {
        method: "DELETE",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
    });

    test("admin can remove member", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser("admin@example.com", undefined, undefined, "admin");
      const member = await createTestUser({ email: "member@example.com" }, "member");

      const res = await app.request(`/api/v1/admin/members/${member.id}`, {
        method: "DELETE",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
    });

    test("admin cannot remove other admins", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser("admin1@example.com", undefined, undefined, "admin");
      const admin2 = await createTestUser({ email: "admin2@example.com" }, "admin");

      const res = await app.request(`/api/v1/admin/members/${admin2.id}`, {
        method: "DELETE",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(403);
    });

    test("cannot remove owner", async () => {
      await createTestOrganization();
      const owner = await createTestUser({ email: "owner@example.com" }, "owner");
      const { token } = await signUpTestUser("admin@example.com", undefined, undefined, "admin");

      const res = await app.request(`/api/v1/admin/members/${owner.id}`, {
        method: "DELETE",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.message).toContain("Cannot remove owner");
    });

    test("cannot remove yourself via this endpoint", async () => {
      await createTestOrganization();
      const { user: admin, token } = await signUpTestUser(
        "admin@example.com",
        undefined,
        undefined,
        "admin"
      );

      const res = await app.request(`/api/v1/admin/members/${admin.id}`, {
        method: "DELETE",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain("leave endpoint");
    });

    test("returns 404 for non-existent membership", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser(undefined, undefined, undefined, "owner");

      const res = await app.request("/api/v1/admin/members/00000000-0000-0000-0000-000000000000", {
        method: "DELETE",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/admin/leave", () => {
    test("member can leave organization and user still exists with null role", async () => {
      await createTestOrganization();
      await createTestUser({}, "owner");
      const { user: memberUser, token } = await signUpTestUser(
        "member@example.com",
        undefined,
        undefined,
        "member"
      );

      const res = await app.request("/api/v1/admin/leave", {
        method: "POST",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify user still exists but with null role
      const [leftUser] = await db.select().from(users).where(eq(users.id, memberUser.id)).limit(1);
      expect(leftUser).toBeDefined();
      expect(leftUser!.role).toBeNull();
    });

    test("admin can leave organization", async () => {
      await createTestOrganization();
      await createTestUser({}, "owner");
      const { token } = await signUpTestUser("admin@example.com", undefined, undefined, "admin");

      const res = await app.request("/api/v1/admin/leave", {
        method: "POST",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
    });

    test("owner cannot leave organization", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser("owner@example.com", undefined, undefined, "owner");

      const res = await app.request("/api/v1/admin/leave", {
        method: "POST",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.message).toContain("Owner cannot leave");
    });

    test("cannot leave via API key", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

      const res = await app.request("/api/v1/admin/leave", {
        method: "POST",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(403);
    });

    test("returns 403 for non-member", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser(); // No role set

      const res = await app.request("/api/v1/admin/leave", {
        method: "POST",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(403);
    });
  });
});
