import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestUser,
  signUpTestUser,
  createTestInvite,
  sessionCookieHeader,
} from "../../test";

describe("Public Invites API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/invites/:token", () => {
    test("returns invite details for valid token", async () => {
      await createTestOrganization({ name: "Acme Corp", slug: "acme-corp" });
      const owner = await createTestUser({}, "owner");
      await createTestInvite(owner.id, {
        email: "invitee@example.com",
        role: "member",
        token: "valid-invite-token",
      });

      const res = await app.request("/api/v1/invites/valid-invite-token");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.invite.organization.name).toBe("Acme Corp");
      expect(data.invite.organization.slug).toBe("acme-corp");
      expect(data.invite.email).toBe("invitee@example.com");
      expect(data.invite.role).toBe("member");
      expect(data.invite.expiresAt).toBeDefined();
    });

    test("returns 404 for non-existent token", async () => {
      await createTestOrganization();

      const res = await app.request("/api/v1/invites/non-existent-token");

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error.message).toContain("not found");
    });

    test("returns 404 for already accepted invite", async () => {
      await createTestOrganization();
      const owner = await createTestUser({}, "owner");
      await createTestInvite(owner.id, {
        email: "accepted@example.com",
        token: "accepted-token",
        acceptedAt: new Date(), // Already accepted
      });

      const res = await app.request("/api/v1/invites/accepted-token");

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error.message).toContain("already used");
    });

    test("returns 400 for expired invite", async () => {
      await createTestOrganization();
      const owner = await createTestUser({}, "owner");
      await createTestInvite(owner.id, {
        email: "expired@example.com",
        token: "expired-token",
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
      });

      const res = await app.request("/api/v1/invites/expired-token");

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain("expired");
    });
  });

  describe("POST /api/v1/invites/:token/accept", () => {
    test("accepts invite and sets user role", async () => {
      await createTestOrganization({ name: "Acme Corp", slug: "acme-corp" });
      const owner = await createTestUser({}, "owner");

      // Sign up the invitee first
      const { token: sessionToken } = await signUpTestUser("invitee@example.com");

      // Create invite for that email
      await createTestInvite(owner.id, {
        email: "invitee@example.com",
        role: "member",
        token: "accept-token",
      });

      const res = await app.request("/api/v1/invites/accept-token/accept", {
        method: "POST",
        headers: sessionCookieHeader(sessionToken),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.organization.name).toBe("Acme Corp");
      expect(data.organization.slug).toBe("acme-corp");
      expect(data.role).toBe("member");
    });

    test("accepts invite with admin role", async () => {
      await createTestOrganization();
      const owner = await createTestUser({}, "owner");

      const { token: sessionToken } = await signUpTestUser("admin@example.com");
      await createTestInvite(owner.id, {
        email: "admin@example.com",
        role: "admin",
        token: "admin-token",
      });

      const res = await app.request("/api/v1/invites/admin-token/accept", {
        method: "POST",
        headers: sessionCookieHeader(sessionToken),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.role).toBe("admin");
    });

    test("returns 401 without session", async () => {
      await createTestOrganization();
      const owner = await createTestUser({}, "owner");
      await createTestInvite(owner.id, {
        email: "test@example.com",
        token: "no-session-token",
      });

      const res = await app.request("/api/v1/invites/no-session-token/accept", {
        method: "POST",
      });

      expect(res.status).toBe(401);
    });

    test("returns 404 for non-existent token", async () => {
      const { token: sessionToken } = await signUpTestUser();

      const res = await app.request("/api/v1/invites/non-existent-token/accept", {
        method: "POST",
        headers: sessionCookieHeader(sessionToken),
      });

      expect(res.status).toBe(404);
    });

    test("returns 404 for already accepted invite", async () => {
      await createTestOrganization();
      const owner = await createTestUser({}, "owner");

      const { token: sessionToken } = await signUpTestUser("already@example.com");
      await createTestInvite(owner.id, {
        email: "already@example.com",
        token: "already-accepted",
        acceptedAt: new Date(),
      });

      const res = await app.request("/api/v1/invites/already-accepted/accept", {
        method: "POST",
        headers: sessionCookieHeader(sessionToken),
      });

      expect(res.status).toBe(404);
    });

    test("returns 400 for expired invite", async () => {
      await createTestOrganization();
      const owner = await createTestUser({}, "owner");

      const { token: sessionToken } = await signUpTestUser("expired@example.com");
      await createTestInvite(owner.id, {
        email: "expired@example.com",
        token: "expired-accept-token",
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
      });

      const res = await app.request("/api/v1/invites/expired-accept-token/accept", {
        method: "POST",
        headers: sessionCookieHeader(sessionToken),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain("expired");
    });

    test("returns 403 when user email does not match invite", async () => {
      await createTestOrganization();
      const owner = await createTestUser({}, "owner");

      const { token: sessionToken } = await signUpTestUser("wrong@example.com");
      await createTestInvite(owner.id, {
        email: "correct@example.com", // Different email
        token: "wrong-user-token",
      });

      const res = await app.request("/api/v1/invites/wrong-user-token/accept", {
        method: "POST",
        headers: sessionCookieHeader(sessionToken),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.message).toContain("different email");
    });

    test("returns 409 when user is already a member", async () => {
      await createTestOrganization();
      const owner = await createTestUser({}, "owner");

      const { token: sessionToken } = await signUpTestUser(
        "existing@example.com",
        undefined,
        undefined,
        "member"
      ); // Already has a role
      await createTestInvite(owner.id, {
        email: "existing@example.com",
        token: "already-member-token",
      });

      const res = await app.request("/api/v1/invites/already-member-token/accept", {
        method: "POST",
        headers: sessionCookieHeader(sessionToken),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error.message).toContain("already a member");
    });

    test("email matching is case-insensitive", async () => {
      await createTestOrganization();
      const owner = await createTestUser({}, "owner");

      // BetterAuth normalizes emails to lowercase, so sign up with lowercase
      // but invite with mixed case to test the comparison
      const { token: sessionToken } = await signUpTestUser("casetest@example.com");
      await createTestInvite(owner.id, {
        email: "CASETEST@example.com", // Uppercase in invite
        token: "case-insensitive-token",
      });

      const res = await app.request("/api/v1/invites/case-insensitive-token/accept", {
        method: "POST",
        headers: sessionCookieHeader(sessionToken),
      });

      expect(res.status).toBe(200);
    });
  });
});
