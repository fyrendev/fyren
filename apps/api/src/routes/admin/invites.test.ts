import { describe, test, expect, mock } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestUser,
  signUpTestUser,
  createTestInvite,
  createTestApiKey,
  jsonSessionHeaders,
  sessionCookieHeader,
} from "../../test";

const mockSend = mock(() => Promise.resolve({ success: true }));

// Mock the email provider to avoid sending real emails
mock.module("../../lib/email", () => ({
  getEmailProvider: () => ({
    send: mockSend,
  }),
}));

describe("Admin Invites API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/organizations/invites", () => {
    test("lists pending invites for organization", async () => {
      await createTestOrganization();
      const { user: owner, token } = await signUpTestUser(
        "owner@example.com",
        undefined,
        undefined,
        "owner"
      );
      await createTestInvite(owner.id, { email: "invite1@example.com" });
      await createTestInvite(owner.id, { email: "invite2@example.com" });

      const res = await app.request("/api/v1/admin/organizations/invites", {
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.invites).toHaveLength(2);
      expect(data.invites.map((i: { email: string }) => i.email)).toContain("invite1@example.com");
      expect(data.invites.map((i: { email: string }) => i.email)).toContain("invite2@example.com");
    });

    test("includes invite details", async () => {
      await createTestOrganization();
      const { user: owner, token } = await signUpTestUser(
        "owner@example.com",
        undefined,
        "Owner",
        "owner"
      );
      await createTestInvite(owner.id, {
        email: "invitee@example.com",
        role: "admin",
      });

      const res = await app.request("/api/v1/admin/organizations/invites", {
        headers: sessionCookieHeader(token),
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
      await createTestOrganization();
      const { user: owner, token } = await signUpTestUser(undefined, undefined, undefined, "owner");
      await createTestInvite(owner.id, {
        email: "pending@example.com",
      });
      await createTestInvite(owner.id, {
        email: "accepted@example.com",
        acceptedAt: new Date(),
      });

      const res = await app.request("/api/v1/admin/organizations/invites", {
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.invites).toHaveLength(1);
      expect(data.invites[0].email).toBe("pending@example.com");
    });

    test("admin can list invites", async () => {
      await createTestOrganization();
      const owner = await createTestUser({}, "owner");
      const { token } = await signUpTestUser("admin@example.com", undefined, undefined, "admin");
      await createTestInvite(owner.id, { email: "test@example.com" });

      const res = await app.request("/api/v1/admin/organizations/invites", {
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
    });

    test("member cannot list invites", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser("member@example.com", undefined, undefined, "member");

      const res = await app.request("/api/v1/admin/organizations/invites", {
        headers: sessionCookieHeader(token),
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
      await createTestOrganization();
      const { token } = await signUpTestUser("owner@example.com", undefined, undefined, "owner");

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token),
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

    test("sends invite email on creation", async () => {
      await createTestOrganization({ name: "Acme Corp" });
      const { token } = await signUpTestUser("owner@example.com", undefined, "Alice", "owner");
      mockSend.mockClear();

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({
          email: "newuser@example.com",
          role: "member",
        }),
      });

      expect(res.status).toBe(201);
      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0] as unknown[];
      const emailArgs = call[0] as { to: string; subject: string; html: string; text: string };
      expect(emailArgs.to).toBe("newuser@example.com");
      expect(emailArgs.subject).toContain("Acme Corp");
      expect(emailArgs.html).toContain("Alice");
      expect(emailArgs.html).toContain("member");
      expect(emailArgs.text).toContain("/invites/");
    });

    test("owner can create invite for admin role", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser(undefined, undefined, undefined, "owner");

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token),
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
      await createTestOrganization();
      const { token } = await signUpTestUser("admin@example.com", undefined, undefined, "admin");

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token),
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
      await createTestOrganization();
      const { token } = await signUpTestUser("admin@example.com", undefined, undefined, "admin");

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({
          email: "newuser@example.com",
          role: "member",
        }),
      });

      expect(res.status).toBe(201);
    });

    test("returns 409 when user is already a member", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser("owner@example.com", undefined, undefined, "owner");
      await createTestUser({ email: "existing@example.com" }, "member");

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({
          email: "existing@example.com",
        }),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error.message).toContain("already a member");
    });

    test("returns 409 when invite already pending", async () => {
      await createTestOrganization();
      const { user: owner, token } = await signUpTestUser(undefined, undefined, undefined, "owner");
      await createTestInvite(owner.id, { email: "pending@example.com" });

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({
          email: "pending@example.com",
        }),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error.message).toContain("already pending");
    });

    test("replaces expired invite", async () => {
      await createTestOrganization();
      const { user: owner, token } = await signUpTestUser(undefined, undefined, undefined, "owner");
      await createTestInvite(owner.id, {
        email: "expired@example.com",
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
      });

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({
          email: "expired@example.com",
        }),
      });

      expect(res.status).toBe(201);
    });

    test("cannot create invite via API key", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

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
      await createTestOrganization();
      const { token } = await signUpTestUser(undefined, undefined, undefined, "owner");

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({
          email: "not-an-email",
        }),
      });

      expect(res.status).toBe(400);
    });

    test("member cannot create invites", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser("member@example.com", undefined, undefined, "member");

      const res = await app.request("/api/v1/admin/organizations/invites", {
        method: "POST",
        headers: jsonSessionHeaders(token),
        body: JSON.stringify({
          email: "test@example.com",
        }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/v1/admin/organizations/invites/:id", () => {
    test("owner can revoke invite", async () => {
      await createTestOrganization();
      const { user: owner, token } = await signUpTestUser(undefined, undefined, undefined, "owner");
      const invite = await createTestInvite(owner.id, { email: "revoke@example.com" });

      const res = await app.request(`/api/v1/admin/organizations/invites/${invite.id}`, {
        method: "DELETE",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("admin can revoke invite", async () => {
      await createTestOrganization();
      const owner = await createTestUser({}, "owner");
      const { token } = await signUpTestUser("admin@example.com", undefined, undefined, "admin");
      const invite = await createTestInvite(owner.id, { email: "revoke@example.com" });

      const res = await app.request(`/api/v1/admin/organizations/invites/${invite.id}`, {
        method: "DELETE",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(200);
    });

    test("member cannot revoke invite", async () => {
      await createTestOrganization();
      const owner = await createTestUser({}, "owner");
      const { token } = await signUpTestUser("member@example.com", undefined, undefined, "member");
      const invite = await createTestInvite(owner.id, { email: "test@example.com" });

      const res = await app.request(`/api/v1/admin/organizations/invites/${invite.id}`, {
        method: "DELETE",
        headers: sessionCookieHeader(token),
      });

      expect(res.status).toBe(403);
    });

    test("returns 404 for non-existent invite", async () => {
      await createTestOrganization();
      const { token } = await signUpTestUser(undefined, undefined, undefined, "owner");

      const res = await app.request(
        "/api/v1/admin/organizations/invites/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
          headers: sessionCookieHeader(token),
        }
      );

      expect(res.status).toBe(404);
    });
  });
});
