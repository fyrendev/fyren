import { describe, expect, test } from "bun:test";
import {
  createTestComponent,
  createTestOrganization,
  createTestSubscriber,
  createTestSubscriberGroup,
  setupTestHooks,
} from "../test";
import { SubscriberService, type SubscriberWithGroup } from "./subscriber.service";

describe("SubscriberService", () => {
  setupTestHooks();

  describe("resolveComponentFilter", () => {
    test("returns group componentIds when subscriber has a group", () => {
      const subscriberWithGroup: SubscriberWithGroup = {
        id: "sub-1",
        organizationId: "org-1",
        email: "test@example.com",
        verified: true,
        verifiedAt: new Date(),
        verificationToken: null,
        unsubscribeToken: "token",
        groupId: "group-1",
        componentIds: ["comp-1", "comp-2"], // Individual filter
        notifyOnIncident: true,
        notifyOnMaintenance: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        group: {
          id: "group-1",
          organizationId: "org-1",
          name: "Test Group",
          description: null,
          componentIds: ["comp-3"], // Group filter takes precedence
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const result = SubscriberService.resolveComponentFilter(subscriberWithGroup);
      expect(result).toEqual(["comp-3"]);
    });

    test("returns subscriber componentIds when no group", () => {
      const subscriberWithoutGroup: SubscriberWithGroup = {
        id: "sub-1",
        organizationId: "org-1",
        email: "test@example.com",
        verified: true,
        verifiedAt: new Date(),
        verificationToken: null,
        unsubscribeToken: "token",
        groupId: null,
        componentIds: ["comp-1", "comp-2"],
        notifyOnIncident: true,
        notifyOnMaintenance: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        group: null,
      };

      const result = SubscriberService.resolveComponentFilter(subscriberWithoutGroup);
      expect(result).toEqual(["comp-1", "comp-2"]);
    });

    test("returns null when group has null componentIds", () => {
      const subscriberWithGroup: SubscriberWithGroup = {
        id: "sub-1",
        organizationId: "org-1",
        email: "test@example.com",
        verified: true,
        verifiedAt: new Date(),
        verificationToken: null,
        unsubscribeToken: "token",
        groupId: "group-1",
        componentIds: ["comp-1"],
        notifyOnIncident: true,
        notifyOnMaintenance: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        group: {
          id: "group-1",
          organizationId: "org-1",
          name: "Test Group",
          description: null,
          componentIds: null, // Group subscribed to all
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const result = SubscriberService.resolveComponentFilter(subscriberWithGroup);
      expect(result).toBeNull();
    });
  });

  describe("shouldNotifyForComponents", () => {
    const baseSubscriber: SubscriberWithGroup = {
      id: "sub-1",
      organizationId: "org-1",
      email: "test@example.com",
      verified: true,
      verifiedAt: new Date(),
      verificationToken: null,
      unsubscribeToken: "token",
      groupId: null,
      componentIds: null,
      notifyOnIncident: true,
      notifyOnMaintenance: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      group: null,
    };

    test("returns true for global events regardless of filter", () => {
      const subscriber = {
        ...baseSubscriber,
        componentIds: ["comp-1"],
      };

      const result = SubscriberService.shouldNotifyForComponents(subscriber, ["comp-2"], true);
      expect(result).toBe(true);
    });

    test("returns true when subscriber has no component filter", () => {
      const subscriber = { ...baseSubscriber, componentIds: null };

      const result = SubscriberService.shouldNotifyForComponents(subscriber, ["comp-1"]);
      expect(result).toBe(true);
    });

    test("returns true when subscriber has empty component filter", () => {
      const subscriber = { ...baseSubscriber, componentIds: [] };

      const result = SubscriberService.shouldNotifyForComponents(subscriber, ["comp-1"]);
      expect(result).toBe(true);
    });

    test("returns true when event has no components", () => {
      const subscriber = { ...baseSubscriber, componentIds: ["comp-1"] };

      const result = SubscriberService.shouldNotifyForComponents(subscriber, undefined);
      expect(result).toBe(true);

      const result2 = SubscriberService.shouldNotifyForComponents(subscriber, []);
      expect(result2).toBe(true);
    });

    test("returns true when subscriber is subscribed to affected component", () => {
      const subscriber = { ...baseSubscriber, componentIds: ["comp-1", "comp-2"] };

      const result = SubscriberService.shouldNotifyForComponents(subscriber, ["comp-2", "comp-3"]);
      expect(result).toBe(true);
    });

    test("returns false when subscriber is not subscribed to any affected component", () => {
      const subscriber = { ...baseSubscriber, componentIds: ["comp-1", "comp-2"] };

      const result = SubscriberService.shouldNotifyForComponents(subscriber, ["comp-3", "comp-4"]);
      expect(result).toBe(false);
    });

    test("uses group componentIds when subscriber is in a group", () => {
      const subscriber: SubscriberWithGroup = {
        ...baseSubscriber,
        groupId: "group-1",
        componentIds: ["comp-1"], // Individual filter - should be ignored
        group: {
          id: "group-1",
          organizationId: "org-1",
          name: "Test Group",
          description: null,
          componentIds: ["comp-3"], // Group filter takes precedence
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      // comp-1 matches individual but not group
      const result1 = SubscriberService.shouldNotifyForComponents(subscriber, ["comp-1"]);
      expect(result1).toBe(false);

      // comp-3 matches group
      const result2 = SubscriberService.shouldNotifyForComponents(subscriber, ["comp-3"]);
      expect(result2).toBe(true);
    });
  });

  describe("getEligibleSubscribers", () => {
    test("returns only verified subscribers", async () => {
      const org = await createTestOrganization();
      await createTestSubscriber(org.id, { email: "verified@test.com", verified: true });
      await createTestSubscriber(org.id, { email: "unverified@test.com", verified: false });

      const result = await SubscriberService.getEligibleSubscribers({
        organizationId: org.id,
        eventType: "incident",
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.email).toBe("verified@test.com");
    });

    test("filters by incident notification preference", async () => {
      const org = await createTestOrganization();
      await createTestSubscriber(org.id, {
        email: "wants-incidents@test.com",
        notifyOnIncident: true,
      });
      await createTestSubscriber(org.id, {
        email: "no-incidents@test.com",
        notifyOnIncident: false,
      });

      const result = await SubscriberService.getEligibleSubscribers({
        organizationId: org.id,
        eventType: "incident",
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.email).toBe("wants-incidents@test.com");
    });

    test("filters by maintenance notification preference", async () => {
      const org = await createTestOrganization();
      await createTestSubscriber(org.id, {
        email: "wants-maintenance@test.com",
        notifyOnMaintenance: true,
      });
      await createTestSubscriber(org.id, {
        email: "no-maintenance@test.com",
        notifyOnMaintenance: false,
      });

      const result = await SubscriberService.getEligibleSubscribers({
        organizationId: org.id,
        eventType: "maintenance",
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.email).toBe("wants-maintenance@test.com");
    });

    test("filters by component subscription", async () => {
      const org = await createTestOrganization();
      const comp1 = await createTestComponent(org.id, { name: "API" });
      const comp2 = await createTestComponent(org.id, { name: "Database" });

      await createTestSubscriber(org.id, {
        email: "api-only@test.com",
        componentIds: [comp1.id],
      });
      await createTestSubscriber(org.id, {
        email: "db-only@test.com",
        componentIds: [comp2.id],
      });
      await createTestSubscriber(org.id, {
        email: "all@test.com",
        componentIds: null,
      });

      const result = await SubscriberService.getEligibleSubscribers({
        organizationId: org.id,
        eventType: "incident",
        componentIds: [comp1.id],
      });

      expect(result).toHaveLength(2);
      const emails = result.map((s) => s.email).sort();
      expect(emails).toEqual(["all@test.com", "api-only@test.com"]);
    });

    test("uses group component filter for subscribers in groups", async () => {
      const org = await createTestOrganization();
      const comp1 = await createTestComponent(org.id, { name: "API" });
      const comp2 = await createTestComponent(org.id, { name: "Database" });

      const group = await createTestSubscriberGroup(org.id, {
        name: "API Customers",
        componentIds: [comp1.id],
      });

      // Subscriber in group with individual filter (should be ignored)
      await createTestSubscriber(org.id, {
        email: "grouped@test.com",
        groupId: group.id,
        componentIds: [comp2.id], // Individual says DB, but group says API
      });

      // Individual subscriber to DB
      await createTestSubscriber(org.id, {
        email: "individual@test.com",
        componentIds: [comp2.id],
      });

      // Incident affects API
      const result = await SubscriberService.getEligibleSubscribers({
        organizationId: org.id,
        eventType: "incident",
        componentIds: [comp1.id],
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.email).toBe("grouped@test.com");
    });

    test("global events notify all subscribers regardless of component filter", async () => {
      const org = await createTestOrganization();
      const comp1 = await createTestComponent(org.id, { name: "API" });

      await createTestSubscriber(org.id, {
        email: "api-only@test.com",
        componentIds: [comp1.id],
      });

      // Global event with no component filter
      const result = await SubscriberService.getEligibleSubscribers({
        organizationId: org.id,
        eventType: "incident",
        isGlobalEvent: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.email).toBe("api-only@test.com");
    });

    test("includes group information in returned subscribers", async () => {
      const org = await createTestOrganization();
      const group = await createTestSubscriberGroup(org.id, { name: "Acme Corp" });

      await createTestSubscriber(org.id, {
        email: "grouped@test.com",
        groupId: group.id,
      });

      const result = await SubscriberService.getEligibleSubscribers({
        organizationId: org.id,
        eventType: "incident",
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.group).not.toBeNull();
      expect(result[0]!.group!.name).toBe("Acme Corp");
    });
  });

  describe("createManualSubscriber", () => {
    test("creates auto-verified subscriber", async () => {
      const org = await createTestOrganization();

      const subscriber = await SubscriberService.createManualSubscriber({
        organizationId: org.id,
        email: "manual@test.com",
      });

      expect(subscriber.email).toBe("manual@test.com");
      expect(subscriber.verified).toBe(true);
      expect(subscriber.verifiedAt).not.toBeNull();
      expect(subscriber.unsubscribeToken).toBeDefined();
    });

    test("creates subscriber with group assignment", async () => {
      const org = await createTestOrganization();
      const group = await createTestSubscriberGroup(org.id, { name: "Test Group" });

      const subscriber = await SubscriberService.createManualSubscriber({
        organizationId: org.id,
        email: "grouped@test.com",
        groupId: group.id,
      });

      expect(subscriber.groupId).toBe(group.id);
    });

    test("creates subscriber with component filter", async () => {
      const org = await createTestOrganization();
      const comp = await createTestComponent(org.id, { name: "API" });

      const subscriber = await SubscriberService.createManualSubscriber({
        organizationId: org.id,
        email: "filtered@test.com",
        componentIds: [comp.id],
      });

      expect(subscriber.componentIds).toEqual([comp.id]);
    });

    test("creates subscriber with custom notification preferences", async () => {
      const org = await createTestOrganization();

      const subscriber = await SubscriberService.createManualSubscriber({
        organizationId: org.id,
        email: "custom@test.com",
        notifyOnIncident: false,
        notifyOnMaintenance: true,
      });

      expect(subscriber.notifyOnIncident).toBe(false);
      expect(subscriber.notifyOnMaintenance).toBe(true);
    });

    test("defaults notification preferences to true", async () => {
      const org = await createTestOrganization();

      const subscriber = await SubscriberService.createManualSubscriber({
        organizationId: org.id,
        email: "default@test.com",
      });

      expect(subscriber.notifyOnIncident).toBe(true);
      expect(subscriber.notifyOnMaintenance).toBe(true);
    });
  });

  describe("updateSubscriber", () => {
    test("updates subscriber email", async () => {
      const org = await createTestOrganization();
      const subscriber = await createTestSubscriber(org.id, { email: "old@test.com" });

      const updated = await SubscriberService.updateSubscriber(subscriber.id, {
        email: "new@test.com",
      });

      expect(updated.email).toBe("new@test.com");
    });

    test("updates subscriber group", async () => {
      const org = await createTestOrganization();
      const group = await createTestSubscriberGroup(org.id, { name: "New Group" });
      const subscriber = await createTestSubscriber(org.id, { groupId: null });

      const updated = await SubscriberService.updateSubscriber(subscriber.id, {
        groupId: group.id,
      });

      expect(updated.groupId).toBe(group.id);
    });

    test("removes subscriber from group", async () => {
      const org = await createTestOrganization();
      const group = await createTestSubscriberGroup(org.id, { name: "Old Group" });
      const subscriber = await createTestSubscriber(org.id, { groupId: group.id });

      const updated = await SubscriberService.updateSubscriber(subscriber.id, {
        groupId: null,
      });

      expect(updated.groupId).toBeNull();
    });

    test("updates component filter", async () => {
      const org = await createTestOrganization();
      const comp = await createTestComponent(org.id, { name: "API" });
      const subscriber = await createTestSubscriber(org.id, { componentIds: null });

      const updated = await SubscriberService.updateSubscriber(subscriber.id, {
        componentIds: [comp.id],
      });

      expect(updated.componentIds).toEqual([comp.id]);
    });

    test("updates notification preferences", async () => {
      const org = await createTestOrganization();
      const subscriber = await createTestSubscriber(org.id, {
        notifyOnIncident: true,
        notifyOnMaintenance: true,
      });

      const updated = await SubscriberService.updateSubscriber(subscriber.id, {
        notifyOnIncident: false,
        notifyOnMaintenance: false,
      });

      expect(updated.notifyOnIncident).toBe(false);
      expect(updated.notifyOnMaintenance).toBe(false);
    });

    test("throws error for non-existent subscriber", async () => {
      await expect(
        SubscriberService.updateSubscriber("00000000-0000-0000-0000-000000000000", {
          email: "test@test.com",
        })
      ).rejects.toThrow("Subscriber not found");
    });
  });

  describe("getSubscriberWithGroup", () => {
    test("returns subscriber with group information", async () => {
      const org = await createTestOrganization();
      const group = await createTestSubscriberGroup(org.id, { name: "Acme Corp" });
      const subscriber = await createTestSubscriber(org.id, {
        email: "test@test.com",
        groupId: group.id,
      });

      const result = await SubscriberService.getSubscriberWithGroup(subscriber.id);

      expect(result).not.toBeNull();
      expect(result!.email).toBe("test@test.com");
      expect(result!.group).not.toBeNull();
      expect(result!.group!.name).toBe("Acme Corp");
    });

    test("returns subscriber without group", async () => {
      const org = await createTestOrganization();
      const subscriber = await createTestSubscriber(org.id, {
        email: "test@test.com",
        groupId: null,
      });

      const result = await SubscriberService.getSubscriberWithGroup(subscriber.id);

      expect(result).not.toBeNull();
      expect(result!.group).toBeNull();
    });

    test("returns null for non-existent subscriber", async () => {
      const result = await SubscriberService.getSubscriberWithGroup(
        "00000000-0000-0000-0000-000000000000"
      );

      expect(result).toBeNull();
    });
  });

  describe("getSubscribersWithGroups", () => {
    test("returns all subscribers for organization with groups", async () => {
      const org = await createTestOrganization();
      const group = await createTestSubscriberGroup(org.id, { name: "Acme Corp" });

      await createTestSubscriber(org.id, { email: "grouped@test.com", groupId: group.id });
      await createTestSubscriber(org.id, { email: "individual@test.com", groupId: null });

      const result = await SubscriberService.getSubscribersWithGroups(org.id);

      expect(result).toHaveLength(2);

      const grouped = result.find((s) => s.email === "grouped@test.com");
      const individual = result.find((s) => s.email === "individual@test.com");

      expect(grouped!.group).not.toBeNull();
      expect(grouped!.group!.name).toBe("Acme Corp");
      expect(individual!.group).toBeNull();
    });

    test("returns empty array when no subscribers", async () => {
      const org = await createTestOrganization();

      const result = await SubscriberService.getSubscribersWithGroups(org.id);

      expect(result).toHaveLength(0);
    });

    test("only returns subscribers for specified organization", async () => {
      const org1 = await createTestOrganization({ slug: "org-1" });
      const org2 = await createTestOrganization({ slug: "org-2" });

      await createTestSubscriber(org1.id, { email: "org1@test.com" });
      await createTestSubscriber(org2.id, { email: "org2@test.com" });

      const result = await SubscriberService.getSubscribersWithGroups(org1.id);

      expect(result).toHaveLength(1);
      expect(result[0]!.email).toBe("org1@test.com");
    });
  });
});
