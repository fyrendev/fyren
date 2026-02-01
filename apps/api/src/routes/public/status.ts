import type { ComponentStatus } from "@fyrendev/db";
import {
  and,
  asc,
  components,
  db,
  desc,
  eq,
  gte,
  incidentComponents,
  incidents,
  incidentUpdates,
  lt,
  maintenanceComponents,
  maintenances,
  monitorResults,
  monitors,
  or,
  organizations,
  sql,
} from "@fyrendev/db";
import { Hono } from "hono";
import { errorResponse, NotFoundError } from "../../lib/errors";
import {
  cacheComponentStatus,
  getCachedComponentStatus,
  type ComponentWithStatus,
} from "../../services/cache.service";
import { calculateUptime, getOverallStatus } from "../../services/monitor.service";

export const publicStatus = new Hono();

// Helper to get the organization
async function getOrganization() {
  const [org] = await db
    .select()
    .from(organizations)
    .orderBy(asc(organizations.createdAt))
    .limit(1);
  if (!org) throw new NotFoundError("No organization configured");
  return org;
}

// Helper to get public components for an org
async function getOrgComponents(orgId: string): Promise<ComponentWithStatus[]> {
  const orgComponents = await db
    .select({
      id: components.id,
      name: components.name,
      description: components.description,
      status: components.status,
      displayOrder: components.displayOrder,
      updatedAt: components.updatedAt,
    })
    .from(components)
    .where(and(eq(components.organizationId, orgId), eq(components.isPublic, true)))
    .orderBy(asc(components.displayOrder));

  return orgComponents.map((comp) => ({
    ...comp,
    status: comp.status as ComponentStatus,
  }));
}

// Helper to get active incidents for an org
async function getActiveIncidents(orgId: string) {
  const activeIncidents = await db
    .select({
      id: incidents.id,
      title: incidents.title,
      status: incidents.status,
      severity: incidents.severity,
      startedAt: incidents.startedAt,
      createdAt: incidents.createdAt,
      updatedAt: incidents.updatedAt,
    })
    .from(incidents)
    .where(
      and(
        eq(incidents.organizationId, orgId),
        or(
          eq(incidents.status, "investigating"),
          eq(incidents.status, "identified"),
          eq(incidents.status, "monitoring")
        )
      )
    )
    .orderBy(desc(incidents.startedAt));

  // Get affected components and latest update for each incident
  const incidentsWithDetails = await Promise.all(
    activeIncidents.map(async (incident) => {
      const affectedComponents = await db
        .select({
          id: components.id,
          name: components.name,
        })
        .from(incidentComponents)
        .innerJoin(components, eq(incidentComponents.componentId, components.id))
        .where(eq(incidentComponents.incidentId, incident.id));

      const [latestUpdate] = await db
        .select({
          id: incidentUpdates.id,
          status: incidentUpdates.status,
          message: incidentUpdates.message,
          createdAt: incidentUpdates.createdAt,
        })
        .from(incidentUpdates)
        .where(eq(incidentUpdates.incidentId, incident.id))
        .orderBy(desc(incidentUpdates.createdAt))
        .limit(1);

      return {
        id: incident.id,
        title: incident.title,
        status: incident.status,
        severity: incident.severity,
        affectedComponents,
        latestUpdate: latestUpdate || null,
        startedAt: incident.startedAt.toISOString(),
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString(),
      };
    })
  );

  return incidentsWithDetails;
}

