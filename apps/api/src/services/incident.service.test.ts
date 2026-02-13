import { components, db, eq, incidentComponents, incidents, incidentUpdates } from "@fyrendev/db";
import { describe, expect, test } from "bun:test";
import {
  createTestComponent,
  createTestMonitor,
  createTestOrganization,
  setupTestHooks,
} from "../test";
import { IncidentService } from "./incident.service";

describe("IncidentService", () => {
  setupTestHooks();

  describe("create", () => {
    test("creates incident with initial update", async () => {
      await createTestOrganization();
      const component = await createTestComponent();

      const incident = await IncidentService.create({
        title: "API Outage",
        severity: "major",
        status: "investigating",
        message: "We are investigating the issue",
        componentIds: [component.id],
      });

      expect(incident.title).toBe("API Outage");
      expect(incident.severity).toBe("major");
      expect(incident.status).toBe("investigating");

      // Verify initial update was created
      const updates = await db
        .select()
        .from(incidentUpdates)
        .where(eq(incidentUpdates.incidentId, incident.id));

      expect(updates).toHaveLength(1);
      expect(updates[0]!.message).toBe("We are investigating the issue");
    });

    test("links incident to components", async () => {
      await createTestOrganization();
      const comp1 = await createTestComponent({ name: "API" });
      const comp2 = await createTestComponent({ name: "Database" });

      const incident = await IncidentService.create({
        title: "Multiple Services Down",
        severity: "critical",
        status: "investigating",
        message: "Investigating",
        componentIds: [comp1.id, comp2.id],
      });

      const links = await db
        .select()
        .from(incidentComponents)
        .where(eq(incidentComponents.incidentId, incident.id));

      expect(links).toHaveLength(2);
    });

    test("updates component status based on severity", async () => {
      await createTestOrganization();
      const component = await createTestComponent({
        status: "operational",
      });

      await IncidentService.create({
        title: "Major Incident",
        severity: "major",
        status: "investigating",
        message: "Testing",
        componentIds: [component.id],
      });

      // Refresh component
      const [updated] = await db.select().from(components).where(eq(components.id, component.id));

      expect(updated!.status).toBe("partial_outage");
    });

    test("creates incident without components", async () => {
      await createTestOrganization();

      const incident = await IncidentService.create({
        title: "General Issue",
        severity: "minor",
        status: "investigating",
        message: "We are looking into this",
        componentIds: [],
      });

      expect(incident.title).toBe("General Issue");

      const links = await db
        .select()
        .from(incidentComponents)
        .where(eq(incidentComponents.incidentId, incident.id));

      expect(links).toHaveLength(0);
    });
  });

  describe("addUpdate", () => {
    test("adds update to existing incident", async () => {
      await createTestOrganization();
      const incident = await IncidentService.create({
        title: "Test Incident",
        severity: "minor",
        status: "investigating",
        message: "Initial update",
        componentIds: [],
      });

      const update = await IncidentService.addUpdate({
        incidentId: incident.id,
        status: "identified",
        message: "We found the root cause",
      });

      expect(update!.status).toBe("identified");
      expect(update!.message).toBe("We found the root cause");

      // Verify incident status was updated
      const [refreshed] = await db.select().from(incidents).where(eq(incidents.id, incident.id));

      expect(refreshed!.status).toBe("identified");
    });

    test("throws error for non-existent incident", async () => {
      await createTestOrganization();

      await expect(
        IncidentService.addUpdate({
          incidentId: "00000000-0000-0000-0000-000000000000",
          status: "monitoring",
          message: "Should fail",
        })
      ).rejects.toThrow("Incident not found");
    });
  });

  describe("resolve", () => {
    test("resolves incident and restores component status", async () => {
      await createTestOrganization();
      const component = await createTestComponent({
        status: "operational",
      });

      const incident = await IncidentService.create({
        title: "Test Incident",
        severity: "major",
        status: "investigating",
        message: "Initial",
        componentIds: [component.id],
      });

      // Verify component status was changed
      const [degraded] = await db.select().from(components).where(eq(components.id, component.id));
      expect(degraded!.status).toBe("partial_outage");

      // Resolve incident
      await IncidentService.resolve({
        incidentId: incident.id,
        message: "Issue resolved",
      });

      // Verify incident is resolved
      const [resolved] = await db.select().from(incidents).where(eq(incidents.id, incident.id));

      expect(resolved!.status).toBe("resolved");
      expect(resolved!.resolvedAt).toBeDefined();

      // Verify component status was restored
      const [restored] = await db.select().from(components).where(eq(components.id, component.id));
      expect(restored!.status).toBe("operational");
    });
  });

  describe("getById", () => {
    test("returns incident with updates and components", async () => {
      await createTestOrganization();
      const component = await createTestComponent({ name: "API" });

      const incident = await IncidentService.create({
        title: "Test Incident",
        severity: "minor",
        status: "investigating",
        message: "First update",
        componentIds: [component.id],
      });

      await IncidentService.addUpdate({
        incidentId: incident.id,
        status: "monitoring",
        message: "Second update",
      });

      const result = await IncidentService.getById(incident.id);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Test Incident");
      expect(result?.updates).toHaveLength(2);
      expect(result?.affectedComponents).toHaveLength(1);
      expect(result?.affectedComponents[0]!.name).toBe("API");
    });

    test("returns null for non-existent incident", async () => {
      await createTestOrganization();

      const result = await IncidentService.getById("00000000-0000-0000-0000-000000000000");

      expect(result).toBeNull();
    });
  });

  describe("list", () => {
    test("lists incidents with pagination", async () => {
      await createTestOrganization();

      // Create multiple incidents
      for (let i = 0; i < 5; i++) {
        await IncidentService.create({
          title: `Incident ${i + 1}`,
          severity: "minor",
          status: "investigating",
          message: "Test",
          componentIds: [],
        });
      }

      const result = await IncidentService.list({
        limit: 3,
        offset: 0,
      });

      expect(result.incidents).toHaveLength(3);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.limit).toBe(3);
      expect(result.pagination.offset).toBe(0);
    });

    test("filters by active status", async () => {
      await createTestOrganization();

      await IncidentService.create({
        title: "Active Incident",
        severity: "minor",
        status: "investigating",
        message: "Test",
        componentIds: [],
      });

      const resolved = await IncidentService.create({
        title: "Resolved Incident",
        severity: "minor",
        status: "investigating",
        message: "Test",
        componentIds: [],
      });

      await IncidentService.resolve({
        incidentId: resolved.id,
      });

      const result = await IncidentService.list({
        status: "active",
        limit: 10,
        offset: 0,
      });

      expect(result.incidents).toHaveLength(1);
      expect(result.incidents[0]!.title).toBe("Active Incident");
    });

    test("filters by severity", async () => {
      await createTestOrganization();

      await IncidentService.create({
        title: "Minor Issue",
        severity: "minor",
        status: "investigating",
        message: "Test",
        componentIds: [],
      });

      await IncidentService.create({
        title: "Critical Issue",
        severity: "critical",
        status: "investigating",
        message: "Test",
        componentIds: [],
      });

      const result = await IncidentService.list({
        severity: "critical",
        limit: 10,
        offset: 0,
      });

      expect(result.incidents).toHaveLength(1);
      expect(result.incidents[0]!.title).toBe("Critical Issue");
    });
  });

  describe("delete", () => {
    test("deletes incident and restores component status", async () => {
      await createTestOrganization();
      const component = await createTestComponent({
        status: "operational",
      });

      const incident = await IncidentService.create({
        title: "Test Incident",
        severity: "major",
        status: "investigating",
        message: "Test",
        componentIds: [component.id],
      });

      // Component should be degraded
      const [degraded] = await db.select().from(components).where(eq(components.id, component.id));
      expect(degraded!.status).toBe("partial_outage");

      // Delete incident
      const result = await IncidentService.delete(incident.id);
      expect(result?.success).toBe(true);

      // Component should be restored
      const [restored] = await db.select().from(components).where(eq(components.id, component.id));
      expect(restored!.status).toBe("operational");

      // Incident should be gone
      const [deleted] = await db.select().from(incidents).where(eq(incidents.id, incident.id));
      expect(deleted).toBeUndefined();
    });

    test("returns null for non-existent incident", async () => {
      await createTestOrganization();

      const result = await IncidentService.delete("00000000-0000-0000-0000-000000000000");

      expect(result).toBeNull();
    });
  });

  describe("createFromMonitorFailure", () => {
    test("creates new incident for monitor failure", async () => {
      await createTestOrganization();
      const component = await createTestComponent({
        name: "API Server",
      });
      const monitor = await createTestMonitor(component.id);

      const incident = await IncidentService.createFromMonitorFailure({
        monitorId: monitor.id,
        componentId: component.id,
        componentName: component.name,
        errorMessage: "Connection timeout",
      });

      expect(incident.title).toBe("API Server is experiencing issues");
      expect(incident.severity).toBe("major");
      expect(incident.triggeredByMonitorId).toBe(monitor.id);
    });

    test("adds update to existing incident for same monitor", async () => {
      await createTestOrganization();
      const component = await createTestComponent({
        name: "API Server",
      });
      const monitor = await createTestMonitor(component.id);

      // First failure creates incident
      const incident1 = await IncidentService.createFromMonitorFailure({
        monitorId: monitor.id,
        componentId: component.id,
        componentName: component.name,
        errorMessage: "First failure",
      });

      // Second failure adds update to existing incident
      const incident2 = await IncidentService.createFromMonitorFailure({
        monitorId: monitor.id,
        componentId: component.id,
        componentName: component.name,
        errorMessage: "Second failure",
      });

      // Should return the same incident
      expect(incident2.id).toBe(incident1.id);

      // Should have 2 updates now
      const updates = await db
        .select()
        .from(incidentUpdates)
        .where(eq(incidentUpdates.incidentId, incident1.id));
      expect(updates).toHaveLength(2);
    });
  });

  describe("resolveFromMonitorRecovery", () => {
    test("resolves incident when monitor recovers", async () => {
      await createTestOrganization();
      const component = await createTestComponent();
      const monitor = await createTestMonitor(component.id);

      // Create incident from monitor failure
      const incident = await IncidentService.createFromMonitorFailure({
        monitorId: monitor.id,
        componentId: component.id,
        componentName: component.name,
        errorMessage: "Failure",
      });

      // Resolve from recovery
      const resolved = await IncidentService.resolveFromMonitorRecovery({
        monitorId: monitor.id,
      });

      expect(resolved?.id).toBe(incident.id);

      // Verify incident is resolved
      const [updated] = await db.select().from(incidents).where(eq(incidents.id, incident.id));
      expect(updated!.status).toBe("resolved");
      expect(updated!.resolvedAt).toBeDefined();
    });

    test("returns null when no active incident exists", async () => {
      await createTestOrganization();
      const component = await createTestComponent();
      const monitor = await createTestMonitor(component.id);

      const result = await IncidentService.resolveFromMonitorRecovery({
        monitorId: monitor.id,
      });

      expect(result).toBeNull();
    });
  });
});
