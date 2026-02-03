import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestUser,
  createTestMembership,
  signUpTestUser,
  createTestApiKey,
  jsonSessionHeaders,
  sessionCookieHeader,
  authHeader,
} from "../../test";

describe("Admin Members API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/organizations/:orgId/members", () => {
    test("lists all members for organization", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser("owner@example.com", undefined, "Owner");
      const member = await createTestUser({ email: "member@example.com", name: "Member" });
      await createTestMembership(owner.id, org.id, "owner");
      await createTestMembership(member.id, org.id, "member");

      const res = await app.request(`/api/v1/admin/organizations/${org.id}/members`, {
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.members).toHaveLength(2);
      expect(data.members.map((m: { user: { email: string } }) => m.user.email)).toContain(
        "owner@example.com"
      );
      expect(data.members.map((m: { user: { email: string } }) => m.user.email)).toContain(
        "member@example.com"
      );
    });

    test("includes user info and role", async () => {
      const org = await createTestOrganization();
      const { user, token } = await signUpTestUser("test@example.com", undefined, "Test User");
      await createTestMembership(user.id, org.id, "admin");

      const res = await app.request(`/api/v1/admin/organizations/${org.id}/members`, {
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const member = data.members[0];
      expect(member.user.id).toBe(user.id);
      expect(member.user.email).toBe("test@example.com");
      expect(member.user.name).toBe("Test User");
      expect(member.role).toBe("admin");
      expect(member.createdAt).toBeDefined();
    });

    test("works with API key auth", async () => {
      const org = await createTestOrganization();
      const user = await createTestUser();
      await createTestMembership(user.id, org.id, "owner");
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(`/api/v1/admin/organizations/${org.id}/members`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.members.length).toBeGreaterThanOrEqual(1);
    });

    test("returns 401 without authentication", async () => {
      const org = await createTestOrganization();

      const res = await app.request(`/api/v1/admin/organizations/${org.id}/members`);

      expect(res.status).toBe(401);
    });

    test("returns 403 for non-member", async () => {
      const org = await createTestOrganization();
      const { token } = await signUpTestUser(); // Not a member of org

      const res = await app.request(`/api/v1/admin/organizations/${org.id}/members`, {
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("PUT /api/v1/admin/organizations/:orgId/members/:id", () => {
    test("owner can update member role to admin", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser("owner@example.com");
      const member = await createTestUser({ email: "member@example.com" });
      await createTestMembership(owner.id, org.id, "owner");
      const membership = await createTestMembership(member.id, org.id, "member");

      const res = await app.request(
        `/api/v1/admin/organizations/${org.id}/members/${membership.id}`,
        {
          method: "PUT",
          headers: jsonSessionHeaders(token),
          body: JSON.stringify({ role: "admin" }),
        }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.member.role).toBe("admin");
    });

    test("owner can demote admin to member", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser("owner@example.com");
      const admin = await createTestUser({ email: "admin@example.com" });
      await createTestMembership(owner.id, org.id, "owner");
      const membership = await createTestMembership(admin.id, org.id, "admin");

      const res = await app.request(
        `/api/v1/admin/organizations/${org.id}/members/${membership.id}`,
        {
          method: "PUT",
          headers: jsonSessionHeaders(token),
          body: JSON.stringify({ role: "member" }),
        }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.member.role).toBe("member");
    });

    test("admin can promote member to admin", async () => {
      const org = await createTestOrganization();
      const { user: admin, token } = await signUpTestUser("admin@example.com");
      const member = await createTestUser({ email: "member@example.com" });
      await createTestMembership(admin.id, org.id, "admin");
      const membership = await createTestMembership(member.id, org.id, "member");

      const res = await app.request(
        `/api/v1/admin/organizations/${org.id}/members/${membership.id}`,
        {
          method: "PUT",
          headers: jsonSessionHeaders(token),
          body: JSON.stringify({ role: "admin" }),
        }
      );

      expect(res.status).toBe(200);
    });

    test("admin cannot modify other admins", async () => {
      const org = await createTestOrganization();
      const { user: admin1, token } = await signUpTestUser("admin1@example.com");
      const admin2 = await createTestUser({ email: "admin2@example.com" });
      await createTestMembership(admin1.id, org.id, "admin");
      const membership = await createTestMembership(admin2.id, org.id, "admin");

      const res = await app.request(
        `/api/v1/admin/organizations/${org.id}/members/${membership.id}`,
        {
          method: "PUT",
          headers: jsonSessionHeaders(token),
          body: JSON.stringify({ role: "member" }),
        }
      );

      expect(res.status).toBe(403);
    });

    test("cannot change owner role", async () => {
      const org = await createTestOrganization();
      const owner = await createTestUser({ email: "owner@example.com" });
      const { user: admin, token } = await signUpTestUser("admin@example.com");
      const ownerMembership = await createTestMembership(owner.id, org.id, "owner");
      await createTestMembership(admin.id, org.id, "admin");

      const res = await app.request(
        `/api/v1/admin/organizations/${org.id}/members/${ownerMembership.id}`,
        {
          method: "PUT",
          headers: jsonSessionHeaders(token),
          body: JSON.stringify({ role: "member" }),
        }
      );

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.message).toContain("Cannot change owner");
    });

    test("member cannot change roles", async () => {
      const org = await createTestOrganization();
      const { user: member1, token } = await signUpTestUser("member1@example.com");
      const member2 = await createTestUser({ email: "member2@example.com" });
      await createTestMembership(member1.id, org.id, "member");
      const membership = await createTestMembership(member2.id, org.id, "member");

      const res = await app.request(
        `/api/v1/admin/organizations/${org.id}/members/${membership.id}`,
        {
          method: "PUT",
          headers: jsonSessionHeaders(token),
          body: JSON.stringify({ role: "admin" }),
        }
      );

      expect(res.status).toBe(403);
    });

    test("returns 404 for non-existent membership", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser();
      await createTestMembership(owner.id, org.id, "owner");

      const res = await app.request(
        `/api/v1/admin/organizations/${org.id}/members/00000000-0000-0000-0000-000000000000`,
        {
          method: "PUT",
          headers: jsonSessionHeaders(token),
          body: JSON.stringify({ role: "admin" }),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/admin/organizations/:orgId/members/:id", () => {
    test("owner can remove member", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser("owner@example.com");
      const member = await createTestUser({ email: "member@example.com" });
      await createTestMembership(owner.id, org.id, "owner");
      const membership = await createTestMembership(member.id, org.id, "member");

      const res = await app.request(
        `/api/v1/admin/organizations/${org.id}/members/${membership.id}`,
        {
          method: "DELETE",
          headers: sessionCookieHeader(token),
        }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("owner can remove admin", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser("owner@example.com");
      const admin = await createTestUser({ email: "admin@example.com" });
      await createTestMembership(owner.id, org.id, "owner");
      const membership = await createTestMembership(admin.id, org.id, "admin");

      const res = await app.request(
        `/api/v1/admin/organizations/${org.id}/members/${membership.id}`,
        {
          method: "DELETE",
          headers: sessionCookieHeader(token),
        }
      );

      expect(res.status).toBe(200);
    });

    test("admin can remove member", async () => {
      const org = await createTestOrganization();
      const { user: admin, token } = await signUpTestUser("admin@example.com");
      const member = await createTestUser({ email: "member@example.com" });
      await createTestMembership(admin.id, org.id, "admin");
      const membership = await createTestMembership(member.id, org.id, "member");

      const res = await app.request(
        `/api/v1/admin/organizations/${org.id}/members/${membership.id}`,
        {
          method: "DELETE",
          headers: sessionCookieHeader(token),
        }
      );

      expect(res.status).toBe(200);
    });

    test("admin cannot remove other admins", async () => {
      const org = await createTestOrganization();
      const { user: admin1, token } = await signUpTestUser("admin1@example.com");
      const admin2 = await createTestUser({ email: "admin2@example.com" });
      await createTestMembership(admin1.id, org.id, "admin");
      const membership = await createTestMembership(admin2.id, org.id, "admin");

      const res = await app.request(
        `/api/v1/admin/organizations/${org.id}/members/${membership.id}`,
        {
          method: "DELETE",
          headers: sessionCookieHeader(token),
        }
      );

      expect(res.status).toBe(403);
    });

    test("cannot remove owner", async () => {
      const org = await createTestOrganization();
      const owner = await createTestUser({ email: "owner@example.com" });
      const { user: admin, token } = await signUpTestUser("admin@example.com");
      const ownerMembership = await createTestMembership(owner.id, org.id, "owner");
      await createTestMembership(admin.id, org.id, "admin");

      const res = await app.request(
        `/api/v1/admin/organizations/${org.id}/members/${ownerMembership.id}`,
        {
          method: "DELETE",
          headers: sessionCookieHeader(token),
        }
      );

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.message).toContain("Cannot remove owner");
    });

    test("cannot remove yourself via this endpoint", async () => {
      const org = await createTestOrganization();
      const { user: admin, token } = await signUpTestUser("admin@example.com");
      const membership = await createTestMembership(admin.id, org.id, "admin");

      const res = await app.request(
        `/api/v1/admin/organizations/${org.id}/members/${membership.id}`,
        {
          method: "DELETE",
          headers: sessionCookieHeader(token),
        }
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain("leave endpoint");
    });

    test("returns 404 for non-existent membership", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser();
      await createTestMembership(owner.id, org.id, "owner");

      const res = await app.request(
        `/api/v1/admin/organizations/${org.id}/members/00000000-0000-0000-0000-000000000000`,
        {
          method: "DELETE",
          headers: sessionCookieHeader(token),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/admin/organizations/:orgId/leave", () => {
    test("member can leave organization", async () => {
      const org = await createTestOrganization();
      const owner = await createTestUser();
      const { user: member, token } = await signUpTestUser("member@example.com");
      await createTestMembership(owner.id, org.id, "owner");
      await createTestMembership(member.id, org.id, "member");

      const res = await app.request(`/api/v1/admin/organizations/${org.id}/leave`, {
        method: "POST",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("admin can leave organization", async () => {
      const org = await createTestOrganization();
      const owner = await createTestUser();
      const { user: admin, token } = await signUpTestUser("admin@example.com");
      await createTestMembership(owner.id, org.id, "owner");
      await createTestMembership(admin.id, org.id, "admin");

      const res = await app.request(`/api/v1/admin/organizations/${org.id}/leave`, {
        method: "POST",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
    });

    test("owner cannot leave organization", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser("owner@example.com");
      await createTestMembership(owner.id, org.id, "owner");

      const res = await app.request(`/api/v1/admin/organizations/${org.id}/leave`, {
        method: "POST",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.message).toContain("Owner cannot leave");
    });

    test("cannot leave via API key", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(`/api/v1/admin/organizations/${org.id}/leave`, {
        method: "POST",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(403);
    });

    test("returns 403 for non-member", async () => {
      const org = await createTestOrganization();
      const { token } = await signUpTestUser(); // Not a member

      const res = await app.request(`/api/v1/admin/organizations/${org.id}/leave`, {
        method: "POST",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(403);
    });
  });
});
