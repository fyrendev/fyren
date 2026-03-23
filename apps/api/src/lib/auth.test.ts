import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestUser,
  createTestInvite,
} from "../test";

describe("Auth signup hook", () => {
  setupTestHooks();

  const app = createTestApp();

  test("blocks signup without a pending invite", async () => {
    const res = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "random@example.com",
        password: "TestPass123!abc",
        name: "Random User",
      }),
    });

    expect(res.status).toBe(403);
  });

  test("allows signup with a valid pending invite", async () => {
    await createTestOrganization();
    const owner = await createTestUser({}, "owner");
    await createTestInvite(owner.id, {
      email: "invited@example.com",
    });

    const res = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "invited@example.com",
        password: "TestPass123!abc",
        name: "Invited User",
      }),
    });

    expect(res.status).toBe(200);
  });

  test("blocks signup with an expired invite", async () => {
    await createTestOrganization();
    const owner = await createTestUser({}, "owner");
    await createTestInvite(owner.id, {
      email: "expired@example.com",
      expiresAt: new Date(Date.now() - 86400000), // Yesterday
    });

    const res = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "expired@example.com",
        password: "TestPass123!abc",
        name: "Expired User",
      }),
    });

    expect(res.status).toBe(403);
  });

  test("blocks signup with an already accepted invite", async () => {
    await createTestOrganization();
    const owner = await createTestUser({}, "owner");
    await createTestInvite(owner.id, {
      email: "accepted@example.com",
      acceptedAt: new Date(),
    });

    const res = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "accepted@example.com",
        password: "TestPass123!abc",
        name: "Accepted User",
      }),
    });

    expect(res.status).toBe(403);
  });

  test("invite email matching is case-insensitive", async () => {
    await createTestOrganization();
    const owner = await createTestUser({}, "owner");
    await createTestInvite(owner.id, {
      email: "CaseTest@Example.com",
    });

    const res = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "casetest@example.com",
        password: "TestPass123!abc",
        name: "Case Test User",
      }),
    });

    expect(res.status).toBe(200);
  });
});