// Helper to get scheduled/in-progress maintenance
async function getUpcomingMaintenance(orgId: string) {
  const upcomingMaintenance = await db
    .select({
      id: maintenances.id,
      title: maintenances.title,
      description: maintenances.description,
      status: maintenances.status,
      scheduledStartAt: maintenances.scheduledStartAt,
      scheduledEndAt: maintenances.scheduledEndAt,
      startedAt: maintenances.startedAt,
    })
    .from(maintenances)
    .where(
      and(
        eq(maintenances.organizationId, orgId),
        or(eq(maintenances.status, "scheduled"), eq(maintenances.status, "in_progress"))
      )
    )
    .orderBy(asc(maintenances.scheduledStartAt));

  // Get affected components for each maintenance
  const maintenanceWithComponents = await Promise.all(
    upcomingMaintenance.map(async (maint) => {
      const affectedComponents = await db
        .select({
          id: components.id,
          name: components.name,
        })
        .from(maintenanceComponents)
        .innerJoin(components, eq(maintenanceComponents.componentId, components.id))
        .where(eq(maintenanceComponents.maintenanceId, maint.id));

      return {
        id: maint.id,
        title: maint.title,
        description: maint.description,
        status: maint.status,
        affectedComponents,
        scheduledStartAt: maint.scheduledStartAt.toISOString(),
        scheduledEndAt: maint.scheduledEndAt.toISOString(),
        startedAt: maint.startedAt?.toISOString() || null,
      };
    })
  );

  return maintenanceWithComponents;
}

