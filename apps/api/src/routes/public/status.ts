import { Hono } from "hono";
import { z } from "zod";
import {
  db,
  organizations,
  components,
  incidents,
  incidentUpdates,
  incidentComponents,
  maintenances,
  maintenanceComponents,
  monitorResults,
  monitors,
  subscribers,
  eq,
  and,
  asc,
  desc,
  or,
  inArray,
  isNull,
  sql,
} from "@fyrendev/db";
import { NotFoundError, BadRequestError, errorResponse } from "../../lib/errors";
import {
  getCachedComponentStatus,
  cacheComponentStatus,
  type ComponentWithStatus,
} from "../../services/cache.service";
import {
  calculateUptime,
  getOverallStatus,
} from "../../services/monitor.service";
import type { ComponentStatus } from "@fyrendev/db";

// Generate a random token for email verification
function generateToken(length = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

export const publicStatus = new Hono();

// Helper to get organization by slug
async function getOrgBySlug(slug: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  if (!org) throw new NotFoundError("Organization not found");
  return org;
}

// Helper to get components for an org
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
    .where(eq(components.organizationId, orgId))
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
        or(
          eq(maintenances.status, "scheduled"),
          eq(maintenances.status, "in_progress")
        )
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
        .innerJoin(
          components,
          eq(maintenanceComponents.componentId, components.id)
        )
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

// GET /api/v1/status/:slug - Full status summary
publicStatus.get("/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const org = await getOrgBySlug(slug);

    // Try cache first for components
    let componentList = await getCachedComponentStatus(slug);

    if (!componentList) {
      componentList = await getOrgComponents(org.id);
      await cacheComponentStatus(slug, componentList);
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
        updatedAt:
          comp.updatedAt instanceof Date
            ? comp.updatedAt.toISOString()
            : comp.updatedAt,
      })),
      activeIncidents,
      scheduledMaintenance,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/status/:slug/components - Components with status
