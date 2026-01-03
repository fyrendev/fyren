import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestOrganization,
  createTestApiKey,
  createTestComponent,
  createTestSubscriberGroup,
  createTestSubscriber,
  jsonAuthHeaders,
  authHeader,
} from "../../test";

describe("Admin Subscriber Groups API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/admin/subscriber-groups", () => {
    test("lists all subscriber groups for organization", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      await createTestSubscriberGroup(org.id, { name: "Acme Corp" });
      await createTestSubscriberGroup(org.id, { name: "Beta Inc" });

      const res = await app.request("/api/v1/admin/subscriber-groups", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscriberGroups).toHaveLength(2);
      const names = data.subscriberGroups.map((g: { name: string }) => g.name);
      expect(names).toContain("Acme Corp");
      expect(names).toContain("Beta Inc");
    });

    test("includes member count for each group", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const group = await createTestSubscriberGroup(org.id, { name: "Acme Corp" });
      await createTestSubscriber(org.id, { groupId: group.id });
      await createTestSubscriber(org.id, { groupId: group.id });

      const res = await app.request("/api/v1/admin/subscriber-groups", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscriberGroups).toHaveLength(1);
      expect(data.subscriberGroups[0].memberCount).toBe(2);
    });

    test("returns empty array when no groups exist", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request("/api/v1/admin/subscriber-groups", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscriberGroups).toHaveLength(0);
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/subscriber-groups");

      expect(res.status).toBe(401);
    });

    test("only returns groups for authenticated organization", async () => {
      const org1 = await createTestOrganization({ slug: "org-1" });
      const org2 = await createTestOrganization({ slug: "org-2" });
      const { rawKey } = await createTestApiKey(org1.id);

      await createTestSubscriberGroup(org1.id, { name: "Org1 Group" });
      await createTestSubscriberGroup(org2.id, { name: "Org2 Group" });

      const res = await app.request("/api/v1/admin/subscriber-groups", {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscriberGroups).toHaveLength(1);
      expect(data.subscriberGroups[0].name).toBe("Org1 Group");
    });
  });

  describe("GET /api/v1/admin/subscriber-groups/:id", () => {
    test("returns subscriber group by ID", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const group = await createTestSubscriberGroup(org.id, {
        name: "Acme Corp",
        description: "Acme Corporation customers",
      });

      const res = await app.request(`/api/v1/admin/subscriber-groups/${group.id}`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscriberGroup.id).toBe(group.id);
      expect(data.subscriberGroup.name).toBe("Acme Corp");
      expect(data.subscriberGroup.description).toBe("Acme Corporation customers");
    });

    test("includes member count", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const group = await createTestSubscriberGroup(org.id, { name: "Acme Corp" });
      await createTestSubscriber(org.id, { groupId: group.id });
      await createTestSubscriber(org.id, { groupId: group.id });
      await createTestSubscriber(org.id, { groupId: group.id });

      const res = await app.request(`/api/v1/admin/subscriber-groups/${group.id}`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscriberGroup.memberCount).toBe(3);
    });

    test("returns 404 for non-existent group", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(
        "/api/v1/admin/subscriber-groups/00000000-0000-0000-0000-000000000000",
        {
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });

    test("returns 403 for group from different organization", async () => {
      const org1 = await createTestOrganization({ slug: "org-1" });
      const org2 = await createTestOrganization({ slug: "org-2" });
      const { rawKey } = await createTestApiKey(org1.id);
      const group = await createTestSubscriberGroup(org2.id, { name: "Other Org Group" });

      const res = await app.request(`/api/v1/admin/subscriber-groups/${group.id}`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/v1/admin/subscriber-groups", () => {
    test("creates a new subscriber group", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request("/api/v1/admin/subscriber-groups", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "Acme Corp",
          description: "Acme Corporation customers",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.subscriberGroup.name).toBe("Acme Corp");
      expect(data.subscriberGroup.description).toBe("Acme Corporation customers");
      expect(data.subscriberGroup.id).toBeDefined();
      expect(data.subscriberGroup.memberCount).toBe(0);
    });

    test("creates group with component filter", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const comp1 = await createTestComponent(org.id, { name: "API" });
      const comp2 = await createTestComponent(org.id, { name: "Database" });

      const res = await app.request("/api/v1/admin/subscriber-groups", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "API Customers",
          componentIds: [comp1.id, comp2.id],
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.subscriberGroup.componentIds).toHaveLength(2);
      expect(data.subscriberGroup.componentIds).toContain(comp1.id);
      expect(data.subscriberGroup.componentIds).toContain(comp2.id);
    });

    test("creates group with null componentIds (subscribed to all)", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request("/api/v1/admin/subscriber-groups", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "All Components Group",
          componentIds: null,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.subscriberGroup.componentIds).toBeNull();
    });

    test("returns 400 for missing name", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request("/api/v1/admin/subscriber-groups", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          description: "No name provided",
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 400 for empty name", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request("/api/v1/admin/subscriber-groups", {
        method: "POST",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "",
        }),
      });

      expect(res.status).toBe(400);
    });

    test("returns 401 without authentication", async () => {
      const res = await app.request("/api/v1/admin/subscriber-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Group",
        }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/v1/admin/subscriber-groups/:id", () => {
    test("updates subscriber group name", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const group = await createTestSubscriberGroup(org.id, { name: "Old Name" });

      const res = await app.request(`/api/v1/admin/subscriber-groups/${group.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          name: "New Name",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscriberGroup.name).toBe("New Name");
    });

    test("updates subscriber group description", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const group = await createTestSubscriberGroup(org.id, {
        name: "Test Group",
        description: "Old description",
      });

      const res = await app.request(`/api/v1/admin/subscriber-groups/${group.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          description: "New description",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscriberGroup.description).toBe("New description");
    });

    test("updates subscriber group componentIds", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const comp = await createTestComponent(org.id, { name: "API" });
      const group = await createTestSubscriberGroup(org.id, {
        name: "Test Group",
        componentIds: null,
      });

      const res = await app.request(`/api/v1/admin/subscriber-groups/${group.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          componentIds: [comp.id],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscriberGroup.componentIds).toEqual([comp.id]);
    });

    test("clears componentIds to subscribe to all", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const comp = await createTestComponent(org.id, { name: "API" });
      const group = await createTestSubscriberGroup(org.id, {
        name: "Test Group",
        componentIds: [comp.id],
      });

      const res = await app.request(`/api/v1/admin/subscriber-groups/${group.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({
          componentIds: null,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscriberGroup.componentIds).toBeNull();
    });

    test("returns 404 for non-existent group", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(
        "/api/v1/admin/subscriber-groups/00000000-0000-0000-0000-000000000000",
        {
          method: "PUT",
          headers: jsonAuthHeaders(rawKey),
          body: JSON.stringify({ name: "Updated" }),
        }
      );

      expect(res.status).toBe(404);
    });

    test("returns 403 for group from different organization", async () => {
      const org1 = await createTestOrganization({ slug: "org-1" });
      const org2 = await createTestOrganization({ slug: "org-2" });
      const { rawKey } = await createTestApiKey(org1.id);
      const group = await createTestSubscriberGroup(org2.id, { name: "Other Org Group" });

      const res = await app.request(`/api/v1/admin/subscriber-groups/${group.id}`, {
        method: "PUT",
        headers: jsonAuthHeaders(rawKey),
        body: JSON.stringify({ name: "Hijacked" }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/v1/admin/subscriber-groups/:id", () => {
    test("deletes empty subscriber group", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const group = await createTestSubscriberGroup(org.id, { name: "Empty Group" });

      const res = await app.request(`/api/v1/admin/subscriber-groups/${group.id}`, {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify group is deleted
      const getRes = await app.request(`/api/v1/admin/subscriber-groups/${group.id}`, {
        headers: authHeader(rawKey),
      });
      expect(getRes.status).toBe(404);
    });

    test("returns 400 when group has subscribers", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const group = await createTestSubscriberGroup(org.id, { name: "Non-empty Group" });
      await createTestSubscriber(org.id, { groupId: group.id });

      const res = await app.request(`/api/v1/admin/subscriber-groups/${group.id}`, {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain("Cannot delete group with");
    });

    test("returns 404 for non-existent group", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(
        "/api/v1/admin/subscriber-groups/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });

    test("returns 403 for group from different organization", async () => {
      const org1 = await createTestOrganization({ slug: "org-1" });
      const org2 = await createTestOrganization({ slug: "org-2" });
      const { rawKey } = await createTestApiKey(org1.id);
      const group = await createTestSubscriberGroup(org2.id, { name: "Other Org Group" });

      const res = await app.request(`/api/v1/admin/subscriber-groups/${group.id}`, {
        method: "DELETE",
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/admin/subscriber-groups/:id/members", () => {
    test("returns members of a subscriber group", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const group = await createTestSubscriberGroup(org.id, { name: "Acme Corp" });
      await createTestSubscriber(org.id, { email: "alice@acme.com", groupId: group.id });
      await createTestSubscriber(org.id, { email: "bob@acme.com", groupId: group.id });

      const res = await app.request(`/api/v1/admin/subscriber-groups/${group.id}/members`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscribers).toHaveLength(2);
      const emails = data.subscribers.map((s: { email: string }) => s.email);
      expect(emails).toContain("alice@acme.com");
      expect(emails).toContain("bob@acme.com");
    });

    test("returns empty array for group with no members", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const group = await createTestSubscriberGroup(org.id, { name: "Empty Group" });

      const res = await app.request(`/api/v1/admin/subscriber-groups/${group.id}/members`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscribers).toHaveLength(0);
    });

    test("returns subscriber details", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);
      const group = await createTestSubscriberGroup(org.id, { name: "Acme Corp" });
      await createTestSubscriber(org.id, {
        email: "alice@acme.com",
        groupId: group.id,
        verified: true,
        notifyOnIncident: true,
        notifyOnMaintenance: false,
      });

      const res = await app.request(`/api/v1/admin/subscriber-groups/${group.id}/members`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.subscribers).toHaveLength(1);
      expect(data.subscribers[0].email).toBe("alice@acme.com");
      expect(data.subscribers[0].verified).toBe(true);
      expect(data.subscribers[0].notifyOnIncident).toBe(true);
      expect(data.subscribers[0].notifyOnMaintenance).toBe(false);
    });

    test("returns 404 for non-existent group", async () => {
      const org = await createTestOrganization();
      const { rawKey } = await createTestApiKey(org.id);

      const res = await app.request(
        "/api/v1/admin/subscriber-groups/00000000-0000-0000-0000-000000000000/members",
        {
          headers: authHeader(rawKey),
        }
      );

      expect(res.status).toBe(404);
    });

    test("returns 403 for group from different organization", async () => {
      const org1 = await createTestOrganization({ slug: "org-1" });
      const org2 = await createTestOrganization({ slug: "org-2" });
      const { rawKey } = await createTestApiKey(org1.id);
      const group = await createTestSubscriberGroup(org2.id, { name: "Other Org Group" });

      const res = await app.request(`/api/v1/admin/subscriber-groups/${group.id}/members`, {
        headers: authHeader(rawKey),
      });

      expect(res.status).toBe(403);
    });
  });
});