// GET /api/v1/status - Full status summary
publicStatus.get("/", async (c) => {
  try {
    const org = await getOrganization();

    // Try cache first for components
    let componentList = await getCachedComponentStatus(org.slug);

    if (!componentList) {
      componentList = await getOrgComponents(org.id);
      await cacheComponentStatus(org.slug, componentList);
    }

    // Calculate overall status
    const statuses = componentList.map((comp) => comp.status);
    const overall = getOverallStatus(statuses);

    // Get active incidents and scheduled maintenance
    const [activeIncidents, scheduledMaintenance] = await Promise.all([
      getActiveIncidents(org.id),
      getUpcomingMaintenance(org.id),
    ]);

    return c.json({
      organization: {
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        brandColor: org.brandColor,
        accentColor: org.accentColor,
        backgroundColor: org.backgroundColor,
        textColor: org.textColor,
        websiteUrl: org.customDomain ? `https://${org.customDomain}` : null,
      },
      status: {
        indicator: overall.indicator,
        description: overall.description,
      },
      components: componentList.map((comp) => ({
        id: comp.id,
        name: comp.name,
        description: comp.description,
        status: comp.status,
        order: comp.displayOrder,
        updatedAt: comp.updatedAt instanceof Date ? comp.updatedAt.toISOString() : comp.updatedAt,
      })),
      activeIncidents,
      scheduledMaintenance,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/status/components - Components with status
publicStatus.get("/components", async (c) => {
  try {
    const org = await getOrganization();

    // Try cache first
    let componentList = await getCachedComponentStatus(org.slug);

    if (!componentList) {
      componentList = await getOrgComponents(org.id);
      await cacheComponentStatus(org.slug, componentList);
    }

    return c.json({
      components: componentList.map((comp) => ({
        id: comp.id,
        name: comp.name,
        description: comp.description,
        status: comp.status,
        order: comp.displayOrder,
        updatedAt: comp.updatedAt instanceof Date ? comp.updatedAt.toISOString() : comp.updatedAt,
      })),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/status/uptime - Uptime percentages
publicStatus.get("/uptime", async (c) => {
  try {
    const org = await getOrganization();

    // Get all public components
    const orgComponents = await db
      .select({
        id: components.id,
        name: components.name,
      })
      .from(components)
      .where(and(eq(components.organizationId, org.id), eq(components.isPublic, true)))
      .orderBy(asc(components.displayOrder));

    // Calculate uptime for each component
    const periods: Array<"24h" | "7d" | "30d" | "90d"> = ["24h", "7d", "30d", "90d"];

    const componentsWithUptime = await Promise.all(
      orgComponents.map(async (comp) => {
        const uptime: Record<string, number> = {};

        for (const period of periods) {
          const stats = await calculateUptime(comp.id, period);
          uptime[period] = stats.uptimePercentage;
        }

        // Convert keys to match spec: day, week, month, quarter
        return {
          id: comp.id,
          name: comp.name,
          uptime: {
            day: uptime["24h"] ?? 100,
            week: uptime["7d"] ?? 100,
            month: uptime["30d"] ?? 100,
            quarter: uptime["90d"] ?? 100,
          },
        };
      })
    );

    // Calculate overall uptime
    const overallUptime = {
      day: 100,
      week: 100,
      month: 100,
      quarter: 100,
    };

    if (componentsWithUptime.length > 0) {
      overallUptime.day =
        componentsWithUptime.reduce((sum, c) => sum + c.uptime.day, 0) /
        componentsWithUptime.length;
      overallUptime.week =
        componentsWithUptime.reduce((sum, c) => sum + c.uptime.week, 0) /
        componentsWithUptime.length;
      overallUptime.month =
        componentsWithUptime.reduce((sum, c) => sum + c.uptime.month, 0) /
        componentsWithUptime.length;
      overallUptime.quarter =
        componentsWithUptime.reduce((sum, c) => sum + c.uptime.quarter, 0) /
        componentsWithUptime.length;
    }

    return c.json({
      components: componentsWithUptime,
      overall: overallUptime,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/status/uptime/:componentId/history - Daily uptime history (90 days)
publicStatus.get("/uptime/:componentId/history", async (c) => {
  try {
    const componentId = c.req.param("componentId");
    const daysParam = c.req.query("days");
    const days = daysParam ? Math.min(parseInt(daysParam, 10), 90) : 90;

    const org = await getOrganization();

    // Verify component belongs to org
    const [component] = await db
      .select({
        id: components.id,
        name: components.name,
      })
      .from(components)
      .where(and(eq(components.id, componentId), eq(components.organizationId, org.id)))
      .limit(1);

    if (!component) {
      throw new NotFoundError("Component not found");
    }

    // Get monitor for this component
    const [monitor] = await db
      .select({ id: monitors.id })
      .from(monitors)
      .where(eq(monitors.componentId, componentId))
      .limit(1);

    const history: Array<{
      date: string;
      uptime: number;
      incidents: number;
      status: string;
    }> = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < days; i++) {
      const dayStart = new Date(today);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      let uptime = 100;
      let status = "operational";

      if (monitor) {
        // Get monitor results for this day
        const results = await db
          .select({
            status: monitorResults.status,
          })
          .from(monitorResults)
          .where(
            and(
              eq(monitorResults.monitorId, monitor.id),
              gte(monitorResults.checkedAt, dayStart),
              lt(monitorResults.checkedAt, dayEnd)
            )
          );

        if (results.length > 0) {
          const upCount = results.filter((r) => r.status === "up").length;
          uptime = (upCount / results.length) * 100;

          if (uptime < 50) {
            status = "major_outage";
          } else if (uptime < 75) {
            status = "partial_outage";
          } else if (uptime < 99) {
            status = "degraded_performance";
          }
        }
      }

      // Count incidents for this day
      const incidentCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(incidents)
        .innerJoin(incidentComponents, eq(incidents.id, incidentComponents.incidentId))
        .where(
          and(
            eq(incidentComponents.componentId, componentId),
            gte(incidents.startedAt, dayStart),
            lt(incidents.startedAt, dayEnd)
          )
        );

      history.push({
        date: dayStart.toISOString().split("T")[0] ?? "",
        uptime: Math.round(uptime * 100) / 100,
        incidents: incidentCount[0]?.count ?? 0,
        status,
      });
    }

    return c.json({
      component: {
        id: component.id,
        name: component.name,
      },
      history,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/status/incidents - Recent incidents
publicStatus.get("/incidents", async (c) => {
  try {
    const statusFilter = c.req.query("status");
    const limitParam = c.req.query("limit");
    const offsetParam = c.req.query("offset");

    const limit = Math.min(parseInt(limitParam || "10", 10), 50);
    const offset = parseInt(offsetParam || "0", 10);

    const org = await getOrganization();

    // Build where clause
    const whereConditions = [eq(incidents.organizationId, org.id)];

    if (statusFilter && statusFilter !== "all") {
      const validStatuses = ["investigating", "identified", "monitoring", "resolved"];
      if (validStatuses.includes(statusFilter)) {
        whereConditions.push(
          eq(incidents.status, statusFilter as (typeof incidents.status.enumValues)[number])
        );
      }
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(incidents)
      .where(and(...whereConditions));
    const count = countResult[0]?.count ?? 0;

    // Get incidents
    const incidentList = await db
      .select({
        id: incidents.id,
        title: incidents.title,
        status: incidents.status,
        severity: incidents.severity,
        startedAt: incidents.startedAt,
        resolvedAt: incidents.resolvedAt,
        createdAt: incidents.createdAt,
        updatedAt: incidents.updatedAt,
      })
      .from(incidents)
      .where(and(...whereConditions))
      .orderBy(desc(incidents.startedAt))
      .limit(limit)
      .offset(offset);

    // Get updates and affected components for each incident
    const incidentsWithDetails = await Promise.all(
      incidentList.map(async (incident) => {
        const [affectedComponents, updates] = await Promise.all([
          db
            .select({
              id: components.id,
              name: components.name,
            })
            .from(incidentComponents)
            .innerJoin(components, eq(incidentComponents.componentId, components.id))
            .where(eq(incidentComponents.incidentId, incident.id)),
          db
            .select({
              id: incidentUpdates.id,
              status: incidentUpdates.status,
              message: incidentUpdates.message,
              createdAt: incidentUpdates.createdAt,
            })
            .from(incidentUpdates)
            .where(eq(incidentUpdates.incidentId, incident.id))
            .orderBy(desc(incidentUpdates.createdAt)),
        ]);

        return {
          id: incident.id,
          title: incident.title,
          status: incident.status,
          severity: incident.severity,
          affectedComponents,
          updates: updates.map((u) => ({
            id: u.id,
            status: u.status,
            message: u.message,
            createdAt: u.createdAt.toISOString(),
          })),
          startedAt: incident.startedAt.toISOString(),
          resolvedAt: incident.resolvedAt?.toISOString() || null,
          createdAt: incident.createdAt.toISOString(),
          updatedAt: incident.updatedAt.toISOString(),
        };
      })
    );

    return c.json({
      incidents: incidentsWithDetails,
      pagination: {
        total: count,
        limit,
        offset,
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/status/incidents/:id - Single incident with timeline
publicStatus.get("/incidents/:id", async (c) => {
  try {
    const incidentId = c.req.param("id");

    const org = await getOrganization();

    // Get incident
    const [incident] = await db
      .select({
        id: incidents.id,
        title: incidents.title,
        status: incidents.status,
        severity: incidents.severity,
        startedAt: incidents.startedAt,
        resolvedAt: incidents.resolvedAt,
        createdAt: incidents.createdAt,
        updatedAt: incidents.updatedAt,
      })
      .from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.organizationId, org.id)))
      .limit(1);

    if (!incident) {
      throw new NotFoundError("Incident not found");
    }

    // Get affected components and updates
    const [affectedComponents, updates] = await Promise.all([
      db
        .select({
          id: components.id,
          name: components.name,
        })
        .from(incidentComponents)
        .innerJoin(components, eq(incidentComponents.componentId, components.id))
        .where(eq(incidentComponents.incidentId, incident.id)),
      db
        .select({
          id: incidentUpdates.id,
          status: incidentUpdates.status,
          message: incidentUpdates.message,
          createdAt: incidentUpdates.createdAt,
        })
        .from(incidentUpdates)
        .where(eq(incidentUpdates.incidentId, incident.id))
        .orderBy(desc(incidentUpdates.createdAt)),
    ]);

    return c.json({
      incident: {
        id: incident.id,
        title: incident.title,
        status: incident.status,
        severity: incident.severity,
        affectedComponents,
        updates: updates.map((u) => ({
          id: u.id,
          status: u.status,
          message: u.message,
          createdAt: u.createdAt.toISOString(),
        })),
        startedAt: incident.startedAt.toISOString(),
        resolvedAt: incident.resolvedAt?.toISOString() || null,
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/status/maintenance - Upcoming and in-progress maintenance
publicStatus.get("/maintenance", async (c) => {
  try {
    const org = await getOrganization();

    const maintenanceList = await getUpcomingMaintenance(org.id);

    return c.json({
      maintenance: maintenanceList,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Note: Subscribe, verify, unsubscribe, and RSS routes have been moved to
// dedicated route files: subscribe.ts and rss.ts