publicStatus.get("/:slug/components", async (c) => {
  try {
    const slug = c.req.param("slug");
    const org = await getOrgBySlug(slug);

    // Try cache first
    let componentList = await getCachedComponentStatus(slug);

    if (!componentList) {
      componentList = await getOrgComponents(org.id);
      await cacheComponentStatus(slug, componentList);
    }

    return c.json({
      components: componentList.map((comp) => ({
        id: comp.id,
        name: comp.name,
        description: comp.description,
        status: comp.status,
        order: comp.displayOrder,
        updatedAt:
          comp.updatedAt instanceof Date
            ? comp.updatedAt.toISOString()
            : comp.updatedAt,
      })),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/status/:slug/uptime - Uptime percentages
publicStatus.get("/:slug/uptime", async (c) => {
  try {
    const slug = c.req.param("slug");
    const org = await getOrgBySlug(slug);

    // Get all public components
    const orgComponents = await db
      .select({
        id: components.id,
        name: components.name,
      })
      .from(components)
      .where(eq(components.organizationId, org.id))
      .orderBy(asc(components.displayOrder));

    // Calculate uptime for each component
    const periods: Array<"24h" | "7d" | "30d" | "90d"> = [
      "24h",
      "7d",
      "30d",
      "90d",
    ];

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
            day: uptime["24h"],
            week: uptime["7d"],
            month: uptime["30d"],
            quarter: uptime["90d"],
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

// GET /api/v1/status/:slug/uptime/:componentId/history - Daily uptime history (90 days)
publicStatus.get("/:slug/uptime/:componentId/history", async (c) => {
  try {
    const slug = c.req.param("slug");
    const componentId = c.req.param("componentId");
    const daysParam = c.req.query("days");
    const days = daysParam ? Math.min(parseInt(daysParam, 10), 90) : 90;

    const org = await getOrgBySlug(slug);

    // Verify component belongs to org
    const [component] = await db
      .select({
        id: components.id,
        name: components.name,
      })
      .from(components)
      .where(
        and(
          eq(components.id, componentId),
          eq(components.organizationId, org.id)
        )
      )
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
              sql`${monitorResults.checkedAt} >= ${dayStart}`,
              sql`${monitorResults.checkedAt} < ${dayEnd}`
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
        .innerJoin(
          incidentComponents,
          eq(incidents.id, incidentComponents.incidentId)
        )
        .where(
          and(
            eq(incidentComponents.componentId, componentId),
            sql`${incidents.startedAt} >= ${dayStart}`,
            sql`${incidents.startedAt} < ${dayEnd}`
          )
        );

      history.push({
        date: dayStart.toISOString().split("T")[0],
        uptime: Math.round(uptime * 100) / 100,
        incidents: incidentCount[0]?.count || 0,
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

// GET /api/v1/status/:slug/incidents - Recent incidents
publicStatus.get("/:slug/incidents", async (c) => {
  try {
    const slug = c.req.param("slug");
    const statusFilter = c.req.query("status");
    const limitParam = c.req.query("limit");
    const offsetParam = c.req.query("offset");

    const limit = Math.min(parseInt(limitParam || "10", 10), 50);
    const offset = parseInt(offsetParam || "0", 10);

    const org = await getOrgBySlug(slug);

    // Build where clause
    const whereConditions = [eq(incidents.organizationId, org.id)];

    if (statusFilter && statusFilter !== "all") {
      const validStatuses = ["investigating", "identified", "monitoring", "resolved"];
      if (validStatuses.includes(statusFilter)) {
        whereConditions.push(eq(incidents.status, statusFilter as typeof incidents.status.enumValues[number]));
      }
    }

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(incidents)
      .where(and(...whereConditions));

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
            .innerJoin(
              components,
              eq(incidentComponents.componentId, components.id)
            )
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

// GET /api/v1/status/:slug/incidents/:id - Single incident with timeline
publicStatus.get("/:slug/incidents/:id", async (c) => {
  try {
    const slug = c.req.param("slug");
    const incidentId = c.req.param("id");

    const org = await getOrgBySlug(slug);

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
      .where(
        and(
          eq(incidents.id, incidentId),
          eq(incidents.organizationId, org.id)
        )
      )
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

// GET /api/v1/status/:slug/maintenance - Upcoming and in-progress maintenance
publicStatus.get("/:slug/maintenance", async (c) => {
  try {
    const slug = c.req.param("slug");
    const org = await getOrgBySlug(slug);

    const maintenanceList = await getUpcomingMaintenance(org.id);

    return c.json({
      maintenance: maintenanceList,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Subscribe schema
const subscribeSchema = z.object({
  email: z.string().email("Invalid email address"),
  components: z.array(z.string()).optional(),
});

// POST /api/v1/status/:slug/subscribe - Subscribe email to status updates
publicStatus.post("/:slug/subscribe", async (c) => {
  try {
    const slug = c.req.param("slug");
    const org = await getOrgBySlug(slug);

    const body = await c.req.json();
    const { email, components: componentIds } = subscribeSchema.parse(body);

    // Check if already subscribed
    const [existing] = await db
      .select()
      .from(subscribers)
      .where(
        and(
          eq(subscribers.organizationId, org.id),
          eq(subscribers.email, email)
        )
      )
      .limit(1);

    if (existing) {
      // If already verified, just return success
      if (existing.isVerified && !existing.unsubscribedAt) {
        return c.json({ message: "Already subscribed" });
      }

      // If unsubscribed, resubscribe with new token
      if (existing.unsubscribedAt) {
        const token = generateToken();
        await db
          .update(subscribers)
          .set({
            verificationToken: token,
            isVerified: false,
            unsubscribedAt: null,
            subscribedAt: new Date(),
          })
          .where(eq(subscribers.id, existing.id));

        // TODO: Send verification email
        return c.json({
          message: "Please check your email to confirm your subscription",
        });
      }

      // If pending verification, resend with new token
      const token = generateToken();
      await db
        .update(subscribers)
        .set({ verificationToken: token })
        .where(eq(subscribers.id, existing.id));

      // TODO: Send verification email
      return c.json({
        message: "Please check your email to confirm your subscription",
      });
    }

    // Create new subscriber
    const token = generateToken();
    await db.insert(subscribers).values({
      organizationId: org.id,
      email,
      verificationToken: token,
      isVerified: false,
    });

    // TODO: Send verification email with token
    return c.json(
      {
        message: "Please check your email to confirm your subscription",
      },
      201
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: { message: error.errors[0].message, code: "validation_error" } },
        400
      );
    }
    return errorResponse(c, error);
  }
});

// GET /api/v1/status/:slug/subscribe/verify/:token - Verify email subscription
publicStatus.get("/:slug/subscribe/verify/:token", async (c) => {
  try {
    const slug = c.req.param("slug");
    const token = c.req.param("token");

    const org = await getOrgBySlug(slug);

    // Find subscriber with token
    const [subscriber] = await db
      .select()
      .from(subscribers)
      .where(
        and(
          eq(subscribers.organizationId, org.id),
          eq(subscribers.verificationToken, token)
        )
      )
      .limit(1);

    if (!subscriber) {
      throw new BadRequestError("Invalid or expired verification token");
    }

    // Mark as verified
    await db
      .update(subscribers)
      .set({
        isVerified: true,
        verificationToken: null,
      })
      .where(eq(subscribers.id, subscriber.id));

    return c.json({ message: "Successfully subscribed to status updates" });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /api/v1/status/:slug/unsubscribe - Unsubscribe from status updates
publicStatus.post("/:slug/unsubscribe", async (c) => {
  try {
    const slug = c.req.param("slug");
    const org = await getOrgBySlug(slug);

    const body = await c.req.json();
    const { email, token } = body;

    if (!email && !token) {
      throw new BadRequestError("Email or unsubscribe token required");
    }

    let whereClause;
    if (token) {
      whereClause = and(
        eq(subscribers.organizationId, org.id),
        eq(subscribers.verificationToken, token)
      );
    } else {
      whereClause = and(
        eq(subscribers.organizationId, org.id),
        eq(subscribers.email, email)
      );
    }

    const [subscriber] = await db
      .select()
      .from(subscribers)
      .where(whereClause)
      .limit(1);

    if (!subscriber) {
      // Don't reveal if email exists
      return c.json({ message: "If subscribed, you have been unsubscribed" });
    }

    await db
      .update(subscribers)
      .set({ unsubscribedAt: new Date() })
      .where(eq(subscribers.id, subscriber.id));

    return c.json({ message: "Successfully unsubscribed from status updates" });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/status/:slug/rss - RSS feed of incidents
publicStatus.get("/:slug/rss", async (c) => {
  try {
    const slug = c.req.param("slug");
    const org = await getOrgBySlug(slug);

    // Get recent incidents (last 20)
    const recentIncidents = await db
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
      .where(eq(incidents.organizationId, org.id))
      .orderBy(desc(incidents.startedAt))
      .limit(20);

    // Get latest updates for each incident
    const incidentsWithUpdates = await Promise.all(
      recentIncidents.map(async (incident) => {
        const [latestUpdate] = await db
          .select({
            message: incidentUpdates.message,
            createdAt: incidentUpdates.createdAt,
          })
          .from(incidentUpdates)
          .where(eq(incidentUpdates.incidentId, incident.id))
          .orderBy(desc(incidentUpdates.createdAt))
          .limit(1);

        return {
          ...incident,
          latestUpdate,
        };
      })
    );

    // Build RSS feed
    const baseUrl = process.env.PUBLIC_URL || `https://${slug}.fyren.dev`;
    const feedUrl = `${baseUrl}/api/v1/status/${slug}/rss`;
    const siteUrl = `${baseUrl}/${slug}`;

    const rssItems = incidentsWithUpdates
      .map((incident) => {
        const pubDate = incident.updatedAt.toUTCString();
        const description = incident.latestUpdate?.message || `${incident.title} - Status: ${incident.status}`;
        const link = `${siteUrl}/incidents/${incident.id}`;

        return `    <item>
      <title><![CDATA[${incident.title}]]></title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${description}]]></description>
      <category>${incident.severity}</category>
    </item>`;
      })
      .join("\n");

    const lastBuildDate = recentIncidents[0]?.updatedAt?.toUTCString() || new Date().toUTCString();

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${org.name} Status</title>
    <link>${siteUrl}</link>
    <description>Status updates and incidents for ${org.name}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
${rssItems}
  </channel>
</rss>`;

    return c.body(rss, 200, {
      "Content-Type": "application/rss+xml; charset=utf-8",
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
