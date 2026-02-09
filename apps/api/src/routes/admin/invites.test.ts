import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestUser,
  createTestMembership,
  signUpTestUser,
  createTestInvite,
  createTestApiKey,
  jsonSessionHeaders,
  sessionCookieHeader,
} from "../../test";

describe("Admin Invites API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/organizations/invites", () => {
    test("lists pending invites for organization", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser("owner@example.com");
      await createTestMembership(owner.id, org.id, "owner");
      await createTestInvite(org.id, owner.id, { email: "invite1@example.com" });
      await createTestInvite(org.id, owner.id, { email: "invite2@example.com" });

      const res = await app.request("/api/v1/admin/organizations/invites", {
        headers: sessionCookieHeader(token, org.id),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.invites).toHaveLength(2);
      expect(data.invites.map((i: { email: string }) => i.email)).toContain("invite1@example.com");
      expect(data.invites.map((i: { email: string }) => i.email)).toContain("invite2@example.com");
    });

    test("includes invite details", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser("owner@example.com", undefined, "Owner");
      await createTestMembership(owner.id, org.id, "owner");
      await createTestInvite(org.id, owner.id, {
        email: "invitee@example.com",
        role: "admin",
      });

      const res = await app.request("/api/v1/admin/organizations/invites", {
        headers: sessionCookieHeader(token, org.id),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const invite = data.invites[0];
      expect(invite.email).toBe("invitee@example.com");
      expect(invite.role).toBe("admin");
      expect(invite.invitedBy.email).toBe("owner@example.com");
      expect(invite.expiresAt).toBeDefined();
      expect(invite.createdAt).toBeDefined();
    });

    test("does not include accepted invites", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser();
      await createTestMembership(owner.id, org.id, "owner");
      await createTestInvite(org.id, owner.id, {
        email: "pending@example.com",
      });
      await createTestInvite(org.id, owner.id, {
        email: "accepted@example.com",
        acceptedAt: new Date(),
      });

      const res = await app.request("/api/v1/admin/organizations/invites", {
        headers: sessionCookieHeader(token, org.id),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.invites).toHaveLength(1);
      expect(data.invites[0].email).toBe("pending@example.com");
    });

    test("admin can list invites", async () => {
      const org = await createTestOrganization();
      const owner = await createTestUser();
      const { user: admin, token } = await signUpTestUser("admin@example.com");
      await createTestMembership(owner.id, org.id, "owner");
      await createTestMembership(admin.id, org.id, "admin");
      await createTestInvite(org.id, owner.id, { email: "test@example.com" });

      const res = await app.request("/api/v1/admin/organizations/invites", {
        headers: sessionCookieHeader(token, org.id),
      });

      expect(res.status).toBe(200);
    });

    test("member cannot list invites", async () => {
      const org = await createTestOrganization();
      const { user: member, token } = await signUpTestUser("member@example.com");
      await createTestMembership(member.id, org.id, "member");

      const res = await app.request("/api/v1/admin/organizations/invites", {
        headers: sessionCookieHeader(token, org.id),
      });

      expect(res.status).toBe(403);
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/organizations/invites");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/admin/organizations/invites", () => {
    test("owner can create invite for member role", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser("owner@example.com");
      await createTestMembership(owner.id, org.id, "owner");

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token, org.id),
        body: JSON.stringify({
          email: "newuser@example.com",
          role: "member",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.invite.email).toBe("newuser@example.com");
      expect(data.invite.role).toBe("member");
      expect(data.invite.id).toBeDefined();
      expect(data.invite.expiresAt).toBeDefined();
    });

    test("owner can create invite for admin role", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser();
      await createTestMembership(owner.id, org.id, "owner");

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token, org.id),
        body: JSON.stringify({
          email: "newadmin@example.com",
          role: "admin",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.invite.role).toBe("admin");
    });

    test("admin can only invite as member", async () => {
      const org = await createTestOrganization();
      const { user: admin, token } = await signUpTestUser("admin@example.com");
      await createTestMembership(admin.id, org.id, "admin");

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token, org.id),
        body: JSON.stringify({
          email: "newuser@example.com",
          role: "admin", // Trying to invite as admin
        }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.message).toContain("can only invite new members");
    });

    test("admin can invite as member", async () => {
      const org = await createTestOrganization();
      const { user: admin, token } = await signUpTestUser("admin@example.com");
      await createTestMembership(admin.id, org.id, "admin");

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token, org.id),
        body: JSON.stringify({
          email: "newuser@example.com",
          role: "member",
        }),
      });

      expect(res.status).toBe(201);
    });

    test("returns 409 when user is already a member", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser("owner@example.com");
      const existingMember = await createTestUser({ email: "existing@example.com" });
      await createTestMembership(owner.id, org.id, "owner");
      await createTestMembership(existingMember.id, org.id, "member");

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token, org.id),
        body: JSON.stringify({
          email: "existing@example.com",
        }),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error.message).toContain("already a member");
    });

    test("returns 409 when invite already pending", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser();
      await createTestMembership(owner.id, org.id, "owner");
      await createTestInvite(org.id, owner.id, { email: "pending@example.com" });

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token, org.id),
        body: JSON.stringify({
          email: "pending@example.com",
        }),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error.message).toContain("already pending");
    });

    test("replaces expired invite", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser();
      await createTestMembership(owner.id, org.id, "owner");
      await createTestInvite(org.id, owner.id, {
        email: "expired@example.com",
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
      });

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token, org.id),
        body: JSON.stringify({
          email: "expired@example.com",
        }),
      });

      expect(res.status).toBe(201);
    });

    test("cannot create invite via API key", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${rawKey}`,
        },
        body: JSON.stringify({
          email: "test@example.com",
        }),
      });

      expect(res.status).toBe(403);
    });

    test("returns 400 for invalid email", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser();
      await createTestMembership(owner.id, org.id, "owner");

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token, org.id),
        body: JSON.stringify({
          email: "not-an-email",
        }),
      });

      expect(res.status).toBe(400);
    });

    test("member cannot create invites", async () => {
      const org = await createTestOrganization();
      const { user: member, token } = await signUpTestUser("member@example.com");
      await createTestMembership(member.id, org.id, "member");

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token, org.id),
        body: JSON.stringify({
          email: "test@example.com",
        }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/v1/admin/organizations/invites/:id", () => {
    test("owner can revoke invite", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser();
      await createTestMembership(owner.id, org.id, "owner");
      const invite = await createTestInvite(org.id, owner.id, { email: "revoke@example.com" });

      const res = await app.request(`/api/v1/admin/organizations/invites/${invite.id}`, {
        method: "DELETE",
        headers: sessionCookieHeader(token, org.id),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("admin can revoke invite", async () => {
      const org = await createTestOrganization();
      const owner = await createTestUser();
      const { user: admin, token } = await signUpTestUser("admin@example.com");
      await createTestMembership(owner.id, org.id, "owner");
      await createTestMembership(admin.id, org.id, "admin");
      const invite = await createTestInvite(org.id, owner.id, { email: "revoke@example.com" });

      const res = await app.request(`/api/v1/admin/organizations/invites/${invite.id}`, {
        method: "DELETE",
        headers: sessionCookieHeader(token, org.id),
      });

      expect(res.status).toBe(200);
    });

    test("member cannot revoke invite", async () => {
      const org = await createTestOrganization();
      const owner = await createTestUser();
      const { user: member, token } = await signUpTestUser("member@example.com");
      await createTestMembership(owner.id, org.id, "owner");
      await createTestMembership(member.id, org.id, "member");
      const invite = await createTestInvite(org.id, owner.id, { email: "test@example.com" });

      const res = await app.request(`/api/v1/admin/organizations/invites/${invite.id}`, {
        method: "DELETE",
        headers: sessionCookieHeader(token, org.id),
      });

      expect(res.status).toBe(403);
    });

    test("returns 404 for non-existent invite", async () => {
      const org = await createTestOrganization();
      const { user: owner, token } = await signUpTestUser();
      await createTestMembership(owner.id, org.id, "owner");

      const res = await app.request(
        "/api/v1/admin/organizations/invites/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
          headers: sessionCookieHeader(token, org.id),
        }
      );

      expect(res.status).toBe(404);
    });

    test("returns 404 for invite from different organization", async () => {
      const org1 = await createTestOrganization({ slug: "org-1" });
      const org2 = await createTestOrganization({ slug: "org-2" });
      const { user: owner1, token } = await signUpTestUser("owner1@example.com");
      const owner2 = await createTestUser({ email: "owner2@example.com" });
      await createTestMembership(owner1.id, org1.id, "owner");
      await createTestMembership(owner2.id, org2.id, "owner");
      const invite = await createTestInvite(org2.id, owner2.id, { email: "test@example.com" });

      const res = await app.request(`/api/v1/admin/organizations/invites/${invite.id}`, {
        method: "DELETE",
        headers: sessionCookieHeader(token, org1.id),
      });

      expect(res.status).toBe(404);
    });
  });
});
