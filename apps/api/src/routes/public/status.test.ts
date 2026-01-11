import { describe, expect, test } from "bun:test";
import {
  createTestApp,
  createTestComponent,
  createTestIncident,
  createTestIncidentComponent,
  createTestIncidentUpdate,
  createTestMaintenance,
  createTestMaintenanceComponent,
  createTestOrganization,
  setupTestHooks,
} from "../../test";

describe("Public Status API", () => {
  setupTestHooks();

  const app = createTestApp();

  describe("GET /api/v1/status", () => {
    test("returns organization status summary", async () => {
      const org = await createTestOrganization({
        slug: "acme",
        name: "Acme Corp",
      });
      await createTestComponent(org.id, { name: "API", status: "operational" });
      await createTestComponent(org.id, {
        name: "Database",
        status: "operational",
      });

      const res = await app.request("/api/v1/status");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.organization.name).toBe("Acme Corp");
      expect(data.organization.slug).toBe("acme");
      expect(data.components).toHaveLength(2);
    });

    test("returns 404 when no organization configured", async () => {
      const res = await app.request("/api/v1/status");

      expect(res.status).toBe(404);
    });

    test("only returns public components", async () => {
      const org = await createTestOrganization({ slug: "test-org" });
      await createTestComponent(org.id, { name: "Public", isPublic: true });
      await createTestComponent(org.id, { name: "Private", isPublic: false });

      const res = await app.request("/api/v1/status");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.components).toHaveLength(1);
      expect(data.components[0].name).toBe("Public");
    });
  });

  describe("GET /api/v1/status/components", () => {
    test("returns component list with status", async () => {
      const org = await createTestOrganization({ slug: "test-org" });
      await createTestComponent(org.id, {
        name: "API",
        status: "operational",
        displayOrder: 1,
      });
      await createTestComponent(org.id, {
        name: "Database",
        status: "degraded",
        displayOrder: 2,
      });

      const res = await app.request("/api/v1/status/components");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.components).toHaveLength(2);
      expect(data.components[0].status).toBe("operational");
      expect(data.components[1].status).toBe("degraded");
    });

    test("returns components in display order", async () => {
      const org = await createTestOrganization({ slug: "test-org" });
      await createTestComponent(org.id, { name: "Third", displayOrder: 3 });
      await createTestComponent(org.id, { name: "First", displayOrder: 1 });
      await createTestComponent(org.id, { name: "Second", displayOrder: 2 });

      const res = await app.request("/api/v1/status/components");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.components[0].name).toBe("First");
      expect(data.components[1].name).toBe("Second");
      expect(data.components[2].name).toBe("Third");
    });
  });

  describe("GET /api/v1/status/incidents", () => {
    test("returns recent incidents", async () => {
      const org = await createTestOrganization({ slug: "test-org" });
      const component = await createTestComponent(org.id);
      const incident = await createTestIncident(org.id, {
        title: "API Outage",
        status: "investigating",
        severity: "major",
      });
      await createTestIncidentUpdate(incident.id, {
        message: "We are investigating the issue",
        status: "investigating",
      });
      await createTestIncidentComponent(incident.id, component.id);

      const res = await app.request("/api/v1/status/incidents");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.incidents).toHaveLength(1);
      expect(data.incidents[0].title).toBe("API Outage");
      expect(data.incidents[0].status).toBe("investigating");
      expect(data.incidents[0].severity).toBe("major");
    });

    test("returns empty array when no incidents", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request("/api/v1/status/incidents");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.incidents).toHaveLength(0);
    });
  });

  describe("GET /api/v1/status/incidents/:id", () => {
    test("returns incident details with updates", async () => {
      const org = await createTestOrganization({ slug: "test-org" });
      const incident = await createTestIncident(org.id, {
        title: "Database Issues",
      });
      await createTestIncidentUpdate(incident.id, {
        message: "First update",
        status: "investigating",
      });
      await createTestIncidentUpdate(incident.id, {
        message: "Second update",
        status: "identified",
      });

      const res = await app.request(`/api/v1/status/incidents/${incident.id}`);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.incident.title).toBe("Database Issues");
      expect(data.incident.updates).toHaveLength(2);
    });

    test("returns 404 for non-existent incident", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request(
        "/api/v1/status/incidents/00000000-0000-0000-0000-000000000000"
      );

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/status/maintenance", () => {
    test("returns upcoming maintenance windows", async () => {
      const org = await createTestOrganization({ slug: "test-org" });
      const component = await createTestComponent(org.id);
      const maint = await createTestMaintenance(org.id, {
        title: "Scheduled Upgrade",
        status: "scheduled",
      });
      await createTestMaintenanceComponent(maint.id, component.id);

      const res = await app.request("/api/v1/status/maintenance");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.maintenance).toHaveLength(1);
      expect(data.maintenance[0].title).toBe("Scheduled Upgrade");
    });

    test("returns empty array when no maintenance scheduled", async () => {
      await createTestOrganization({ slug: "test-org" });

      const res = await app.request("/api/v1/status/maintenance");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.maintenance).toHaveLength(0);
    });
  });
});
