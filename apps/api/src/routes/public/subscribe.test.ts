import { describe, test, expect, mock } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestSubscriber,
} from "../../test";

// Mock the email provider to avoid sending real emails
mock.module("../../lib/email", () => ({
  getEmailProviderForOrg: () => ({
    send: async () => ({ success: true }),
  }),
}));

describe("Public Subscribe API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("POST /api/v1/status/subscribe", () => {
    test("subscribes a new email", async () => {
      await createTestOrganization();

      const res = await app.request("/api/v1/status/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "new@example.com",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe("Verification email sent");
    });

    test("subscribes with component preferences", async () => {
      await createTestOrganization();

      const res = await app.request("/api/v1/status/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "selective@example.com",
          componentIds: ["00000000-0000-0000-0000-000000000001"],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe("Verification email sent");
    });

    test("returns message when already subscribed and verified", async () => {
      const org = await createTestOrganization();
      await createTestSubscriber(org.id, { email: "existing@example.com", verified: true });

      const res = await app.request("/api/v1/status/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "existing@example.com",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe("Already subscribed");
    });

    test("resends verification for unverified subscriber", async () => {
      const org = await createTestOrganization();
      await createTestSubscriber(org.id, { email: "unverified@example.com", verified: false });

      const res = await app.request("/api/v1/status/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "unverified@example.com",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe("Verification email sent");
    });

    test("returns 400 for invalid email", async () => {
      await createTestOrganization();

      const res = await app.request("/api/v1/status/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "not-an-email",
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 404 when no organization exists", async () => {
      // Don't create an organization

      const res = await app.request("/api/v1/status/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
        }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/status/subscribe/verify/:token", () => {
    test("verifies subscription with valid token", async () => {
      const org = await createTestOrganization();
      await createTestSubscriber(org.id, {
        email: "verify@example.com",
        verified: false,
        verificationToken: "valid-token-123",
      });

      const res = await app.request("/api/v1/status/subscribe/verify/valid-token-123");

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      const html = await res.text();
      expect(html).toContain("Subscription Confirmed");
    });

    test("returns already verified message for verified subscriber", async () => {
      const org = await createTestOrganization();
      await createTestSubscriber(org.id, {
        email: "verified@example.com",
        verified: true,
        verificationToken: "already-verified-token",
      });

      const res = await app.request("/api/v1/status/subscribe/verify/already-verified-token");

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      const html = await res.text();
      expect(html).toContain("Already Verified");
    });

    test("returns 400 for invalid token", async () => {
      await createTestOrganization();

      const res = await app.request("/api/v1/status/subscribe/verify/invalid-token");

      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toContain("text/html");
      const html = await res.text();
      expect(html).toContain("Invalid Link");
    });

    test("returns 404 when no organization exists", async () => {
      const res = await app.request("/api/v1/status/subscribe/verify/some-token");

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/status/unsubscribe/:token", () => {
    test("unsubscribes with valid token", async () => {
      const org = await createTestOrganization();
      await createTestSubscriber(org.id, {
        email: "unsubscribe@example.com",
        verified: true,
        unsubscribeToken: "unsub-token-123",
      });

      const res = await app.request("/api/v1/status/unsubscribe/unsub-token-123");

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      const html = await res.text();
      expect(html).toContain("Unsubscribed");
    });

    test("returns 400 for invalid token", async () => {
      await createTestOrganization();

      const res = await app.request("/api/v1/status/unsubscribe/invalid-token");

      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toContain("text/html");
      const html = await res.text();
      expect(html).toContain("Invalid Link");
    });

    test("returns 404 when no organization exists", async () => {
      const res = await app.request("/api/v1/status/unsubscribe/some-token");

      expect(res.status).toBe(404);
    });
  });
});
